use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{
        sse::{Event, KeepAlive, Sse},
        IntoResponse, Response,
    },
    routing::{get, post, put},
    Json, Router,
};
use runtime::{AssistantEvent, ContentBlock, ConversationMessage, PermissionMode};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::HashMap,
    convert::Infallible,
    net::SocketAddr,
    sync::Arc,
    time::{SystemTime, UNIX_EPOCH},
};
use tokio::sync::mpsc;
use tokio_stream::wrappers::UnboundedReceiverStream;

#[derive(Clone)]
struct OpenAiServerState {
    backend_model: String,
    served_model_id: String,
    allowed_tools: Option<crate::AllowedToolSet>,
    permission_mode: PermissionMode,
    /// Dialog persistence for the built-in UI. `Some` only when `--ui` is on and the
    /// store opened successfully; the chat path never touches it.
    dialog_store: Option<Arc<crate::dialog_store::DialogStore>>,
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
struct ChatCompletionChunk {
    id: String,
    object: &'static str,
    created: u64,
    model: String,
    choices: Vec<ChatCompletionChunkChoice>,
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

pub(crate) fn serve_blocking(
    bind: String,
    model: String,
    allowed_tools: Option<crate::AllowedToolSet>,
    permission_mode: PermissionMode,
    ui: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()?;

    runtime.block_on(serve(bind, model, allowed_tools, permission_mode, ui))
}

async fn serve(
    bind: String,
    model: String,
    allowed_tools: Option<crate::AllowedToolSet>,
    permission_mode: PermissionMode,
    ui: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    let addr: SocketAddr = bind.parse()?;
    let served_model_id =
        served_model_id_from_value(std::env::var("CLAW_SERVED_MODEL_ID").ok(), &model);
    // Dialog persistence is opt-in with the UI; a failure to open it disables storage
    // but never blocks serving.
    let dialog_store = if ui {
        match crate::dialog_store::DialogStore::open() {
            Ok(store) => Some(Arc::new(store)),
            Err(error) => {
                eprintln!("claw openai-serve: dialog store disabled ({error})");
                None
            }
        }
    } else {
        None
    };

    let state = Arc::new(OpenAiServerState {
        backend_model: model,
        served_model_id,
        allowed_tools,
        permission_mode,
        dialog_store,
    });

    // API routes are always present. The built-in web UI is opt-in via `--ui`, so the
    // headless service is byte-for-byte unchanged unless the operator asks for it.
    let mut app = Router::new()
        .route("/health", get(health))
        .route("/v1/models", get(models))
        .route("/v1/chat/completions", post(chat_completions));
    if ui {
        app = app
            .route("/", get(ui_index))
            .route("/app.css", get(ui_css))
            .route("/app.js", get(ui_js))
            .route("/ui/dialogs", get(ui_dialogs_list))
            .route(
                "/ui/dialogs/{id}",
                get(ui_dialog_get).put(ui_dialog_put).delete(ui_dialog_delete),
            )
            .route("/ui/presets", get(ui_presets_list))
            .route("/ui/presets/{id}", put(ui_preset_put).delete(ui_preset_delete))
            .route("/ui/kv/{key}", get(ui_kv_get).put(ui_kv_put))
            .route("/ui/settings", get(ui_settings_get))
            .route("/ui/settings/save-restart", post(ui_settings_save_restart))
            .route("/ui/config", get(ui_config_get))
            .route("/ui/config/save", post(ui_config_save));
    }
    let app = app.with_state(state);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    if ui {
        eprintln!("claw openai-serve listening on http://{addr} (web UI at /)");
    } else {
        eprintln!("claw openai-serve listening on http://{addr}");
    }
    axum::serve(listener, app).await?;
    Ok(())
}

// ---- Built-in web UI (served only with `--ui`) ----
//
// Layout "B": each UI source file lives separately under `static/` and is embedded
// individually, so HTML / CSS / JS stay editable in isolation rather than as one blob.
// For a fast edit loop, `CLAB_UI_DIR` overrides the embedded copy by reading the file
// from disk at runtime (dev only); when unset, the compile-time embedded asset is served,
// keeping the shipped binary fully self-contained and portable. Growing to a whole-folder
// embed later only means swapping the per-file constants for a directory walk.
struct UiAsset {
    /// File name under `static/` and under `CLAB_UI_DIR`.
    file: &'static str,
    /// Value for the `Content-Type` header.
    content_type: &'static str,
    /// Compile-time embedded contents (default / release path).
    embedded: &'static str,
}

static UI_INDEX: UiAsset = UiAsset {
    file: "index.html",
    content_type: "text/html; charset=utf-8",
    embedded: include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/static/index.html")),
};
static UI_CSS: UiAsset = UiAsset {
    file: "app.css",
    content_type: "text/css; charset=utf-8",
    embedded: include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/static/app.css")),
};
static UI_JS: UiAsset = UiAsset {
    file: "app.js",
    content_type: "text/javascript; charset=utf-8",
    embedded: include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/static/app.js")),
};

fn ui_asset_body(asset: &UiAsset) -> String {
    // Dev override: read from CLAB_UI_DIR at runtime so UI edits don't need a rebuild.
    if let Ok(dir) = std::env::var("CLAB_UI_DIR") {
        let dir = dir.trim();
        if !dir.is_empty() {
            let path = std::path::Path::new(dir).join(asset.file);
            if let Ok(contents) = std::fs::read_to_string(&path) {
                return contents;
            }
        }
    }
    asset.embedded.to_string()
}

fn ui_response(asset: &'static UiAsset) -> Response {
    (
        [(axum::http::header::CONTENT_TYPE, asset.content_type)],
        ui_asset_body(asset),
    )
        .into_response()
}

async fn ui_index() -> Response {
    ui_response(&UI_INDEX)
}
async fn ui_css() -> Response {
    ui_response(&UI_CSS)
}
async fn ui_js() -> Response {
    ui_response(&UI_JS)
}

// ---- Dialog persistence endpoints (served only with `--ui`) ----

fn store_unavailable() -> Response {
    (StatusCode::SERVICE_UNAVAILABLE, "dialog store disabled").into_response()
}

async fn ui_dialogs_list(State(state): State<Arc<OpenAiServerState>>) -> Response {
    let Some(store) = state.dialog_store.as_ref() else {
        return store_unavailable();
    };
    match store.list() {
        Ok(list) => Json(list).into_response(),
        Err(error) => (StatusCode::INTERNAL_SERVER_ERROR, error).into_response(),
    }
}

async fn ui_dialog_get(
    State(state): State<Arc<OpenAiServerState>>,
    Path(id): Path<String>,
) -> Response {
    let Some(store) = state.dialog_store.as_ref() else {
        return store_unavailable();
    };
    match store.get(&id) {
        Ok(Some(dialog)) => Json(dialog).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, "dialog not found").into_response(),
        Err(error) => (StatusCode::INTERNAL_SERVER_ERROR, error).into_response(),
    }
}

#[derive(Deserialize)]
struct DialogUpsertBody {
    #[serde(default)]
    title: String,
    #[serde(default)]
    messages: serde_json::Value,
}

async fn ui_dialog_put(
    State(state): State<Arc<OpenAiServerState>>,
    Path(id): Path<String>,
    Json(body): Json<DialogUpsertBody>,
) -> Response {
    let Some(store) = state.dialog_store.as_ref() else {
        return store_unavailable();
    };
    let title = if body.title.trim().is_empty() {
        "Без названия".to_string()
    } else {
        body.title
    };
    let messages = if body.messages.is_null() {
        serde_json::Value::Array(Vec::new())
    } else {
        body.messages
    };
    match store.upsert(&id, &title, &messages) {
        Ok(summary) => Json(summary).into_response(),
        Err(error) => (StatusCode::INTERNAL_SERVER_ERROR, error).into_response(),
    }
}

async fn ui_dialog_delete(
    State(state): State<Arc<OpenAiServerState>>,
    Path(id): Path<String>,
) -> Response {
    let Some(store) = state.dialog_store.as_ref() else {
        return store_unavailable();
    };
    match store.delete(&id) {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(error) => (StatusCode::INTERNAL_SERVER_ERROR, error).into_response(),
    }
}

// ---- system-prompt presets + UI key/value ----

async fn ui_presets_list(State(state): State<Arc<OpenAiServerState>>) -> Response {
    let Some(store) = state.dialog_store.as_ref() else {
        return store_unavailable();
    };
    match store.list_presets() {
        Ok(list) => Json(list).into_response(),
        Err(error) => (StatusCode::INTERNAL_SERVER_ERROR, error).into_response(),
    }
}

#[derive(Deserialize)]
struct PresetBody {
    #[serde(default)]
    name: String,
    #[serde(default)]
    prompt: String,
}

async fn ui_preset_put(
    State(state): State<Arc<OpenAiServerState>>,
    Path(id): Path<String>,
    Json(body): Json<PresetBody>,
) -> Response {
    let Some(store) = state.dialog_store.as_ref() else {
        return store_unavailable();
    };
    let name = if body.name.trim().is_empty() {
        "Пресет".to_string()
    } else {
        body.name
    };
    match store.upsert_preset(&id, &name, &body.prompt) {
        Ok(preset) => Json(preset).into_response(),
        Err(error) => (StatusCode::INTERNAL_SERVER_ERROR, error).into_response(),
    }
}

async fn ui_preset_delete(
    State(state): State<Arc<OpenAiServerState>>,
    Path(id): Path<String>,
) -> Response {
    let Some(store) = state.dialog_store.as_ref() else {
        return store_unavailable();
    };
    match store.delete_preset(&id) {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(error) => (StatusCode::INTERNAL_SERVER_ERROR, error).into_response(),
    }
}

#[derive(Serialize)]
struct KvValue {
    value: Option<String>,
}

#[derive(Deserialize)]
struct KvBody {
    #[serde(default)]
    value: String,
}

async fn ui_kv_get(
    State(state): State<Arc<OpenAiServerState>>,
    Path(key): Path<String>,
) -> Response {
    let Some(store) = state.dialog_store.as_ref() else {
        return store_unavailable();
    };
    match store.get_kv(&key) {
        Ok(value) => Json(KvValue { value }).into_response(),
        Err(error) => (StatusCode::INTERNAL_SERVER_ERROR, error).into_response(),
    }
}

async fn ui_kv_put(
    State(state): State<Arc<OpenAiServerState>>,
    Path(key): Path<String>,
    Json(body): Json<KvBody>,
) -> Response {
    let Some(store) = state.dialog_store.as_ref() else {
        return store_unavailable();
    };
    match store.set_kv(&key, &body.value) {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(error) => (StatusCode::INTERNAL_SERVER_ERROR, error).into_response(),
    }
}

// ---- "Основное" settings: read active env, save to the env file, self-restart ----

/// The env keys the UI may read and edit. Saving touches only these; everything else in
/// the env file is preserved verbatim.
const SETTINGS_KEYS: &[&str] = &[
    "OPENAI_BASE_URL",
    "OPENAI_API_KEY",
    "OPENAI_MODEL",
    "CLAW_SERVED_MODEL_ID",
    "CLAW_PERMISSION_MODE",
    "CLAWD_WEB_SEARCH_BASE_URL",
];

async fn ui_settings_get() -> Response {
    let mut map = serde_json::Map::new();
    for key in SETTINGS_KEYS {
        map.insert(
            (*key).to_string(),
            serde_json::Value::String(std::env::var(key).unwrap_or_default()),
        );
    }
    // tell the UI whether saving is even possible (env file path configured)
    let can_save = std::env::var("CLAW_OPENAI_ENV_FILE")
        .map(|p| !p.trim().is_empty())
        .unwrap_or(false);
    map.insert("_can_save".to_string(), serde_json::Value::Bool(can_save));
    Json(serde_json::Value::Object(map)).into_response()
}

/// Rewrite only the known settings keys in the env file (preserving everything else),
/// then exit so systemd brings the process back up with the new values (needs
/// `Restart=always`). Atomic write via temp + rename.
fn write_env_file(
    path: &std::path::Path,
    updates: &std::collections::HashMap<String, String>,
) -> Result<(), String> {
    let existing = std::fs::read_to_string(path).unwrap_or_default();
    let mut seen = std::collections::HashSet::new();
    let mut out = String::new();
    for line in existing.lines() {
        if let Some(eq) = line.find('=') {
            let key = line[..eq].trim();
            if SETTINGS_KEYS.contains(&key) {
                if let Some(value) = updates.get(key) {
                    out.push_str(key);
                    out.push('=');
                    out.push_str(value);
                    out.push('\n');
                    seen.insert(key.to_string());
                    continue;
                }
            }
        }
        out.push_str(line);
        out.push('\n');
    }
    for key in SETTINGS_KEYS {
        if !seen.contains(*key) {
            if let Some(value) = updates.get(*key) {
                out.push_str(key);
                out.push('=');
                out.push_str(value);
                out.push('\n');
            }
        }
    }
    let tmp = path.with_extension("env.tmp");
    std::fs::write(&tmp, out.as_bytes()).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, path).map_err(|e| e.to_string())?;
    Ok(())
}

async fn ui_settings_save_restart(
    Json(updates): Json<std::collections::HashMap<String, String>>,
) -> Response {
    let path = match std::env::var("CLAW_OPENAI_ENV_FILE") {
        Ok(p) if !p.trim().is_empty() => p,
        _ => {
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                "settings saving not configured (CLAW_OPENAI_ENV_FILE unset)",
            )
                .into_response()
        }
    };
    if let Err(error) = write_env_file(std::path::Path::new(&path), &updates) {
        return (StatusCode::INTERNAL_SERVER_ERROR, format!("write env: {error}")).into_response();
    }
    // Respond first, then exit shortly after so systemd restarts us with the new env.
    tokio::spawn(async {
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        std::process::exit(0);
    });
    Json(serde_json::json!({ "ok": true, "restarting": true })).into_response()
}

/// Path to the global user `settings.json` (config home). This single file is read by
/// every runtime config-discovery path: the bash sandbox (discovered from the ephemeral
/// per-request workspace, where only the config home is reachable) and the runtime
/// feature config (permission rules, trusted roots). Writing here therefore applies
/// without a restart — sandbox is re-read on each bash call, and permission rules /
/// trusted roots are re-read when the per-request runtime is built.
fn config_settings_path() -> std::path::PathBuf {
    runtime::default_config_home().join("settings.json")
}

fn read_settings_object(path: &std::path::Path) -> serde_json::Map<String, Value> {
    std::fs::read_to_string(path)
        .ok()
        .and_then(|raw| serde_json::from_str::<Value>(&raw).ok())
        .and_then(|value| value.as_object().cloned())
        .unwrap_or_default()
}

/// Recursively merge `overlay` into `base`: nested objects are merged key-by-key while
/// scalars and arrays replace. Lets the UI update a subset of keys (e.g. the sandbox
/// toggles) without dropping sibling keys it does not manage (`allowedMounts`,
/// `permissions.defaultMode`, or unrelated top-level config such as `mcpServers`).
fn merge_json_value(base: &mut Value, overlay: &Value) {
    match (base, overlay) {
        (Value::Object(base_map), Value::Object(overlay_map)) => {
            for (key, value) in overlay_map {
                merge_json_value(base_map.entry(key.clone()).or_insert(Value::Null), value);
            }
        }
        (base_slot, overlay_value) => {
            *base_slot = overlay_value.clone();
        }
    }
}

/// Keys the security UI section owns inside `settings.json`.
const UI_CONFIG_KEYS: &[&str] = &["sandbox", "trustedRoots", "permissions"];

async fn ui_config_get() -> Response {
    let existing = read_settings_object(&config_settings_path());
    let mut out = serde_json::Map::new();
    out.insert(
        "sandbox".to_string(),
        existing.get("sandbox").cloned().unwrap_or(Value::Null),
    );
    out.insert(
        "trustedRoots".to_string(),
        existing
            .get("trustedRoots")
            .cloned()
            .unwrap_or_else(|| Value::Array(Vec::new())),
    );
    out.insert(
        "permissions".to_string(),
        existing.get("permissions").cloned().unwrap_or(Value::Null),
    );
    Json(Value::Object(out)).into_response()
}

async fn ui_config_save(Json(incoming): Json<Value>) -> Response {
    let path = config_settings_path();
    let mut root = Value::Object(read_settings_object(&path));
    if let Some(incoming_map) = incoming.as_object() {
        let root_map = root.as_object_mut().expect("root constructed as object");
        for key in UI_CONFIG_KEYS {
            if let Some(value) = incoming_map.get(*key) {
                merge_json_value(root_map.entry((*key).to_string()).or_insert(Value::Null), value);
            }
        }
    }
    let serialized = match serde_json::to_string_pretty(&root) {
        Ok(text) => text,
        Err(error) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("serialize config: {error}"),
            )
                .into_response()
        }
    };
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let tmp = path.with_extension("json.tmp");
    if let Err(error) = std::fs::write(&tmp, serialized.as_bytes()) {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("write config: {error}"),
        )
            .into_response();
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        // settings.json may hold secrets (e.g. oauth tokens); keep it owner-only.
        let _ = std::fs::set_permissions(&tmp, std::fs::Permissions::from_mode(0o600));
    }
    if let Err(error) = std::fs::rename(&tmp, &path) {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("install config: {error}"),
        )
            .into_response();
    }
    Json(serde_json::json!({ "ok": true })).into_response()
}

async fn health(State(state): State<Arc<OpenAiServerState>>) -> impl IntoResponse {
    Json(HealthResponse {
        ok: true,
        service: "claw-openai-serve",
        model: state.served_model_id.clone(),
    })
}

async fn models(State(state): State<Arc<OpenAiServerState>>) -> impl IntoResponse {
    Json(ModelListResponse {
        object: "list",
        data: vec![ModelObject {
            id: state.served_model_id.clone(),
            object: "model",
            owned_by: "claw-openai-serve",
        }],
    })
}

fn served_model_id_from_value(value: Option<String>, backend_model: &str) -> String {
    value
        .map(|model| model.trim().to_string())
        .filter(|model| !model.is_empty())
        .unwrap_or_else(|| backend_model.to_string())
}

async fn chat_completions(
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
        move || -> Result<crate::engine::ClawEngineResponse, String> {
            let StatelessConversation {
                input,
                history,
                system_additions,
            } = conversation;
            let mut session = create_engine_session(
                state_for_task.backend_model.clone(),
                true,
                state_for_task.allowed_tools.clone(),
                state_for_task.permission_mode,
                (history, system_additions),
            )
            .map_err(|error| error.to_string())?;
            session
                .run_prompt_json(&input)
                .map_err(|error| error.to_string())
        },
    )
    .await;

    let engine_response = match result {
        Ok(Ok(response)) => response,
        Ok(Err(error)) => {
            return error_response(StatusCode::INTERNAL_SERVER_ERROR, &error, "engine_error")
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
        model: request
            .model
            .unwrap_or_else(|| state.served_model_id.clone()),
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
        .unwrap_or_else(|| state.served_model_id.clone());
    let backend_model = state.backend_model.clone();
    let allowed_tools = state.allowed_tools.clone();
    let permission_mode = state.permission_mode;
    let created = now_unix();
    let id = format!("chatcmpl-{created}");

    let (sender, receiver) = mpsc::unbounded_channel::<Result<Event, Infallible>>();
    let stream = UnboundedReceiverStream::new(receiver);

    tokio::task::spawn_blocking(move || {
        let _ = sender.send(openai_sse_role_chunk(&id, created, &response_model));

        let result = {
            let StatelessConversation {
                input,
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
                    let _ = sender.send(openai_sse_error_chunk(&error.to_string()));
                    let _ = sender.send(openai_sse_done());
                    return;
                }
            };

            let abort_signal = session.abort_signal();
            let mut tool_inputs = HashMap::<String, String>::new();
            let mut event_sink = |event: &AssistantEvent| {
                if let Some(chunk) = assistant_event_to_openai_sse_chunk(
                    &id,
                    created,
                    &response_model,
                    event,
                    &mut tool_inputs,
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

            session.run_prompt_json_with_event_sink(&input, &mut event_sink)
        };

        match result {
            Ok(_) => {
                let _ = sender.send(openai_sse_chunk(
                    &id,
                    created,
                    &response_model,
                    None,
                    Some("stop"),
                ));
            }
            Err(error) => {
                let _ = sender.send(openai_sse_error_chunk(&error.to_string()));
            }
        }

        let _ = sender.send(openai_sse_done());
    });

    Sse::new(stream)
        .keep_alive(KeepAlive::default())
        .into_response()
}

fn create_engine_session(
    model: String,
    enable_tools: bool,
    allowed_tools: Option<crate::AllowedToolSet>,
    permission_mode: PermissionMode,
    seed: (Vec<ConversationMessage>, Vec<String>),
) -> Result<crate::engine::ClawEngineSession, Box<dyn std::error::Error>> {
    let (history, system_additions) = seed;
    crate::engine::ClawEngineSession::new_ephemeral_with_context(
        model,
        enable_tools,
        allowed_tools,
        permission_mode,
        history,
        system_additions,
    )
}

fn assistant_event_to_openai_sse_chunk(
    id: &str,
    created: u64,
    model: &str,
    event: &AssistantEvent,
    tool_inputs: &mut HashMap<String, String>,
) -> Option<Result<Event, Infallible>> {
    match event {
        AssistantEvent::TextDelta(text) if !text.is_empty() => Some(openai_sse_chunk(
            id,
            created,
            model,
            Some(text.clone()),
            None,
        )),
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
    })
}

fn openai_sse_error_chunk(message: &str) -> Result<Event, Infallible> {
    sse_json_event(&ErrorEnvelope {
        error: ErrorBody {
            message: message.to_string(),
            kind: "engine_error",
        },
    })
}

fn openai_sse_done() -> Result<Event, Infallible> {
    Ok(Event::default().data("[DONE]"))
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

    for (index, message) in messages.iter().enumerate() {
        let role = message.role.trim();
        if role.is_empty() {
            return Err("message role must not be empty".to_string());
        }
        let text = message_text(&message.content)?;

        if index == last_user_index {
            input = text;
            continue;
        }

        if role.eq_ignore_ascii_case("system") {
            if !text.trim().is_empty() {
                system_additions.push(text);
            }
        } else if role.eq_ignore_ascii_case("user") {
            history.push(ConversationMessage::user_text(text));
        } else if !text.trim().is_empty() {
            // assistant, tool, or any other role → plain assistant context text.
            history.push(ConversationMessage::assistant(vec![ContentBlock::Text { text }]));
        }
    }

    Ok(StatelessConversation {
        input,
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
