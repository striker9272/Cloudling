//! Chat-completions endpoint (sync + streaming), SSE translation, and the mapping
//! from an incoming OpenAI `messages` array onto a seedable stateless conversation.
//!
//! Split out of the `openai_server` root for navigation only — behavior is unchanged.

use std::collections::HashMap;
use std::convert::Infallible;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use axum::response::sse::{Event, KeepAlive, Sse};
use axum::response::{IntoResponse, Response};
use axum::Json;
use runtime::{AssistantEvent, ContentBlock, ConversationMessage};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::sync::mpsc;
use tokio_stream::wrappers::UnboundedReceiverStream;

use super::{create_engine_session, OpenAiServerState};

#[derive(Debug, Deserialize)]
pub(super) struct ChatCompletionRequest {
    model: Option<String>,
    messages: Vec<ChatMessage>,
    #[serde(default)]
    stream: bool,
}

#[derive(Debug, Deserialize)]
struct ChatMessage {
    role: String,
    content: Value,
}

#[derive(Serialize)]
struct ChatCompletionResponse {
    id: String,
    object: &'static str,
    created: u64,
    model: String,
    choices: Vec<ChatCompletionChoice>,
    usage: ChatCompletionUsage,
}

#[derive(Serialize)]
struct ChatCompletionChoice {
    index: u32,
    message: ChatCompletionMessage,
    finish_reason: &'static str,
}

#[derive(Serialize)]
struct ChatCompletionMessage {
    role: &'static str,
    content: String,
}

#[derive(Serialize)]
struct ChatCompletionUsage {
    prompt_tokens: u32,
    completion_tokens: u32,
    total_tokens: u32,
}

#[derive(Serialize)]
struct ChatCompletionChunk {
    id: String,
    object: &'static str,
    created: u64,
    model: String,
    choices: Vec<ChatCompletionChunkChoice>,
    // Present only on the final usage chunk (OpenAI `stream_options.include_usage` style);
    // omitted from every content chunk. The UI reads `prompt_tokens` as the live context size.
    #[serde(skip_serializing_if = "Option::is_none")]
    usage: Option<ChatCompletionUsage>,
    // Set only on the error chunk. Lets the built-in UI render its error box; the same
    // chunk also carries the message in `delta.content`, so plain OpenAI clients (Open
    // WebUI included) still show the error as assistant text instead of a blank turn.
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<ErrorBody>,
}

#[derive(Serialize)]
struct ChatCompletionChunkChoice {
    index: u32,
    delta: ChatCompletionDelta,
    finish_reason: Option<&'static str>,
}

#[derive(Default, Serialize)]
struct ChatCompletionDelta {
    #[serde(skip_serializing_if = "Option::is_none")]
    role: Option<&'static str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    content: Option<String>,
}

#[derive(Serialize)]
struct ErrorEnvelope {
    error: ErrorBody,
}

#[derive(Serialize)]
struct ErrorBody {
    message: String,
    #[serde(rename = "type")]
    kind: &'static str,
}

pub(super) async fn chat_completions(
    State(state): State<Arc<OpenAiServerState>>,
    headers: HeaderMap,
    Json(request): Json<ChatCompletionRequest>,
) -> Response {
    // The built-in UI tags its requests with `X-Clab-UI` so AskUserQuestion can render an
    // interactive widget; other clients (OWUI, raw API) omit it and keep the stdin/
    // "unavailable" fallback. Header lookups are case-insensitive.
    let interactive_ui = headers.contains_key("x-clab-ui");
    if request.stream {
        return stream_chat_completions(state, request, interactive_ui);
    }

    let conversation = match stateless_conversation_from_messages(&request.messages) {
        Ok(conversation) => conversation,
        Err(message) => {
            return error_response(StatusCode::BAD_REQUEST, &message, "invalid_request")
        }
    };

    let state_for_task = state.clone();
    let result = tokio::task::spawn_blocking(
        move || -> Result<(crate::engine::ClawEngineResponse, u32), String> {
            let StatelessConversation {
                input,
                input_images,
                history,
                system_additions,
            } = conversation;
            let mut session = create_engine_session(
                state_for_task.backend_model(),
                true,
                state_for_task.allowed_tools.clone(),
                state_for_task.permission_mode(),
                (history, system_additions),
            )
            .map_err(|error| error.to_string())?;
            // Capture the LAST model call's context size (evaluated input + cache), the same
            // figure the streaming path reports, so the token counter matches across modes.
            // `response.usage` is cumulative across the agentic loop and over-counts here.
            let last_ctx = std::rc::Rc::new(std::cell::Cell::new(0u32));
            let last_ctx_sink = last_ctx.clone();
            let mut event_sink = |event: &AssistantEvent| {
                if let AssistantEvent::Usage(u) = event {
                    last_ctx_sink.set(
                        u.input_tokens
                            .saturating_add(u.cache_creation_input_tokens)
                            .saturating_add(u.cache_read_input_tokens),
                    );
                }
            };
            let response = if input_images.is_empty() {
                session.run_prompt_json_with_event_sink(&input, &mut event_sink)
            } else {
                session.run_prompt_json_blocks_with_event_sink(
                    current_turn_blocks(input, input_images),
                    &mut event_sink,
                )
            }
            .map_err(|error| error.to_string())?;
            Ok((response, last_ctx.get()))
        },
    )
    .await;

    let (engine_response, last_ctx) = match result {
        Ok(Ok(pair)) => pair,
        Ok(Err(error)) => {
            eprintln!("claw openai-serve: engine error: {error}");
            return error_response(StatusCode::INTERNAL_SERVER_ERROR, &error, "engine_error");
        }
        Err(error) => {
            eprintln!("claw openai-serve: task error: {error}");
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                &error.to_string(),
                "task_error",
            );
        }
    };

    let created = now_unix();
    // Mirror the streaming counter: prefer the last call's context size; fall back to the
    // cumulative input figure if no Usage event was observed this turn.
    let prompt_tokens = if last_ctx > 0 {
        last_ctx
    } else {
        engine_response.usage.input_tokens
    };
    let total_tokens = prompt_tokens + engine_response.usage.output_tokens;

    // Surface auto-compaction to the client: the engine drops older messages mid-turn to
    // keep context within the model window, but that event is otherwise invisible over the
    // OpenAI wire. Append the notice to the assistant text and log it server-side so the
    // behaviour is observable in both the chat and the service logs.
    let mut content = engine_response.message;
    if let Some(compaction) = &engine_response.auto_compaction {
        eprintln!(
            "claw openai-serve: auto-compaction fired (removed {} messages)",
            compaction.removed_messages
        );
        content.push_str(&format!("\n\n> {}", compaction.notice));
    }

    Json(ChatCompletionResponse {
        id: next_completion_id(created),
        object: "chat.completion",
        created,
        model: request
            .model
            .unwrap_or_else(|| state.served_model_id()),
        choices: vec![ChatCompletionChoice {
            index: 0,
            message: ChatCompletionMessage {
                role: "assistant",
                content,
            },
            finish_reason: "stop",
        }],
        usage: ChatCompletionUsage {
            prompt_tokens,
            completion_tokens: engine_response.usage.output_tokens,
            total_tokens,
        },
    })
    .into_response()
}

fn stream_chat_completions(
    state: Arc<OpenAiServerState>,
    request: ChatCompletionRequest,
    interactive_ui: bool,
) -> Response {
    let conversation = match stateless_conversation_from_messages(&request.messages) {
        Ok(conversation) => conversation,
        Err(message) => {
            return error_response(StatusCode::BAD_REQUEST, &message, "invalid_request")
        }
    };

    let response_model = request
        .model
        .unwrap_or_else(|| state.served_model_id());
    let backend_model = state.backend_model();
    let allowed_tools = state.allowed_tools.clone();
    let permission_mode = state.permission_mode();
    // Whether to forward the model's reasoning to the client as a collapsible block.
    // Stored as a UI preference (`ui_kv.show_reasoning`); defaults ON. Non-UI deployments
    // (no dialog store) also default ON. Read per request so the toggle applies live.
    let forward_reasoning = state
        .dialog_store
        .as_ref()
        .and_then(|store| store.get_kv("show_reasoning").ok().flatten())
        .map(|value| value.trim() != "false")
        .unwrap_or(true);
    let created = now_unix();
    let id = next_completion_id(created);

    let (sender, receiver) = mpsc::unbounded_channel::<Result<Event, Infallible>>();
    let stream = UnboundedReceiverStream::new(receiver);

    tokio::task::spawn_blocking(move || {
        let _ = sender.send(openai_sse_role_chunk(&id, created, &response_model));

        // Track the LATEST model call's prompt size = the full context at the end of the turn.
        // Declared out here (not inside the `result` block) so the final usage chunk can read it.
        let last_ctx = std::rc::Rc::new(std::cell::Cell::new(0u32));
        // Terminal stop reason from the backend (normalized: "end_turn"/"length"/...), captured
        // off the event stream like `last_ctx`, so the final chunk can report the real
        // finish_reason ("length" when the answer was truncated) instead of a hardcoded "stop".
        let last_stop_reason = std::rc::Rc::new(std::cell::RefCell::new(None::<String>));
        // Progressive reasoning streaming (see the event sink): whether a
        // `<details type="reasoning">` block is currently open, and whether any reasoning was
        // streamed as deltas (so the trailing full `Thinking` block is not sent twice).
        let reasoning_open = std::rc::Rc::new(std::cell::Cell::new(false));
        let reasoning_streamed = std::rc::Rc::new(std::cell::Cell::new(false));

        let result = {
            let StatelessConversation {
                input,
                input_images,
                history,
                system_additions,
            } = conversation;
            let mut session = match create_engine_session(
                backend_model,
                true,
                allowed_tools,
                permission_mode,
                (history, system_additions),
            ) {
                Ok(session) => session,
                Err(error) => {
                    eprintln!("claw openai-serve: stream session error: {error}");
                    let _ = sender.send(openai_sse_error_chunk(
                        &id,
                        created,
                        &response_model,
                        &error.to_string(),
                    ));
                    let _ = sender.send(openai_sse_done());
                    return;
                }
            };

            let abort_signal = session.abort_signal();
            let last_ctx_sink = last_ctx.clone();
            let last_stop_reason_sink = last_stop_reason.clone();
            let reasoning_ctx = ReasoningCtx {
                id: id.clone(),
                created,
                model: response_model.clone(),
                forward_reasoning,
                open: reasoning_open.clone(),
                streamed: reasoning_streamed.clone(),
            };
            let mut tool_inputs = HashMap::<String, String>::new();
            // Client-disconnect detection: once the SSE receiver is dropped (tab closed / Stop
            // pressed), `send` fails. Trip the turn-level abort so the agent loop halts between
            // steps instead of running on in the background — the OWUI pattern (client gone -> stop).
            let send = |chunk: Result<Event, Infallible>| {
                if sender.send(chunk).is_err() {
                    abort_signal.abort();
                }
            };
            let mut event_sink = |event: &AssistantEvent| {
                if let AssistantEvent::Usage(u) = event {
                    last_ctx_sink.set(
                        u.input_tokens
                            .saturating_add(u.cache_creation_input_tokens)
                            .saturating_add(u.cache_read_input_tokens),
                    );
                }
                if let AssistantEvent::StopReason(reason) = event {
                    last_stop_reason_sink.replace(reason.clone());
                }
                // Stream the model's reasoning as a progressive `<details type="reasoning">`
                // block (open on the first delta, append each chunk, close before answer/tool
                // content). Returns true when the event was a reasoning delta fully handled
                // there, so it is not also emitted as answer content.
                if relay_reasoning_event(event, &reasoning_ctx, &send) {
                    return;
                }
                if let Some(chunk) = assistant_event_to_openai_sse_chunk(
                    &id,
                    created,
                    &response_model,
                    event,
                    &mut tool_inputs,
                    forward_reasoning,
                ) {
                    send(chunk);
                }
            };

            // Built-in UI only: install an ambient provider so AskUserQuestion renders an
            // interactive widget and blocks for the user's click (see `ask_via_ui`). It runs
            // on THIS spawn_blocking thread during tool execution, so the thread-local install
            // is correct; the guard restores the prior provider when the turn ends. Without
            // the marker we install `None` → the tool keeps its stdin/"unavailable" fallback.
            let _prompt_guard = if interactive_ui {
                let psender = sender.clone();
                let pstate = state.clone();
                let pabort = abort_signal.clone();
                let pid = id.clone();
                let pmodel = response_model.clone();
                tools::scoped_user_prompt_provider(Some(Box::new(
                    move |question: &str, options: Option<&[String]>| {
                        ask_via_ui(
                            &psender, &pstate, &pabort, &pid, created, &pmodel, question, options,
                        )
                    },
                )))
            } else {
                tools::scoped_user_prompt_provider(None)
            };

            if input_images.is_empty() {
                session.run_prompt_json_with_event_sink(&input, &mut event_sink)
            } else {
                session.run_prompt_json_blocks_with_event_sink(
                    current_turn_blocks(input, input_images),
                    &mut event_sink,
                )
            }
        };

        match result {
            Ok(response) => {
                // Surface auto-compaction (older messages dropped mid-turn to keep context within
                // the model window) as a trailing content chunk + server log, so the otherwise
                // invisible event shows up in both the chat and the service logs.
                if let Some(compaction) = &response.auto_compaction {
                    eprintln!(
                        "claw openai-serve: auto-compaction fired (removed {} messages)",
                        compaction.removed_messages
                    );
                    let _ = sender.send(openai_sse_chunk(
                        &id,
                        created,
                        &response_model,
                        Some(format!("\n\n> {}", compaction.notice)),
                        None,
                    ));
                }
                // prompt_tokens = context size = the LAST model call's prompt (evaluated input +
                // cache-created + cache-read), captured from the final Usage event. `response.usage`
                // is cumulative across the agentic loop's calls, so it over-counts multi-step turns.
                let _ = sender.send(openai_sse_usage_chunk(
                    &id,
                    created,
                    &response_model,
                    last_ctx.get(),
                    response.usage.output_tokens,
                ));
                // Report the backend's real terminal reason: a truncated answer ("length")
                // must not masquerade as a clean "stop" — the UI flags it for regeneration.
                let finish = if last_stop_reason.borrow().as_deref() == Some("length") {
                    "length"
                } else {
                    "stop"
                };
                let _ = sender.send(openai_sse_chunk(
                    &id,
                    created,
                    &response_model,
                    None,
                    Some(finish),
                ));
            }
            Err(error) => {
                eprintln!("claw openai-serve: stream engine error: {error}");
                let _ = sender.send(openai_sse_error_chunk(
                    &id,
                    created,
                    &response_model,
                    &error.to_string(),
                ));
            }
        }

        let _ = sender.send(openai_sse_done());
    });

    Sse::new(stream)
        .keep_alive(KeepAlive::default())
        .into_response()
}

/// Per-turn context for streaming the model's reasoning as a progressive
/// `<details type="reasoning">` block (see [`relay_reasoning_event`]). `open`/`streamed`
/// are shared with the turn so state survives across event-sink calls.
struct ReasoningCtx {
    id: String,
    created: u64,
    model: String,
    /// Mirrors the `show_reasoning` UI toggle; when false, reasoning is not forwarded.
    forward_reasoning: bool,
    /// Whether a `<details type="reasoning">` block is currently open.
    open: std::rc::Rc<std::cell::Cell<bool>>,
    /// Whether any reasoning was streamed as deltas (so the trailing full `Thinking`
    /// event is not also sent as a second block).
    streamed: std::rc::Rc<std::cell::Cell<bool>>,
}

/// Relay one assistant event's reasoning, OpenWebUI-style: open the block on the first
/// `ThinkingDelta`, append each delta, and close it before the answer text / a tool block /
/// the end of the turn. The trailing full `Thinking` event is only a fallback for backends
/// that never streamed deltas. Returns `true` when the event was a reasoning delta fully
/// handled here (the caller must then skip emitting it as answer content); `false` otherwise
/// (it may still have emitted a closing chunk before falling through).
fn relay_reasoning_event(
    event: &AssistantEvent,
    ctx: &ReasoningCtx,
    send: &impl Fn(Result<Event, Infallible>),
) -> bool {
    if ctx.forward_reasoning {
        match event {
            AssistantEvent::ThinkingDelta(delta) if !delta.is_empty() => {
                if !ctx.open.get() {
                    ctx.open.set(true);
                    ctx.streamed.set(true);
                    send(openai_sse_chunk(
                        &ctx.id,
                        ctx.created,
                        &ctx.model,
                        Some(reasoning_open_chunk()),
                        None,
                    ));
                }
                send(openai_sse_chunk(
                    &ctx.id,
                    ctx.created,
                    &ctx.model,
                    Some(escape_html_text(delta)),
                    None,
                ));
                return true;
            }
            AssistantEvent::Thinking { thinking, .. } if !thinking.is_empty() => {
                // Already streamed via deltas → closed by the transition branch below;
                // don't resend the whole block.
                if ctx.streamed.get() {
                    return true;
                }
                send(openai_sse_chunk(
                    &ctx.id,
                    ctx.created,
                    &ctx.model,
                    Some(openwebui_reasoning_details(thinking)),
                    None,
                ));
                return true;
            }
            _ => {}
        }
    }
    // Close an open reasoning block before the answer text, a tool block, or the end.
    if ctx.open.get()
        && matches!(
            event,
            AssistantEvent::TextDelta(_)
                | AssistantEvent::ToolUse { .. }
                | AssistantEvent::ToolResult { .. }
                | AssistantEvent::MessageStop
        )
    {
        ctx.open.set(false);
        send(openai_sse_chunk(
            &ctx.id,
            ctx.created,
            &ctx.model,
            Some(reasoning_close_chunk()),
            None,
        ));
    }
    false
}

/// Drive one interactive `AskUserQuestion` round-trip for the built-in UI: emit a question
/// widget into the SSE stream, then block this `spawn_blocking` thread until the browser POSTs
/// an answer to `/ui/answer`, the turn is aborted (Stop / tab closed), or a safety cap
/// elapses. Returns the chosen answer, or `None` to fall back to the "unavailable" result.
#[allow(clippy::too_many_arguments)]
fn ask_via_ui(
    sender: &mpsc::UnboundedSender<Result<Event, Infallible>>,
    state: &Arc<OpenAiServerState>,
    abort: &runtime::HookAbortSignal,
    id: &str,
    created: u64,
    model: &str,
    question: &str,
    options: Option<&[String]>,
) -> Option<String> {
    static SEQ: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
    let q_id = format!(
        "{id}:{}",
        SEQ.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
    );
    let rx = state.register_pending_question(q_id.clone());
    // Emit the widget. If the client is already gone, the send fails — bail to the fallback.
    if sender
        .send(ask_widget_chunk(id, created, model, &q_id, question, options))
        .is_err()
    {
        state.clear_pending_question(&q_id);
        return None;
    }
    // Wait for the answer, polling so an aborted turn is noticed too. The hard cap keeps a
    // forgotten/closed tab from pinning this blocking thread forever.
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(600);
    let mut ticks: u32 = 0;
    loop {
        match rx.recv_timeout(std::time::Duration::from_millis(200)) {
            Ok(answer) => return Some(answer),
            Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                ticks += 1;
                // ~every 2s, probe the SSE connection with an ignored comment line: nothing is
                // sent through our channel during the wait, so a closed tab / Stop would otherwise
                // go unnoticed until the cap. A failed send means the client is gone — trip the
                // turn abort so the agent loop halts and release the pending slot.
                if ticks % 10 == 0
                    && sender
                        .send(Ok(Event::default().comment("await-answer")))
                        .is_err()
                {
                    abort.abort();
                    state.clear_pending_question(&q_id);
                    return None;
                }
                if abort.is_aborted() || std::time::Instant::now() >= deadline {
                    state.clear_pending_question(&q_id);
                    return None;
                }
            }
            Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                state.clear_pending_question(&q_id);
                return None;
            }
        }
    }
}

/// Build the SSE content chunk the built-in UI renders as an interactive question widget
/// (clickable option buttons). Mirrors `openwebui_tool_details`' attribute escaping; the
/// client matches `type="ask"` and reads `id` / `question` / `options` (a JSON array).
fn ask_widget_chunk(
    id: &str,
    created: u64,
    model: &str,
    q_id: &str,
    question: &str,
    options: Option<&[String]>,
) -> Result<Event, Infallible> {
    let options_json =
        serde_json::to_string(options.unwrap_or(&[])).unwrap_or_else(|_| "[]".to_string());
    let markup = format!(
        "\n<details type=\"ask\" done=\"false\" id=\"{}\" question=\"{}\" options=\"{}\">\n</details>\n",
        escape_html_attr(q_id),
        escape_html_attr(question),
        escape_html_attr(&options_json),
    );
    openai_sse_chunk(id, created, model, Some(markup), None)
}

fn assistant_event_to_openai_sse_chunk(
    id: &str,
    created: u64,
    model: &str,
    event: &AssistantEvent,
    tool_inputs: &mut HashMap<String, String>,
    forward_reasoning: bool,
) -> Option<Result<Event, Infallible>> {
    match event {
        AssistantEvent::TextDelta(text) if !text.is_empty() => Some(openai_sse_chunk(
            id,
            created,
            model,
            Some(text.clone()),
            None,
        )),
        // Surface the model's reasoning as a collapsible block so a reasoning-only turn
        // (the model thinks then stops without final text — seen intermittently with some
        // system prompts) is never blank. Gated by the `show_reasoning` UI toggle; models
        // without a thinking mode (or with it disabled on the backend) simply emit none.
        AssistantEvent::Thinking { thinking, .. } if forward_reasoning && !thinking.is_empty() => {
            Some(openai_sse_chunk(
                id,
                created,
                model,
                Some(openwebui_reasoning_details(thinking)),
                None,
            ))
        }
        AssistantEvent::ToolUse {
            id: tool_use_id,
            input,
            ..
        } => {
            tool_inputs.insert(tool_use_id.clone(), input.clone());
            None
        }
        AssistantEvent::ToolResult {
            tool_use_id,
            tool_name,
            output,
            is_error,
        } => {
            // The interactive widget (built-in UI) already shows the AskUserQuestion prompt and
            // the chosen answer; for other clients its result is just the "unavailable" stub.
            // Either way, suppress the redundant tool-call block for it.
            if tool_name == "AskUserQuestion" {
                return None;
            }
            let arguments = tool_inputs
                .get(tool_use_id)
                .map(String::as_str)
                .unwrap_or("{}");
            Some(openai_sse_chunk(
                id,
                created,
                model,
                Some(openwebui_tool_details(
                    tool_use_id,
                    tool_name,
                    arguments,
                    output,
                    *is_error,
                )),
                None,
            ))
        }
        AssistantEvent::MessageStop => None,
        _ => None,
    }
}

fn openwebui_tool_details(
    tool_use_id: &str,
    tool_name: &str,
    arguments: &str,
    output: &str,
    is_error: bool,
) -> String {
    let summary = if is_error {
        "Tool Failed"
    } else {
        "Tool Executed"
    };
    let output_json = serde_json::to_string(output)
        .unwrap_or_else(|error| format!("failed to serialize tool output: {error}"));

    format!(
        "\n<details type=\"tool_calls\" done=\"true\" id=\"{}\" name=\"{}\" arguments=\"{}\">\n<summary>{}</summary>\n{}\n</details>\n",
        escape_html_attr(tool_use_id),
        escape_html_attr(tool_name),
        escape_html_attr(arguments),
        summary,
        escape_html_text(&output_json),
    )
}

/// Render the model's reasoning as a collapsible OpenWebUI-style block. Unlike tool
/// output the thinking is plain text (not JSON), so it is only HTML-escaped — the UI
/// shows it as-is inside a collapsed "Reasoning" section.
fn openwebui_reasoning_details(thinking: &str) -> String {
    format!(
        "\n<details type=\"reasoning\" done=\"true\">\n<summary>Reasoning</summary>\n{}\n</details>\n",
        escape_html_text(thinking),
    )
}

/// Opening of a *progressive* reasoning block (same shape as [`openwebui_reasoning_details`]
/// but left open with `done="false"`). Reasoning text deltas are streamed after this, and the
/// block is closed by [`reasoning_close_chunk`] once the answer/tool content begins.
fn reasoning_open_chunk() -> String {
    "\n<details type=\"reasoning\" done=\"false\">\n<summary>Reasoning</summary>\n".to_string()
}

/// Closing tag for a progressive reasoning block opened by [`reasoning_open_chunk`].
fn reasoning_close_chunk() -> String {
    "\n</details>\n".to_string()
}

fn escape_html_attr(value: &str) -> String {
    escape_html_text(value)
        .replace('\'', "&#39;")
        .replace('"', "&quot;")
}

fn escape_html_text(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

fn openai_sse_role_chunk(id: &str, created: u64, model: &str) -> Result<Event, Infallible> {
    openai_sse_chunk_with_delta(
        id,
        created,
        model,
        ChatCompletionDelta {
            role: Some("assistant"),
            content: None,
        },
        None,
    )
}

fn openai_sse_chunk(
    id: &str,
    created: u64,
    model: &str,
    content: Option<String>,
    finish_reason: Option<&'static str>,
) -> Result<Event, Infallible> {
    openai_sse_chunk_with_delta(
        id,
        created,
        model,
        ChatCompletionDelta {
            role: None,
            content,
        },
        finish_reason,
    )
}

fn openai_sse_chunk_with_delta(
    id: &str,
    created: u64,
    model: &str,
    delta: ChatCompletionDelta,
    finish_reason: Option<&'static str>,
) -> Result<Event, Infallible> {
    sse_json_event(&ChatCompletionChunk {
        id: id.to_string(),
        object: "chat.completion.chunk",
        created,
        model: model.to_string(),
        choices: vec![ChatCompletionChunkChoice {
            index: 0,
            delta,
            finish_reason,
        }],
        usage: None,
        error: None,
    })
}

/// Final stream chunk carrying token usage (OpenAI `include_usage` shape). `prompt_tokens`
/// is the context size the model received this turn — the UI shows it as a live counter.
fn openai_sse_usage_chunk(
    id: &str,
    created: u64,
    model: &str,
    prompt_tokens: u32,
    completion_tokens: u32,
) -> Result<Event, Infallible> {
    sse_json_event(&ChatCompletionChunk {
        id: id.to_string(),
        object: "chat.completion.chunk",
        created,
        model: model.to_string(),
        choices: vec![ChatCompletionChunkChoice {
            index: 0,
            delta: ChatCompletionDelta::default(),
            finish_reason: None,
        }],
        usage: Some(ChatCompletionUsage {
            prompt_tokens,
            completion_tokens,
            total_tokens: prompt_tokens.saturating_add(completion_tokens),
        }),
        error: None,
    })
}

/// Error chunk for the streaming path. Shaped as a normal `chat.completion.chunk` so no
/// client drops it: the message rides in `delta.content` (visible in Open WebUI and any
/// OpenAI client) and in the `error` field (the built-in UI renders its error box). This
/// replaces an off-shape `{error:{…}}` envelope that the UI silently ignored, which left a
/// blank turn whenever the backend was down or a token limit was hit.
fn openai_sse_error_chunk(
    id: &str,
    created: u64,
    model: &str,
    message: &str,
) -> Result<Event, Infallible> {
    sse_json_event(&ChatCompletionChunk {
        id: id.to_string(),
        object: "chat.completion.chunk",
        created,
        model: model.to_string(),
        choices: vec![ChatCompletionChunkChoice {
            index: 0,
            delta: ChatCompletionDelta {
                role: None,
                content: Some(format!("\u{26a0} {message}")),
            },
            finish_reason: Some("stop"),
        }],
        usage: None,
        error: Some(ErrorBody {
            message: message.to_string(),
            kind: "engine_error",
        }),
    })
}

fn openai_sse_done() -> Result<Event, Infallible> {
    Ok(Event::default().data("[DONE]"))
}

fn sse_json_event<T: Serialize>(value: &T) -> Result<Event, Infallible> {
    let data = serde_json::to_string(value).unwrap_or_else(|error| {
        format!(
            r#"{{"error":{{"message":"failed to serialize SSE event: {error}","type":"serialization_error"}}}}"#
        )
    });
    Ok(Event::default().data(data))
}

struct StatelessConversation {
    input: String,
    /// Image URLs attached to the current (last user) turn, in order. Carried
    /// separately so the current turn can be sent as text + image blocks.
    input_images: Vec<String>,
    history: Vec<ConversationMessage>,
    system_additions: Vec<String>,
}

/// Maps an incoming OpenAI `messages` array onto a seedable runtime conversation.
///
/// - `system` messages are hoisted into `system_additions` so they join the
///   non-compacted system channel and survive auto-compaction.
/// - `user` / `assistant` messages become seed `history` (compactable).
/// - The latest `user` message is pulled out as the turn `input`.
/// - Other roles (e.g. `tool`) and assistant tool-call envelopes are folded in
///   as plain assistant text; tool-call machinery is intentionally not rebuilt.
fn stateless_conversation_from_messages(
    messages: &[ChatMessage],
) -> Result<StatelessConversation, String> {
    let last_user_index = messages
        .iter()
        .rposition(|message| message.role.trim().eq_ignore_ascii_case("user"))
        .ok_or_else(|| "messages must include at least one user message".to_string())?;

    let mut history = Vec::new();
    let mut system_additions = Vec::new();
    let mut input = String::new();
    let mut input_images = Vec::new();

    for (index, message) in messages.iter().enumerate() {
        let role = message.role.trim();
        if role.is_empty() {
            return Err("message role must not be empty".to_string());
        }
        let text = message_text(&message.content)?;
        let images = content_image_urls(&message.content);

        if index == last_user_index {
            input = text;
            input_images = images;
            continue;
        }

        if role.eq_ignore_ascii_case("system") {
            if !text.trim().is_empty() {
                system_additions.push(text);
            }
        } else if role.eq_ignore_ascii_case("user") {
            if images.is_empty() {
                history.push(ConversationMessage::user_text(text));
            } else {
                // Prior user turn carried images → preserve them as a blocks message
                // (text + image attachments) so a vision backend still sees the images.
                let mut blocks = Vec::new();
                if !text.is_empty() {
                    blocks.push(ContentBlock::Text { text });
                }
                for url in images {
                    blocks.push(ContentBlock::Image { url });
                }
                history.push(ConversationMessage::user(blocks));
            }
        } else if !text.trim().is_empty() {
            // assistant, tool, or any other role → plain assistant context text.
            history.push(ConversationMessage::assistant(vec![ContentBlock::Text { text }]));
        }
    }

    Ok(StatelessConversation {
        input,
        input_images,
        history,
        system_additions,
    })
}

/// Like [`content_to_text`] but tolerates a missing/`null` content field
/// (e.g. assistant messages that carry only `tool_calls`) by treating it as
/// empty text instead of erroring.
fn message_text(content: &Value) -> Result<String, String> {
    if content.is_null() {
        return Ok(String::new());
    }
    content_to_text(content)
}

fn content_to_text(content: &Value) -> Result<String, String> {
    match content {
        Value::String(text) => Ok(text.clone()),
        Value::Array(items) => {
            let mut parts = Vec::new();
            for item in items {
                let Some(kind) = item.get("type").and_then(Value::as_str) else {
                    continue;
                };
                match kind {
                    "text" => {
                        if let Some(text) = item.get("text").and_then(Value::as_str) {
                            parts.push(text.to_string());
                        }
                    }
                    "image_url" => {
                        parts.push("[image omitted: text-only claw openai-serve]".to_string());
                    }
                    _ => {}
                }
            }
            Ok(parts.join("\n"))
        }
        _ => Err("message content must be a string or OpenAI content array".to_string()),
    }
}

/// Extract image URLs from an OpenAI content value: the `image_url.url` of every
/// `{"type":"image_url","image_url":{"url":...}}` part. Empty for plain-string or
/// imageless content. Paired with [`content_to_text`] to split a message into
/// text + image parts.
fn content_image_urls(content: &Value) -> Vec<String> {
    let Value::Array(items) = content else {
        return Vec::new();
    };
    let mut urls = Vec::new();
    for item in items {
        if item.get("type").and_then(Value::as_str) == Some("image_url") {
            if let Some(url) = item
                .get("image_url")
                .and_then(|image_url| image_url.get("url"))
                .and_then(Value::as_str)
            {
                if !url.is_empty() {
                    urls.push(url.to_string());
                }
            }
        }
    }
    urls
}

/// Build the content blocks for the current turn from its text and image URLs.
/// Always yields at least one block (an empty `Text`) so an image-only turn still runs.
fn current_turn_blocks(input: String, input_images: Vec<String>) -> Vec<ContentBlock> {
    let mut blocks = Vec::new();
    if !input.is_empty() {
        blocks.push(ContentBlock::Text { text: input });
    }
    for url in input_images {
        blocks.push(ContentBlock::Image { url });
    }
    if blocks.is_empty() {
        blocks.push(ContentBlock::Text {
            text: String::new(),
        });
    }
    blocks
}

fn error_response(status: StatusCode, message: &str, kind: &'static str) -> Response {
    (
        status,
        Json(ErrorEnvelope {
            error: ErrorBody {
                message: message.to_string(),
                kind,
            },
        }),
    )
        .into_response()
}

fn now_unix() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |duration| duration.as_secs())
}

/// A unique completion id. `created` is second-resolution, so concurrent requests
/// in the same second would otherwise collide; a process-wide counter disambiguates.
fn next_completion_id(created: u64) -> String {
    static SEQ: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
    let seq = SEQ.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    format!("chatcmpl-{created}-{seq}")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_messages() -> Vec<ChatMessage> {
        vec![
            ChatMessage {
                role: "system".to_string(),
                content: Value::String("client system prompt".to_string()),
            },
            ChatMessage {
                role: "user".to_string(),
                content: Value::String("first".to_string()),
            },
            ChatMessage {
                role: "assistant".to_string(),
                content: Value::String("old answer".to_string()),
            },
            ChatMessage {
                role: "user".to_string(),
                content: Value::String("second".to_string()),
            },
        ]
    }

    #[test]
    fn stateless_conversation_seeds_history_hoists_system_and_takes_last_user() {
        let conv =
            stateless_conversation_from_messages(&sample_messages()).expect("stateless conversation");
        assert_eq!(conv.input, "second");
        // Client system message is hoisted out of the compactable history.
        assert_eq!(
            conv.system_additions,
            vec!["client system prompt".to_string()]
        );
        // Prior user + assistant turns become seed history (last user excluded).
        assert_eq!(conv.history.len(), 2);
    }

    #[test]
    fn stateless_conversation_errors_without_user_message() {
        let messages = vec![ChatMessage {
            role: "system".to_string(),
            content: Value::String("only system".to_string()),
        }];

        assert!(stateless_conversation_from_messages(&messages).is_err());
    }

    #[test]
    fn stateless_conversation_tolerates_null_assistant_content() {
        // Assistant tool-call envelopes can carry a null content field; the
        // mapper must not error and should simply drop the empty entry.
        let messages = vec![
            ChatMessage {
                role: "assistant".to_string(),
                content: Value::Null,
            },
            ChatMessage {
                role: "user".to_string(),
                content: Value::String("hello".to_string()),
            },
        ];

        let conv =
            stateless_conversation_from_messages(&messages).expect("stateless conversation");
        assert_eq!(conv.input, "hello");
        assert!(conv.history.is_empty());
    }

    #[test]
    fn openwebui_tool_details_escapes_attributes_and_output() {
        let rendered = openwebui_tool_details(
            "call_1",
            "bash",
            r#"{"cmd":"printf \"<ok>&\""}"#,
            "line <ok> & done",
            false,
        );

        assert!(rendered.contains(r#"<details type="tool_calls" done="true""#));
        assert!(rendered.contains(r#"id="call_1""#));
        assert!(rendered.contains(r#"name="bash""#));
        assert!(rendered.contains("&quot;cmd&quot;"));
        assert!(rendered.contains("&lt;ok&gt;&amp;"));
        assert!(rendered.contains("<summary>Tool Executed</summary>"));
        assert!(rendered.contains(r#""line &lt;ok&gt; &amp; done""#));
    }
}
