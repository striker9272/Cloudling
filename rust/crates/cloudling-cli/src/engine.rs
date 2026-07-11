use std::path::{Path, PathBuf};

use runtime::{
    AssistantEvent, ContentBlock, ConversationMessage, PermissionMode, TurnSummary,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tempfile::TempDir;

/// Stable usage payload shared by CLI JSON output and future HTTP responses.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ClawEngineUsage {
    pub input_tokens: u32,
    pub output_tokens: u32,
    pub cache_creation_input_tokens: u32,
    pub cache_read_input_tokens: u32,
}

/// Auto-compaction summary shared by CLI and future API surfaces.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ClawEngineAutoCompaction {
    pub removed_messages: usize,
    pub notice: String,
    /// True when the compaction was *reactive*: the backend rejected the request as over
    /// its context window and the turn was retried after folding older messages (as opposed
    /// to the proactive in-turn threshold compaction). Additive field — absent in older
    /// JSON output, so it defaults to false on deserialize.
    #[serde(default)]
    pub reactive: bool,
}

/// Non-streaming engine response.
///
/// This mirrors the existing `claw --output-format json prompt ...` contract,
/// but lives in a reusable module so `openai-serve` can call the same conversion
/// instead of reimplementing prompt JSON formatting.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ClawEngineResponse {
    pub message: String,
    pub model: String,
    pub iterations: usize,
    pub auto_compaction: Option<ClawEngineAutoCompaction>,
    pub tool_uses: Vec<Value>,
    pub tool_results: Vec<Value>,
    pub prompt_cache_events: Vec<Value>,
    pub usage: ClawEngineUsage,
    pub estimated_cost: String,
}

impl ClawEngineResponse {
    #[must_use]
    pub fn from_turn_summary(model: &str, summary: &TurnSummary) -> Self {
        Self {
            message: final_assistant_text(summary),
            model: model.to_string(),
            iterations: summary.iterations,
            auto_compaction: summary
                .auto_compaction
                .map(|event| ClawEngineAutoCompaction {
                    removed_messages: event.removed_message_count,
                    notice: format_auto_compaction_notice(event.removed_message_count),
                    reactive: false,
                }),
            tool_uses: collect_tool_uses(summary),
            tool_results: collect_tool_results(summary),
            prompt_cache_events: collect_prompt_cache_events(summary),
            usage: ClawEngineUsage {
                input_tokens: summary.usage.input_tokens,
                output_tokens: summary.usage.output_tokens,
                cache_creation_input_tokens: summary.usage.cache_creation_input_tokens,
                cache_read_input_tokens: summary.usage.cache_read_input_tokens,
            },
            estimated_cost: runtime::format_usd(
                summary
                    .usage
                    .estimate_cost_usd_with_pricing(
                        runtime::pricing_for_model(model)
                            .unwrap_or_else(runtime::ModelPricing::default_sonnet_tier),
                    )
                    .total_cost_usd(),
            ),
        }
    }
}

/// Minimal host contract needed by the reusable prompt engine.
///
/// The first implementation is `LiveCli`, but the important part is that the
/// prompt loop below no longer needs to know about the whole terminal UI object.
/// A future OpenAI-compatible HTTP server can provide another host that prepares
/// the same runtime without REPL banners, spinners, or terminal-only behavior.
trait EngineHost {
    fn model(&self) -> &str;
    fn permission_mode(&self) -> PermissionMode;
    fn prepare_engine_runtime(
        &self,
        emit_output: bool,
    ) -> Result<(crate::BuiltRuntime, crate::HookAbortMonitor), Box<dyn std::error::Error>>;
    fn replace_engine_runtime(
        &mut self,
        runtime: crate::BuiltRuntime,
    ) -> Result<(), Box<dyn std::error::Error>>;
    fn persist_engine_session(&self) -> Result<(), Box<dyn std::error::Error>>;
    fn workspace_root(&self) -> Option<&Path> {
        None
    }
    /// The host's stored (pre-turn) session — the state a retry would rebuild from.
    /// Used by the reactive compact-and-retry below.
    fn engine_session(&self) -> &runtime::Session;
    /// Replace the host's stored session (with a compacted copy) so the next
    /// `prepare_engine_runtime` builds from the smaller history.
    fn adopt_engine_session(&mut self, session: runtime::Session);
}

impl EngineHost for crate::LiveCli {
    fn model(&self) -> &str {
        &self.model
    }

    fn permission_mode(&self) -> PermissionMode {
        self.permission_mode
    }

    fn prepare_engine_runtime(
        &self,
        emit_output: bool,
    ) -> Result<(crate::BuiltRuntime, crate::HookAbortMonitor), Box<dyn std::error::Error>> {
        self.prepare_turn_runtime(emit_output)
    }

    fn replace_engine_runtime(
        &mut self,
        runtime: crate::BuiltRuntime,
    ) -> Result<(), Box<dyn std::error::Error>> {
        self.replace_runtime(runtime)
    }

    fn persist_engine_session(&self) -> Result<(), Box<dyn std::error::Error>> {
        self.persist_session()
    }

    fn engine_session(&self) -> &runtime::Session {
        self.runtime.session()
    }

    fn adopt_engine_session(&mut self, session: runtime::Session) {
        *self.runtime.session_mut() = session;
    }
}

/// Backend "context window exceeded" detection shared by the reactive compact-and-retry
/// paths (the interactive REPL in `main.rs` and the engine hosts here). String-level on
/// purpose: by the time errors leave the runtime they are boxed and stringified. The
/// "no parseable body" marker covers OpenAI-compat backends that answer an oversized
/// request with a 400 and an unparseable body instead of a proper context-length error.
///
/// The marker list is a deliberately NARROWER cousin of `CONTEXT_WINDOW_ERROR_MARKERS`
/// in `api/src/error.rs`: there the broad markers ("prompt tokens", "configured limit",
/// "messages resulted in", …) are safe because they are gated on HTTP 400/413/422; here
/// we only have a flat string, so we keep the phrasings that unambiguously mean overflow
/// (OpenAI/vLLM "maximum context length", Anthropic "prompt is too long", llama.cpp
/// "exceeds the available context size", …). A false positive costs a wasted compaction
/// round and a degraded-history retry, so precision beats recall.
pub(crate) fn is_context_window_error(message: &str) -> bool {
    if message.contains("context_window") || message.contains("no parseable body") {
        return true;
    }
    const MARKERS: &[&str] = &[
        "maximum context length",
        "context window",
        "context length",
        "too many tokens",
        "prompt is too long",
        "input is too long",
        "input tokens exceed",
        "request is too large",
        "exceeds the available context size",
    ];
    let lower = message.to_lowercase();
    MARKERS.iter().any(|marker| lower.contains(marker))
}

fn run_prompt_with_host<H: EngineHost>(
    host: &mut H,
    blocks: Vec<ContentBlock>,
) -> Result<ClawEngineResponse, Box<dyn std::error::Error>> {
    run_prompt_with_host_and_event_sink(host, blocks, None)
}

fn run_prompt_with_host_and_event_sink<H: EngineHost>(
    host: &mut H,
    blocks: Vec<ContentBlock>,
    mut event_sink: Option<&mut dyn FnMut(&AssistantEvent)>,
) -> Result<ClawEngineResponse, Box<dyn std::error::Error>> {
    // Reactive compact-and-retry (window-agnostic safety net, mirrors the interactive
    // REPL recovery in `main.rs`): when the backend rejects the request as over its
    // context window, fold older messages out of the host's stored session and retry
    // the same turn. Progressive rounds preserve fewer recent messages each time
    // (4 → 2 → 1 → 0), trading continuity for a smaller payload until it fits.
    // Works without knowing the window size — the backend's own rejection is the signal.
    const PRESERVE_SCHEDULE: [usize; 4] = [4, 2, 1, 0];
    let mut schedule_pos = 0usize;
    // Total messages folded by reactive rounds, reported to the caller on success.
    let mut reactive_removed = 0usize;

    let workspace_root = host.workspace_root().map(Path::to_path_buf);
    let _workspace_guard = runtime::scoped_workspace_root(workspace_root.clone());
    // Resolve the filesystem policy (Security panel `filesystemMode` + trustedRoots)
    // once per run so the dedicated file tools honor it, not just the bash sandbox.
    let _fs_policy_guard = runtime::scoped_filesystem_policy(Some(
        runtime::load_filesystem_policy_for(workspace_root.as_deref()),
    ));

    loop {
        let (mut runtime, hook_abort_monitor) = host.prepare_engine_runtime(false)?;
        let mut permission_prompter = crate::CliPermissionPrompter::new(host.permission_mode());

        // The current turn is carried as content blocks (text + any image attachments) so a
        // vision backend receives the images; the text-only callers wrap input in one Text
        // block. Cloned because a compact-and-retry round re-sends the same turn. The event
        // sink is manually reborrowed per iteration (a plain move would end the loop at one pass).
        let sink: Option<&mut dyn FnMut(&AssistantEvent)> = match event_sink.as_mut() {
            Some(sink) => Some(&mut **sink),
            None => None,
        };
        let result = runtime.run_turn_blocks_with_event_sink(
            blocks.clone(),
            Some(&mut permission_prompter),
            sink,
        );

        hook_abort_monitor.stop();

        let error = match result {
            Ok(summary) => {
                host.replace_engine_runtime(runtime)?;
                host.persist_engine_session()?;
                let mut response =
                    ClawEngineResponse::from_turn_summary(host.model(), &summary);
                if reactive_removed > 0 {
                    // Fold the reactive rounds into the compaction report (the proactive
                    // in-turn compaction may have fired on the retry as well — sum both).
                    let removed = reactive_removed
                        + response
                            .auto_compaction
                            .as_ref()
                            .map_or(0, |c| c.removed_messages);
                    response.auto_compaction = Some(ClawEngineAutoCompaction {
                        removed_messages: removed,
                        notice: format_reactive_compaction_notice(removed),
                        reactive: true,
                    });
                }
                return Ok(response);
            }
            Err(error) => {
                // On the success path `replace_engine_runtime` shuts down the OLD runtime's
                // plugins; on an errored turn that swap never happens and this freshly built
                // runtime is dropped instead. Shut its plugins down here so a failed turn
                // doesn't leak plugin processes (one per failed request otherwise).
                let _ = runtime.shutdown_plugins();
                error
            }
        };

        if !is_context_window_error(&error.to_string()) {
            return Err(error.into());
        }

        // Compact the host's stored (pre-turn) session. Walk the schedule until a round
        // actually removes messages — retrying an identical request is pointless.
        let mut compaction = None;
        while schedule_pos < PRESERVE_SCHEDULE.len() {
            let preserve = PRESERVE_SCHEDULE[schedule_pos];
            schedule_pos += 1;
            let result = runtime::trident::trident_compact_session(
                host.engine_session(),
                runtime::CompactionConfig {
                    preserve_recent_messages: preserve,
                    max_estimated_tokens: 0,
                },
                &runtime::trident::TridentConfig::default(),
            );
            if result.removed_message_count > 0 {
                compaction = Some(result);
                break;
            }
        }
        let Some(compaction) = compaction else {
            // Schedule exhausted or nothing left to fold — surface the original error.
            return Err(error.into());
        };
        // Report the honest session-size delta: trident's `removed_message_count` counts
        // its own fold operations, not messages (a 10-message history folded into one
        // summary reported "1"), which understates the user-facing notice.
        let removed = host
            .engine_session()
            .messages
            .len()
            .saturating_sub(compaction.compacted_session.messages.len())
            .max(compaction.removed_message_count);
        eprintln!(
            "cloudling engine: context window exceeded; reactive compaction folded {removed} messages, retrying"
        );
        reactive_removed += removed;
        host.adopt_engine_session(compaction.compacted_session);
    }
}

/// Standalone engine host for non-REPL callers.
///
/// This is the first server-ready host shape. It creates the same runtime stack
/// as `LiveCli`, but does not carry prompt history, startup banners, line editor
/// state, or other terminal-only UI concerns.
pub(crate) struct ClawEngineSession {
    model: String,
    // Whether the runtime exposes tools to the model. Stored so every per-turn
    // runtime rebuild (`prepare_engine_runtime`) honors it — a tools-disabled
    // session (e.g. the UI title endpoint) must stay tools-disabled for the
    // actual prompt run, not just for the constructor's initial runtime.
    enable_tools: bool,
    allowed_tools: Option<crate::AllowedToolSet>,
    permission_mode: PermissionMode,
    system_prompt: Vec<String>,
    runtime: crate::BuiltRuntime,
    session: crate::SessionHandle,
    persist_session: bool,
    working_dir: PathBuf,
    // Kept alive so the per-request temp workspace is removed when the session drops.
    workspace_tempdir: Option<TempDir>,
    // Turn-level cancellation. Tripped by the streaming layer when the client
    // disconnects (OpenAI-serve path), and checked by the conversation loop between
    // steps so a disconnected client stops the agent instead of running on in the
    // background. Reused as the runtime's abort signal in `prepare_engine_runtime`.
    abort_signal: runtime::HookAbortSignal,
}

impl ClawEngineSession {
    /// Ephemeral (non-persistent) session seeded with prior conversation history
    /// and optional extra system-prompt sections.
    ///
    /// Used by the stateless OpenAI-compat path: the client re-sends the whole
    /// transcript on every request, so we seed the runtime session with that
    /// prior history (letting the existing auto-compaction run over it) and
    /// append any client `system` messages to the system prompt so they live in
    /// the non-compacted system channel. Nothing is persisted between requests.
    pub(crate) fn new_ephemeral_with_context(
        model: String,
        enable_tools: bool,
        allowed_tools: Option<crate::AllowedToolSet>,
        permission_mode: PermissionMode,
        seed_history: Vec<ConversationMessage>,
        extra_system_prompt: Vec<String>,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let mut system_prompt = crate::build_system_prompt(&model, permission_mode)?;
        system_prompt.extend(extra_system_prompt);
        let workspace_tempdir = tempfile::Builder::new().prefix("cloudling-ws-").tempdir()?;
        let working_dir = workspace_tempdir.path().to_path_buf();
        let mut session_state = crate::new_cli_session()?;
        // Seed prior turns directly on the in-memory session. The ephemeral
        // session has no persistence path, so this never touches disk.
        session_state.messages = seed_history;
        let session = crate::create_managed_session_handle(&session_state.session_id)?;
        let runtime = crate::build_runtime(
            session_state,
            &session.id,
            model.clone(),
            system_prompt.clone(),
            enable_tools,
            false,
            allowed_tools.clone(),
            permission_mode,
            None,
        )?;

        Ok(Self {
            model,
            enable_tools,
            allowed_tools,
            permission_mode,
            system_prompt,
            runtime,
            session,
            persist_session: false,
            working_dir,
            workspace_tempdir: Some(workspace_tempdir),
            abort_signal: runtime::HookAbortSignal::new(),
        })
    }

    /// Handle to this session's turn-level cancellation signal. The streaming
    /// (OpenAI-serve) layer keeps a clone and trips it when the client disconnects;
    /// the conversation loop checks the same signal between steps.
    pub(crate) fn abort_signal(&self) -> runtime::HookAbortSignal {
        self.abort_signal.clone()
    }

    pub(crate) fn run_prompt_json(
        &mut self,
        input: &str,
    ) -> Result<ClawEngineResponse, Box<dyn std::error::Error>> {
        run_prompt_with_host(self, vec![ContentBlock::Text { text: input.to_string() }])
    }

    pub(crate) fn run_prompt_json_with_event_sink(
        &mut self,
        input: &str,
        event_sink: &mut dyn FnMut(&AssistantEvent),
    ) -> Result<ClawEngineResponse, Box<dyn std::error::Error>> {
        run_prompt_with_host_and_event_sink(
            self,
            vec![ContentBlock::Text { text: input.to_string() }],
            Some(event_sink),
        )
    }

    /// Run a turn whose user message is given as explicit content blocks (text + image
    /// attachments). Used by the OpenAI-serve path when the current turn carries images.
    pub(crate) fn run_prompt_json_blocks_with_event_sink(
        &mut self,
        blocks: Vec<ContentBlock>,
        event_sink: &mut dyn FnMut(&AssistantEvent),
    ) -> Result<ClawEngineResponse, Box<dyn std::error::Error>> {
        run_prompt_with_host_and_event_sink(self, blocks, Some(event_sink))
    }
}

impl EngineHost for ClawEngineSession {
    fn model(&self) -> &str {
        &self.model
    }

    fn permission_mode(&self) -> PermissionMode {
        self.permission_mode
    }

    fn prepare_engine_runtime(
        &self,
        emit_output: bool,
    ) -> Result<(crate::BuiltRuntime, crate::HookAbortMonitor), Box<dyn std::error::Error>> {
        let hook_abort_signal = self.abort_signal.clone();
        let mut runtime = crate::build_runtime(
            self.runtime.session().clone(),
            &self.session.id,
            self.model.clone(),
            self.system_prompt.clone(),
            self.enable_tools,
            emit_output,
            self.allowed_tools.clone(),
            self.permission_mode,
            None,
        )?
        .with_hook_abort_signal(hook_abort_signal.clone());
        // Stateless serve: each request is a fresh, re-seeded session, so trigger auto-compaction
        // on the current context size (latest model call's input), not the cumulative sum across
        // the agentic loop — otherwise a tool-heavy turn fires compaction while the model window
        // is far from full (the cumulative sum of many small steps crosses the threshold).
        runtime.set_auto_compaction_use_latest_turn(true);
        let hook_abort_monitor = crate::HookAbortMonitor::spawn(hook_abort_signal);

        Ok((runtime, hook_abort_monitor))
    }

    fn replace_engine_runtime(
        &mut self,
        runtime: crate::BuiltRuntime,
    ) -> Result<(), Box<dyn std::error::Error>> {
        self.runtime.shutdown_plugins()?;
        self.runtime = runtime;
        Ok(())
    }

    fn persist_engine_session(&self) -> Result<(), Box<dyn std::error::Error>> {
        if self.persist_session {
            self.runtime.session().save_to_path(&self.session.path)?;
        }
        Ok(())
    }

    fn workspace_root(&self) -> Option<&Path> {
        Some(&self.working_dir)
    }

    fn engine_session(&self) -> &runtime::Session {
        self.runtime.session()
    }

    fn adopt_engine_session(&mut self, session: runtime::Session) {
        *self.runtime.session_mut() = session;
    }
}

/// Execute one prompt through the existing CLI runtime state and return the
/// reusable engine response.
///
/// This remains the CLI-facing wrapper, while the prompt execution itself now
/// goes through `EngineHost`. That keeps the CLI behavior stable and prepares
/// the same engine path for a future HTTP/OpenAI-compatible host.
pub(crate) fn run_cli_prompt_json(
    cli: &mut crate::LiveCli,
    input: &str,
) -> Result<ClawEngineResponse, Box<dyn std::error::Error>> {
    run_prompt_with_host(cli, vec![ContentBlock::Text { text: input.to_string() }])
}

#[must_use]
pub fn final_assistant_text(summary: &TurnSummary) -> String {
    summary
        .assistant_messages
        .last()
        .map(|message| {
            message
                .blocks
                .iter()
                .filter_map(|block| match block {
                    ContentBlock::Text { text } => Some(text.as_str()),
                    _ => None,
                })
                .collect::<Vec<_>>()
                .join("")
        })
        .unwrap_or_default()
}

#[must_use]
pub fn collect_tool_uses(summary: &TurnSummary) -> Vec<Value> {
    summary
        .assistant_messages
        .iter()
        .flat_map(|message| message.blocks.iter())
        .filter_map(|block| match block {
            ContentBlock::ToolUse { id, name, input } => Some(json!({
                "id": id,
                "name": name,
                "input": input,
            })),
            _ => None,
        })
        .collect()
}

#[must_use]
pub fn collect_tool_results(summary: &TurnSummary) -> Vec<Value> {
    summary
        .tool_results
        .iter()
        .flat_map(|message| message.blocks.iter())
        .filter_map(|block| match block {
            ContentBlock::ToolResult {
                tool_use_id,
                tool_name,
                output,
                is_error,
            } => Some(json!({
                "tool_use_id": tool_use_id,
                "tool_name": tool_name,
                "output": output,
                "is_error": is_error,
            })),
            _ => None,
        })
        .collect()
}

#[must_use]
pub fn collect_prompt_cache_events(summary: &TurnSummary) -> Vec<Value> {
    summary
        .prompt_cache_events
        .iter()
        .map(|event| {
            json!({
                "unexpected": event.unexpected,
                "reason": event.reason,
                "previous_cache_read_input_tokens": event.previous_cache_read_input_tokens,
                "current_cache_read_input_tokens": event.current_cache_read_input_tokens,
                "token_drop": event.token_drop,
            })
        })
        .collect()
}

#[must_use]
pub fn format_auto_compaction_notice(removed_message_count: usize) -> String {
    format!(
        "Auto-compacted session: removed {removed_message_count} older messages to keep context within the model window."
    )
}

/// Notice for the *reactive* recovery: the backend rejected the request as over its
/// context window, older messages were folded, and the turn was retried successfully.
#[must_use]
pub fn format_reactive_compaction_notice(removed_message_count: usize) -> String {
    format!(
        "Context exceeded the model window; auto-compacted {removed_message_count} older messages and retried."
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use runtime::{ContentBlock, ConversationMessage, TokenUsage, TurnSummary};

    fn sample_usage() -> TokenUsage {
        TokenUsage {
            input_tokens: 10,
            output_tokens: 5,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
        }
    }

    #[test]
    fn context_window_error_detection_covers_real_backend_phrasings() {
        // Real-world rejections that MUST trigger the reactive compact-and-retry.
        for message in [
            "api returned 400 Bad Request: This model's maximum context length is 200000 tokens, but your request used 230000 tokens.", // OpenAI/vLLM
            "api returned 400 Bad Request: the request exceeds the available context size, try increasing it", // llama.cpp
            "api returned 400 Bad Request: prompt is too long: 210000 tokens > 200000 maximum", // Anthropic-style
            "Context window blocked: estimated 230000 tokens over the 200000 limit",  // CLI preflight
            "context_window_blocked",
            "api returned 400 Bad Request ...: no parseable body",
        ] {
            assert!(is_context_window_error(message), "missed: {message}");
        }
        // Ordinary failures that must NOT trigger a pointless compaction round.
        for message in [
            "api failed after 4 attempts: api returned 429 Too Many Requests: provider rate-limited the request",
            "api returned 500 Internal Server Error: something went wrong",
            "connection refused",
        ] {
            assert!(!is_context_window_error(message), "false positive: {message}");
        }
    }

    #[test]
    fn response_extracts_final_text_and_tool_events() {
        let summary = TurnSummary {
            assistant_messages: vec![
                ConversationMessage::assistant(vec![ContentBlock::ToolUse {
                    id: "toolu_1".to_string(),
                    name: "read_file".to_string(),
                    input: r#"{"file_path":"README.md"}"#.to_string(),
                }]),
                ConversationMessage::assistant(vec![ContentBlock::Text {
                    text: "done".to_string(),
                }]),
            ],
            tool_results: vec![ConversationMessage::tool_result(
                "toolu_1",
                "read_file",
                "ok",
                false,
            )],
            prompt_cache_events: Vec::new(),
            iterations: 2,
            usage: sample_usage(),
            auto_compaction: None,
        };

        let response = ClawEngineResponse::from_turn_summary("openai/local", &summary);

        assert_eq!(response.message, "done");
        assert_eq!(response.model, "openai/local");
        assert_eq!(response.iterations, 2);
        assert_eq!(response.tool_uses.len(), 1);
        assert_eq!(response.tool_results.len(), 1);
        assert_eq!(response.usage.input_tokens, 10);
        assert_eq!(response.usage.output_tokens, 5);
    }
}
