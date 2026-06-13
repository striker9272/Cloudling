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

#[derive(Clone)]
pub(crate) struct OpenAiServerState {
    backend_model: String,
    served_model_id: String,
    allowed_tools: Option<crate::AllowedToolSet>,
    permission_mode: PermissionMode,
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
        backend_model: model,
        served_model_id,
        allowed_tools,
        permission_mode,
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
