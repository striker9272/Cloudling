use runtime::{ContentBlock, TurnSummary};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

/// Request shape for a reusable Claw engine turn.
///
/// This is intentionally not tied to terminal IO. The CLI, future HTTP server,
/// and tests should be able to build this request and receive either a final
/// response or a stream of engine events.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ClawEngineRequest {
    pub prompt: String,
    pub model: String,
    pub permission_mode: String,
    pub allowed_tools: Vec<String>,
    pub stream: bool,
}

/// Streaming-aware engine event model.
///
/// The first OpenAI-compatible server slice will translate these events into
/// SSE `chat.completion.chunk` objects for `stream=true`. Non-streaming callers
/// can ignore this and use [`ClawEngineResponse`].
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClawEngineEvent {
    Started {
        model: String,
    },
    TextDelta {
        text: String,
    },
    ToolUse {
        id: String,
        name: String,
        input: String,
    },
    ToolResult {
        tool_use_id: String,
        tool_name: String,
        output: String,
        is_error: bool,
    },
    Usage {
        usage: ClawEngineUsage,
    },
    Done,
    Error {
        message: String,
    },
}

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

    #[test]
    fn stream_event_serialization_uses_stable_type_tags() {
        let event = ClawEngineEvent::TextDelta {
            text: "hello".to_string(),
        };

        let value = serde_json::to_value(event).expect("serialize event");
        assert_eq!(value["type"], "text_delta");
        assert_eq!(value["text"], "hello");
    }
}
