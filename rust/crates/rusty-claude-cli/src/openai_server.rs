//! OpenAI-compatible HTTP server (`openai-serve`).
//!
//! This root module owns the shared server state, the listener/router wiring, and the
//! small always-on endpoints (`/health`, `/v1/models`). The request-heavy surfaces live
//! in child modules — `chat` (`/v1/chat/completions` + SSE) and `ui` (the `--ui` web UI
//! and its `/ui/*` data endpoints) — which resolve shared types and `create_engine_session`
//! from this parent. Splitting is for navigation only; behavior is unchanged.

mod chat;
mod ui;

use std::net::SocketAddr;
use std::sync::Arc;

use axum::extract::State;
use axum::middleware;
use axum::response::IntoResponse;
use axum::routing::{get, post, put};
use axum::{Json, Router};
use runtime::{ConversationMessage, PermissionMode};
use serde::Serialize;

use chat::chat_completions;
use ui::{
    ui_auth_middleware, ui_check_backend, ui_config_get, ui_config_save, ui_css, ui_dialog_delete,
    ui_dialog_get, ui_dialog_put, ui_dialogs_list, ui_index, ui_js, ui_kv_get, ui_kv_put,
    ui_preset_delete, ui_preset_put, ui_presets_list, ui_settings_get, ui_settings_save_restart,
    ui_title,
};

pub(crate) struct OpenAiServerState {
    // Engine model, served id, and permission mode are mutable behind locks so the UI
    // "Save" applies live without a process restart (see `apply_settings`). The chat
    // path reads them per request via the accessor methods below.
    backend_model: std::sync::RwLock<String>,
    served_model_id: std::sync::RwLock<String>,
    allowed_tools: Option<crate::AllowedToolSet>,
    permission_mode: std::sync::RwLock<PermissionMode>,
    /// Dialog persistence for the built-in UI. `Some` only when `--ui` is on and the
    /// store opened successfully; the chat path never touches it.
    dialog_store: Option<Arc<crate::dialog_store::DialogStore>>,
    /// Shared secret guarding the `/ui/*` data endpoints (`CLAW_UI_TOKEN`). `None` means
    /// no token is configured; then those endpoints are open on loopback binds only.
    ui_token: Option<String>,
    /// Whether the listen address is loopback. Decides the no-token default: open on
    /// localhost (dev convenience), disabled anywhere else (fail closed).
    bind_is_loopback: bool,
}

impl OpenAiServerState {
    pub(crate) fn backend_model(&self) -> String {
        self.backend_model
            .read()
            .expect("backend_model lock poisoned")
            .clone()
    }

    pub(crate) fn served_model_id(&self) -> String {
        self.served_model_id
            .read()
            .expect("served_model_id lock poisoned")
            .clone()
    }

    pub(crate) fn permission_mode(&self) -> PermissionMode {
        *self
            .permission_mode
            .read()
            .expect("permission_mode lock poisoned")
    }

    /// Apply edited engine settings to the live state (no restart). `OPENAI_BASE_URL`,
    /// `OPENAI_API_KEY`, and `CLAWD_WEB_SEARCH_BASE_URL` are read from the process
    /// environment per request, so the caller sets those via `std::env::set_var`; the
    /// model, served id, and permission mode are held here and updated in place.
    pub(crate) fn apply_settings(&self, updates: &std::collections::HashMap<String, String>) {
        if let Some(model) = updates.get("OPENAI_MODEL") {
            *self.backend_model.write().expect("backend_model lock poisoned") = model.clone();
        }
        let backend = self.backend_model();
        let served =
            served_model_id_from_value(updates.get("CLAW_SERVED_MODEL_ID").cloned(), &backend);
        *self
            .served_model_id
            .write()
            .expect("served_model_id lock poisoned") = served;
        if let Some(label) = updates
            .get("CLAW_PERMISSION_MODE")
            .and_then(|value| crate::normalize_permission_mode(value))
        {
            *self
                .permission_mode
                .write()
                .expect("permission_mode lock poisoned") = crate::permission_mode_from_label(label);
        }
    }
}

/// Path to the env file that persists engine settings. Honors `CLAW_OPENAI_ENV_FILE`
/// (set by the Linux service installer); otherwise defaults to a per-user location in
/// the config home so saving works on a plain manual launch (e.g. native Windows),
/// without any installer. Portable — no hardcoded absolute paths.
pub(super) fn resolve_openai_env_file() -> std::path::PathBuf {
    if let Ok(path) = std::env::var("CLAW_OPENAI_ENV_FILE") {
        let trimmed = path.trim();
        if !trimmed.is_empty() {
            return std::path::PathBuf::from(trimmed);
        }
    }
    runtime::default_config_home().join("openai.env")
}

/// Read `KEY=VALUE` lines from the env file into the process environment, skipping keys
/// already set (so an externally-provided environment — e.g. systemd `EnvironmentFile`
/// or shell exports — always wins). Missing/unreadable file is a no-op.
pub(super) fn load_env_file_into_process(path: &std::path::Path) {
    let Ok(contents) = std::fs::read_to_string(path) else {
        return;
    };
    for line in contents.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let Some(eq) = line.find('=') else {
            continue;
        };
        let key = line[..eq].trim();
        let value = line[eq + 1..].trim();
        if key.is_empty() {
            continue;
        }
        if std::env::var_os(key).is_none() {
            std::env::set_var(key, value);
        }
    }
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
    // Load persisted engine settings from the env file into the process environment.
    // This is the role systemd's `EnvironmentFile` plays on Linux; doing it in-binary
    // makes a native Windows / manual launch pick up settings saved from the UI. Vars
    // already present in the environment are never overwritten.
    load_env_file_into_process(&resolve_openai_env_file());
    // With `--ui` the server may start unconfigured. If no model was passed on the CLI
    // but one was persisted (now in the environment), adopt it so a relaunch remembers
    // the engine without a restart wizard.
    let model = if model.trim().is_empty() {
        std::env::var("OPENAI_MODEL").unwrap_or_default()
    } else {
        model
    };
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

    let ui_token = std::env::var("CLAW_UI_TOKEN")
        .ok()
        .map(|t| t.trim().to_string())
        .filter(|t| !t.is_empty());
    if ui && ui_token.is_none() && !addr.ip().is_loopback() {
        eprintln!(
            "claw openai-serve: CLAW_UI_TOKEN is not set and the bind is not loopback; \
             /ui/* endpoints are disabled (the chat API and static page still work)"
        );
    }

    let state = Arc::new(OpenAiServerState {
        backend_model: std::sync::RwLock::new(model),
        served_model_id: std::sync::RwLock::new(served_model_id),
        allowed_tools,
        permission_mode: std::sync::RwLock::new(permission_mode),
        dialog_store,
        ui_token,
        bind_is_loopback: addr.ip().is_loopback(),
    });

    // API routes are always present. The built-in web UI is opt-in via `--ui`, so the
    // headless service is byte-for-byte unchanged unless the operator asks for it.
    let mut app = Router::new()
        .route("/health", get(health))
        .route("/v1/models", get(models))
        .route("/v1/chat/completions", post(chat_completions));
    if ui {
        // Static assets stay open: they contain no secrets and the page itself is the
        // place where the user enters the token.
        app = app
            .route("/", get(ui_index))
            .route("/app.css", get(ui_css))
            .route("/app.js", get(ui_js));
        // Data/settings endpoints can read the API key, rewrite the env file, and
        // disable the sandbox — gate them behind `CLAW_UI_TOKEN` (see ui_auth_decision).
        let ui_api = Router::new()
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
            .route("/ui/config/save", post(ui_config_save))
            .route("/ui/check-backend", post(ui_check_backend))
            .route("/ui/title", post(ui_title))
            .route_layer(middleware::from_fn_with_state(
                state.clone(),
                ui_auth_middleware,
            ));
        app = app.merge(ui_api);
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

async fn health(State(state): State<Arc<OpenAiServerState>>) -> impl IntoResponse {
    Json(HealthResponse {
        ok: true,
        service: "claw-openai-serve",
        model: state.served_model_id(),
    })
}

async fn models(State(state): State<Arc<OpenAiServerState>>) -> impl IntoResponse {
    Json(ModelListResponse {
        object: "list",
        data: vec![ModelObject {
            id: state.served_model_id(),
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

/// Build a fresh ephemeral engine session seeded with prior conversation history and any
/// client `system` additions. Shared by the chat endpoints and the UI title endpoint.
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
