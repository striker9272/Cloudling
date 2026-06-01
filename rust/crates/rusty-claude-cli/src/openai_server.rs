use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use runtime::PermissionMode;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    net::SocketAddr,
    sync::Arc,
    time::{SystemTime, UNIX_EPOCH},
};

#[derive(Clone)]
struct OpenAiServerState {
    model: String,
    allowed_tools: Option<crate::AllowedToolSet>,
    permission_mode: PermissionMode,
}

#[derive(Serialize)]
struct HealthResponse {
    ok: bool,
    service: &'static str,
    model: String,
}

#[derive(Serialize)]
struct ModelListResponse {
    object: &'static str,
    data: Vec<ModelObject>,
}

#[derive(Serialize)]
struct ModelObject {
    id: String,
    object: &'static str,
    owned_by: &'static str,
}

#[derive(Debug, Deserialize)]
struct ChatCompletionRequest {
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
struct ErrorEnvelope {
    error: ErrorBody,
}

#[derive(Serialize)]
struct ErrorBody {
    message: String,
    #[serde(rename = "type")]
    kind: &'static str,
}

pub(crate) fn serve_blocking(
    bind: String,
    model: String,
    allowed_tools: Option<crate::AllowedToolSet>,
    permission_mode: PermissionMode,
) -> Result<(), Box<dyn std::error::Error>> {
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()?;

    runtime.block_on(serve(bind, model, allowed_tools, permission_mode))
}

async fn serve(
    bind: String,
    model: String,
    allowed_tools: Option<crate::AllowedToolSet>,
    permission_mode: PermissionMode,
) -> Result<(), Box<dyn std::error::Error>> {
    let addr: SocketAddr = bind.parse()?;
    let state = Arc::new(OpenAiServerState {
        model,
        allowed_tools,
        permission_mode,
    });

    let app = Router::new()
        .route("/health", get(health))
        .route("/v1/models", get(models))
        .route("/v1/chat/completions", post(chat_completions))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    eprintln!("claw openai-serve listening on http://{addr}");
    axum::serve(listener, app).await?;
    Ok(())
}

async fn health(State(state): State<Arc<OpenAiServerState>>) -> impl IntoResponse {
    Json(HealthResponse {
        ok: true,
        service: "claw-openai-serve",
        model: state.model.clone(),
    })
}

async fn models(State(state): State<Arc<OpenAiServerState>>) -> impl IntoResponse {
    Json(ModelListResponse {
        object: "list",
        data: vec![ModelObject {
            id: state.model.clone(),
            object: "model",
            owned_by: "claw-openai-serve",
        }],
    })
}

async fn chat_completions(
    State(state): State<Arc<OpenAiServerState>>,
    Json(request): Json<ChatCompletionRequest>,
) -> Response {
    if request.stream {
        return error_response(
            StatusCode::BAD_REQUEST,
            "stream=true is reserved for the next SSE implementation step",
            "not_implemented",
        );
    }

    let prompt = match messages_to_prompt(&request.messages) {
        Ok(prompt) => prompt,
        Err(message) => {
            return error_response(StatusCode::BAD_REQUEST, &message, "invalid_request")
        }
    };

    let state_for_task = state.clone();
    let result = tokio::task::spawn_blocking(
        move || -> Result<crate::engine::ClawEngineResponse, String> {
            let mut session = crate::engine::ClawEngineSession::new(
                state_for_task.model.clone(),
                true,
                state_for_task.allowed_tools.clone(),
                state_for_task.permission_mode,
            )
            .map_err(|error| error.to_string())?;

            session
                .run_prompt_json(&prompt)
                .map_err(|error| error.to_string())
        },
    )
    .await;

    let engine_response = match result {
        Ok(Ok(response)) => response,
        Ok(Err(error)) => {
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                &error.to_string(),
                "engine_error",
            )
        }
        Err(error) => {
            return error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                &error.to_string(),
                "task_error",
            )
        }
    };

    let created = now_unix();
    let total_tokens = engine_response.usage.input_tokens + engine_response.usage.output_tokens;

    Json(ChatCompletionResponse {
        id: format!("chatcmpl-{created}"),
        object: "chat.completion",
        created,
        model: request.model.unwrap_or_else(|| state.model.clone()),
        choices: vec![ChatCompletionChoice {
            index: 0,
            message: ChatCompletionMessage {
                role: "assistant",
                content: engine_response.message,
            },
            finish_reason: "stop",
        }],
        usage: ChatCompletionUsage {
            prompt_tokens: engine_response.usage.input_tokens,
            completion_tokens: engine_response.usage.output_tokens,
            total_tokens,
        },
    })
    .into_response()
}

fn messages_to_prompt(messages: &[ChatMessage]) -> Result<String, String> {
    if messages.is_empty() {
        return Err("messages must not be empty".to_string());
    }

    let mut parts = Vec::new();

    for message in messages {
        let content = content_to_text(&message.content)?;
        let role = message.role.trim();
        if role.is_empty() {
            return Err("message role must not be empty".to_string());
        }
        parts.push(format!("{role}: {content}"));
    }

    parts.push("assistant:".to_string());
    Ok(parts.join("\n\n"))
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
