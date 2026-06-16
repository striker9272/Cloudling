//! Chat-completions endpoint (sync + streaming), SSE translation, and the mapping
//! from an incoming OpenAI `messages` array onto a seedable stateless conversation.
//!
//! Split out of the `openai_server` root for navigation only — behavior is unchanged.

use std::collections::HashMap;
use std::convert::Infallible;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use axum::extract::State;
use axum::http::StatusCode;
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
    Json(request): Json<ChatCompletionRequest>,
) -> Response {
    if request.stream {
        return stream_chat_completions(state, request);
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
            let mut tool_inputs = HashMap::<String, String>::new();
            let mut event_sink = |event: &AssistantEvent| {
                if let AssistantEvent::Usage(u) = event {
                    last_ctx_sink.set(
                        u.input_tokens
                            .saturating_add(u.cache_creation_input_tokens)
                            .saturating_add(u.cache_read_input_tokens),
                    );
                }
                if let Some(chunk) = assistant_event_to_openai_sse_chunk(
                    &id,
                    created,
                    &response_model,
                    event,
                    &mut tool_inputs,
                    forward_reasoning,
                ) {
                    // Client-disconnect detection: once the SSE receiver is dropped
                    // (tab closed / Stop pressed), `send` fails. Trip the turn-level
                    // abort so the agent loop halts between steps instead of running on
                    // in the background — the OWUI pattern (client gone -> stop).
                    if sender.send(chunk).is_err() {
                        abort_signal.abort();
                    }
                }
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
                let _ = sender.send(openai_sse_chunk(
                    &id,
                    created,
                    &response_model,
                    None,
                    Some("stop"),
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
