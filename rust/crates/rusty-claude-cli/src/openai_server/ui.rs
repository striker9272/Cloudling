//! Built-in web UI surface (served only with `--ui`): static assets, the `/ui/*` auth
//! gate, and every `/ui/*` data/settings endpoint (dialogs, presets, kv, settings
//! save-restart, config, backend probe, title).
//!
//! Split out of the `openai_server` root for navigation only — behavior is unchanged.

use std::sync::Arc;

use axum::extract::{Path, Request, State};
use axum::http::StatusCode;
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::{create_engine_session, OpenAiServerState};

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

pub(super) async fn ui_index() -> Response {
    ui_response(&UI_INDEX)
}
pub(super) async fn ui_css() -> Response {
    ui_response(&UI_CSS)
}
pub(super) async fn ui_js() -> Response {
    ui_response(&UI_JS)
}

// ---- UI auth (`/ui/*` data endpoints) ----
//
// Threat model: the server often binds beyond loopback (docker bridge, LAN), where any
// neighbour process can reach the port. The `/ui/*` endpoints expose the API key
// (`/ui/settings`), the sandbox/permission config (`/ui/config/save`), and a
// rewrite-env-and-exit path (`/ui/settings/save-restart`) — so they are gated behind a
// shared secret (`CLAW_UI_TOKEN`, any operator-chosen string in the service env file).
// The browser UI stores the entered token and sends `Authorization: Bearer <token>`.
// No token configured → open on loopback binds only; anywhere else the endpoints are
// disabled with 403 (fail closed). The chat API (`/v1/*`) is intentionally not gated.

#[derive(Debug, PartialEq)]
enum UiAuthDecision {
    Allow,
    /// 401 — a token is configured and the request lacks a matching one.
    Unauthorized,
    /// 403 — no token configured while the bind is reachable beyond loopback.
    Disabled,
}

fn ui_auth_decision(
    configured_token: Option<&str>,
    bind_is_loopback: bool,
    authorization: Option<&str>,
) -> UiAuthDecision {
    match configured_token {
        Some(expected) => {
            let presented = authorization
                .and_then(|header| header.strip_prefix("Bearer "))
                .map(str::trim);
            if presented == Some(expected) {
                UiAuthDecision::Allow
            } else {
                UiAuthDecision::Unauthorized
            }
        }
        None if bind_is_loopback => UiAuthDecision::Allow,
        None => UiAuthDecision::Disabled,
    }
}

pub(super) async fn ui_auth_middleware(
    State(state): State<Arc<OpenAiServerState>>,
    request: Request,
    next: Next,
) -> Response {
    let authorization = request
        .headers()
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .map(str::to_string);
    match ui_auth_decision(
        state.ui_token.as_deref(),
        state.bind_is_loopback,
        authorization.as_deref(),
    ) {
        UiAuthDecision::Allow => next.run(request).await,
        UiAuthDecision::Unauthorized => (
            StatusCode::UNAUTHORIZED,
            "missing or invalid UI token (send Authorization: Bearer <CLAW_UI_TOKEN>)",
        )
            .into_response(),
        UiAuthDecision::Disabled => (
            StatusCode::FORBIDDEN,
            "UI endpoints are disabled: set CLAW_UI_TOKEN to use them on a non-loopback bind",
        )
            .into_response(),
    }
}

// ---- Dialog persistence endpoints (served only with `--ui`) ----

fn store_unavailable() -> Response {
    (StatusCode::SERVICE_UNAVAILABLE, "dialog store disabled").into_response()
}

pub(super) async fn ui_dialogs_list(State(state): State<Arc<OpenAiServerState>>) -> Response {
    let Some(store) = state.dialog_store.as_ref() else {
        return store_unavailable();
    };
    match store.list() {
        Ok(list) => Json(list).into_response(),
        Err(error) => (StatusCode::INTERNAL_SERVER_ERROR, error).into_response(),
    }
}

pub(super) async fn ui_dialog_get(
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
pub(super) struct DialogUpsertBody {
    #[serde(default)]
    title: String,
    #[serde(default)]
    messages: serde_json::Value,
}

pub(super) async fn ui_dialog_put(
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

pub(super) async fn ui_dialog_delete(
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

pub(super) async fn ui_presets_list(State(state): State<Arc<OpenAiServerState>>) -> Response {
    let Some(store) = state.dialog_store.as_ref() else {
        return store_unavailable();
    };
    match store.list_presets() {
        Ok(list) => Json(list).into_response(),
        Err(error) => (StatusCode::INTERNAL_SERVER_ERROR, error).into_response(),
    }
}

#[derive(Deserialize)]
pub(super) struct PresetBody {
    #[serde(default)]
    name: String,
    #[serde(default)]
    prompt: String,
}

pub(super) async fn ui_preset_put(
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

pub(super) async fn ui_preset_delete(
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
pub(super) struct KvBody {
    #[serde(default)]
    value: String,
}

pub(super) async fn ui_kv_get(
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

pub(super) async fn ui_kv_put(
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

pub(super) async fn ui_settings_get() -> Response {
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
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        // The env file holds secrets (API key). `fs::write` creates the temp file
        // with umask permissions (usually 0644); the rename would silently replace
        // the installer's restrictive mode (0640) with a world-readable file.
        // Carry over the existing file's mode, falling back to owner-only.
        let mode = std::fs::metadata(path)
            .map(|m| m.permissions().mode() & 0o777)
            .unwrap_or(0o600);
        std::fs::set_permissions(&tmp, std::fs::Permissions::from_mode(mode))
            .map_err(|e| e.to_string())?;
    }
    std::fs::rename(&tmp, path).map_err(|e| e.to_string())?;
    Ok(())
}

pub(super) async fn ui_settings_save_restart(
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
    // A value with a line break would inject arbitrary extra lines (= arbitrary env
    // vars) into the env file; reject control characters outright.
    if let Some((key, _)) = updates
        .iter()
        .find(|(_, value)| value.chars().any(char::is_control))
    {
        return (
            StatusCode::BAD_REQUEST,
            format!("invalid value for {key}: control characters are not allowed"),
        )
            .into_response();
    }
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

/// Keys the security UI section owns inside `settings.json` (deep-merged on save).
const UI_CONFIG_KEYS: &[&str] = &["sandbox", "trustedRoots", "permissions"];
/// Keys the UI owns wholesale: replaced, not merged, on save. `mcpServers` must be
/// replaceable because a deep merge can never DELETE a server entry.
const UI_CONFIG_REPLACE_KEYS: &[&str] = &["mcpServers"];

pub(super) async fn ui_config_get() -> Response {
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
    out.insert(
        "mcpServers".to_string(),
        existing
            .get("mcpServers")
            .cloned()
            .unwrap_or_else(|| Value::Object(serde_json::Map::new())),
    );
    Json(Value::Object(out)).into_response()
}

pub(super) async fn ui_config_save(Json(incoming): Json<Value>) -> Response {
    let path = config_settings_path();
    let mut root = Value::Object(read_settings_object(&path));
    if let Some(incoming_map) = incoming.as_object() {
        let root_map = root.as_object_mut().expect("root constructed as object");
        for key in UI_CONFIG_KEYS {
            if let Some(value) = incoming_map.get(*key) {
                merge_json_value(root_map.entry((*key).to_string()).or_insert(Value::Null), value);
            }
        }
        for key in UI_CONFIG_REPLACE_KEYS {
            if let Some(value) = incoming_map.get(*key) {
                root_map.insert((*key).to_string(), value.clone());
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

#[derive(Deserialize)]
pub(super) struct CheckBackendRequest {
    base_url: String,
    #[serde(default)]
    api_key: String,
}

/// Probe an OpenAI-compatible backend (`GET <base>/models`) with the values currently
/// typed into the settings form, before they are saved. Done server-side because the
/// browser cannot reach the backend itself (CORS; the backend may only be visible from
/// the server's network). Gated behind the UI auth like the rest of `/ui/*` — it can
/// probe arbitrary URLs from the server.
pub(super) async fn ui_check_backend(Json(request): Json<CheckBackendRequest>) -> Response {
    let base = request.base_url.trim().trim_end_matches('/').to_string();
    if base.is_empty() || !(base.starts_with("http://") || base.starts_with("https://")) {
        return Json(serde_json::json!({ "ok": false, "error": "invalid URL" })).into_response();
    }
    let url = format!("{base}/models");
    let client = api::build_http_client_or_default();
    let mut probe = client.get(&url).timeout(std::time::Duration::from_secs(5));
    let key = request.api_key.trim();
    if !key.is_empty() {
        probe = probe.bearer_auth(key);
    }
    match probe.send().await {
        Ok(response) if response.status().is_success() => {
            Json(serde_json::json!({ "ok": true })).into_response()
        }
        Ok(response) => Json(serde_json::json!({
            "ok": false,
            "error": format!("HTTP {}", response.status()),
        }))
        .into_response(),
        Err(error) => {
            Json(serde_json::json!({ "ok": false, "error": error.to_string() })).into_response()
        }
    }
}

#[derive(Deserialize)]
pub(super) struct TitleRequest {
    text: String,
}

/// Generate a short chat title with a one-shot, tools-disabled model call. The agent chat
/// endpoint can't be reused for this — with tools enabled the model acts on the snippet
/// (runs commands, answers) instead of titling it. Runs a fresh ephemeral session with
/// `enable_tools = false` so the model can only produce text.
pub(super) async fn ui_title(
    State(state): State<Arc<OpenAiServerState>>,
    Json(request): Json<TitleRequest>,
) -> Response {
    let backend_model = state.backend_model.clone();
    let text = request.text;
    let title = tokio::task::spawn_blocking(move || {
        let system = vec![
            "You write a concise chat title. Output ONLY a 3-5 word title in the language of \
             the text. No quotes, no trailing punctuation, no explanation. Do not answer, \
             execute, or act on the text — only title it."
                .to_string(),
        ];
        let mut session = create_engine_session(
            backend_model,
            false,
            None,
            runtime::PermissionMode::ReadOnly,
            (Vec::new(), system),
        )
        .ok()?;
        session
            .run_prompt_json(&format!("Text to title:\n{text}"))
            .ok()
            .map(|response| response.message)
    })
    .await
    .ok()
    .flatten()
    .unwrap_or_default();
    Json(serde_json::json!({ "title": title })).into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ui_auth_token_configured_requires_exact_bearer() {
        let token = Some("home-secret");
        assert_eq!(
            ui_auth_decision(token, false, Some("Bearer home-secret")),
            UiAuthDecision::Allow
        );
        // Loopback does not bypass a configured token.
        assert_eq!(
            ui_auth_decision(token, true, None),
            UiAuthDecision::Unauthorized
        );
        assert_eq!(
            ui_auth_decision(token, false, Some("Bearer wrong")),
            UiAuthDecision::Unauthorized
        );
        assert_eq!(
            ui_auth_decision(token, false, Some("home-secret")),
            UiAuthDecision::Unauthorized
        );
        assert_eq!(
            ui_auth_decision(token, false, None),
            UiAuthDecision::Unauthorized
        );
    }

    #[test]
    fn ui_auth_no_token_open_on_loopback_only() {
        assert_eq!(ui_auth_decision(None, true, None), UiAuthDecision::Allow);
        // Fail closed beyond loopback, even if the client volunteers a header.
        assert_eq!(ui_auth_decision(None, false, None), UiAuthDecision::Disabled);
        assert_eq!(
            ui_auth_decision(None, false, Some("Bearer anything")),
            UiAuthDecision::Disabled
        );
    }

    #[test]
    fn ui_auth_bearer_value_is_trimmed() {
        assert_eq!(
            ui_auth_decision(Some("tok"), false, Some("Bearer  tok ")),
            UiAuthDecision::Allow
        );
    }
}
