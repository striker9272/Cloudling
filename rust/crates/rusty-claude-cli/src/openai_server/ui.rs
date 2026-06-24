//! Built-in web UI surface (served only with `--ui`): static assets, the `/ui/*` auth
//! gate, and every `/ui/*` data/settings endpoint (dialogs, presets, kv, settings
//! save-restart, config, backend probe, title).
//!
//! Split out of the `openai_server` root for navigation only — behavior is unchanged.

use std::sync::Arc;

use axum::extract::{Path, Query, Request, State};
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

/// Compare two byte slices in constant time w.r.t. their contents, so token
/// verification does not leak how many leading bytes matched via a timing
/// side-channel. Length still short-circuits (token length is not secret); the
/// content comparison folds every byte without an early exit. No extra crate is
/// pulled in for this (keeps the dependency tree / lockfile untouched).
fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
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
            let matches = presented
                .map(|token| constant_time_eq(token.as_bytes(), expected.as_bytes()))
                .unwrap_or(false);
            if matches {
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

#[derive(Debug, Deserialize)]
pub(super) struct AnswerRequest {
    id: String,
    answer: String,
}

/// Deliver a user's answer to an in-flight interactive `AskUserQuestion` (built-in UI). The
/// streaming chat thread is blocked waiting on this `id`; resolving it unblocks the tool so
/// the agent loop continues. Returns 404 when no question is waiting (already answered or it
/// timed out). Gated by `ui_auth_middleware` like every `/ui/*` endpoint.
pub(super) async fn ui_answer(
    State(state): State<Arc<OpenAiServerState>>,
    Json(body): Json<AnswerRequest>,
) -> Response {
    if state.resolve_pending_question(&body.id, body.answer) {
        StatusCode::NO_CONTENT.into_response()
    } else {
        (StatusCode::NOT_FOUND, "no pending question for that id").into_response()
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
    // Saving is always possible now: settings apply live and persist to the env file,
    // which resolves to a per-user default when `CLAW_OPENAI_ENV_FILE` is unset.
    map.insert("_can_save".to_string(), serde_json::Value::Bool(true));
    Json(serde_json::Value::Object(map)).into_response()
}

/// Rewrite only the known settings keys in the env file (preserving everything else).
/// Persists the values so they survive a cold restart; the live process applies them
/// immediately without restarting (see `ui_settings_save_restart`). Atomic write via
/// temp + rename, preserving the existing file mode on unix (the file holds the API key).
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
    // Prefer a crash-safe atomic write (temp file + rename); it also lets us lock down the
    // mode before the file is visible. But temp+rename needs write permission on the parent
    // *directory*. Hardened installs make the env file group-writable yet keep its directory
    // root-owned (e.g. /etc/claw-lab), so the atomic path fails there with EACCES — fall back
    // to rewriting the existing file in place, which only needs write permission on the file
    // itself and preserves its mode (the inode is unchanged).
    match atomic_write_env_file(path, &out) {
        Ok(()) => Ok(()),
        Err(_) if path.exists() => std::fs::write(path, out.as_bytes()).map_err(|e| e.to_string()),
        Err(error) => Err(error),
    }
}

/// Crash-safe write: stage the new contents into a sibling temp file (carrying over the env
/// file's mode so the API key never lands in a world-readable file) and rename over the
/// target. Requires write permission on the parent directory; `write_env_file` falls back to
/// an in-place write when that is not available (root-owned config dir + group-writable file).
fn atomic_write_env_file(path: &std::path::Path, contents: &str) -> Result<(), String> {
    let tmp = path.with_extension("env.tmp");
    std::fs::write(&tmp, contents.as_bytes()).map_err(|e| e.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        // The env file holds secrets (API key). `fs::write` creates the temp file with umask
        // permissions (usually 0644); the rename would silently replace the installer's
        // restrictive mode (0640) with a world-readable file. Carry over the existing file's
        // mode, falling back to owner-only.
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
    State(state): State<Arc<OpenAiServerState>>,
    Json(updates): Json<std::collections::HashMap<String, String>>,
) -> Response {
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
    // Persist to the env file (so the setting survives a cold restart), creating the
    // parent directory if it does not exist yet (per-user default on manual launches).
    let path = super::resolve_openai_env_file();
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if let Err(error) = write_env_file(&path, &updates) {
        return (StatusCode::INTERNAL_SERVER_ERROR, format!("write env: {error}")).into_response();
    }
    // Apply live — no restart. Env-read settings (base URL, key, web-search URL) go into
    // the process environment, where the per-request engine resolution reads them; the
    // model / served id / permission mode live in the server state and update in place.
    for key in SETTINGS_KEYS {
        if let Some(value) = updates.get(*key) {
            std::env::set_var(key, value);
        }
    }
    state.apply_settings(&updates);
    Json(serde_json::json!({ "ok": true, "applied": true })).into_response()
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
/// `workspaceFolder` is the single user-chosen working folder (a scalar path; deep
/// merge replaces it, and an empty string clears it). It is distinct from the advanced
/// `trustedRoots` list and is surfaced to the model as the folder "we work in".
const UI_CONFIG_KEYS: &[&str] = &["sandbox", "trustedRoots", "permissions", "workspaceFolder"];
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
    // The user-chosen working folder (empty string when unset). `workspaceFolderDefault`
    // is a non-binding per-OS suggestion (home dir) the UI can prefill; the effective
    // folder stays empty until the user picks one.
    out.insert(
        "workspaceFolder".to_string(),
        existing
            .get("workspaceFolder")
            .cloned()
            .unwrap_or_else(|| Value::String(String::new())),
    );
    out.insert(
        "workspaceFolderDefault".to_string(),
        Value::String(
            runtime::default_workspace_folder()
                .map(|path| path.to_string_lossy().into_owned())
                .unwrap_or_default(),
        ),
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

/// The top-level drives/roots the folder picker can jump to. Cross-platform: Windows
/// returns the existing drive letters (`C:\`, `D:\`, …); macOS returns `/` plus mounted
/// volumes under `/Volumes`; Linux returns `/` plus the real disk mount points from
/// `/proc/mounts` (e.g. `/DATA`), filtering out pseudo-filesystems. A future macOS port
/// already gets its branch here.
#[cfg(windows)]
fn drive_roots() -> Vec<String> {
    let mut roots = Vec::new();
    for letter in b'A'..=b'Z' {
        let path = format!("{}:\\", letter as char);
        if std::path::Path::new(&path).exists() {
            roots.push(path);
        }
    }
    roots
}

#[cfg(target_os = "macos")]
fn drive_roots() -> Vec<String> {
    let mut roots = vec!["/".to_string()];
    if let Ok(entries) = std::fs::read_dir("/Volumes") {
        for entry in entries.flatten() {
            if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                roots.push(entry.path().to_string_lossy().into_owned());
            }
        }
    }
    roots
}

#[cfg(target_os = "linux")]
fn drive_roots() -> Vec<String> {
    // Real on-disk filesystems only — skip tmpfs/proc/sysfs/cgroup/overlay/etc. so the list
    // shows actual disks (the root plus extra mounts like /DATA), not kernel pseudo-mounts.
    const REAL_FS: &[&str] = &[
        "ext2", "ext3", "ext4", "xfs", "btrfs", "f2fs", "reiserfs", "jfs", "zfs", "vfat",
        "exfat", "ntfs", "ntfs3", "fuseblk", "udf", "hfsplus",
    ];
    let mut roots = vec!["/".to_string()];
    if let Ok(mounts) = std::fs::read_to_string("/proc/mounts") {
        for line in mounts.lines() {
            let mut fields = line.split_whitespace();
            let _device = fields.next();
            let mount_point = fields.next();
            let fs_type = fields.next();
            if let (Some(mount_point), Some(fs_type)) = (mount_point, fs_type) {
                // /proc/mounts octal-escapes spaces (\040) and a few others; decode the common one.
                let mount_point = mount_point.replace("\\040", " ");
                if REAL_FS.contains(&fs_type) && mount_point != "/" && !roots.contains(&mount_point) {
                    roots.push(mount_point);
                }
            }
        }
    }
    roots
}

#[cfg(all(unix, not(target_os = "linux"), not(target_os = "macos")))]
fn drive_roots() -> Vec<String> {
    vec!["/".to_string()]
}

/// List directories under a path so the UI can pick a working folder *on this server*.
/// A browser folder picker would target the user's own machine, not the agent host, so we
/// expose the server's own filesystem here. Read-only — returns directory names only, never
/// file contents. Gated by `CLAW_UI_TOKEN` like every `/ui/*` endpoint. With no `path` it
/// starts at the per-OS home; callers climb via the returned `parent`.
pub(super) async fn ui_browse(Query(params): Query<std::collections::HashMap<String, String>>) -> Response {
    use std::path::PathBuf;
    let requested = params
        .get("path")
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());
    let base: PathBuf = match requested {
        Some(p) => PathBuf::from(p),
        None => runtime::default_workspace_folder().unwrap_or_else(|| PathBuf::from("/")),
    };
    // Resolve symlinks/.. where possible so `parent` navigation is stable; fall back to the
    // lexical path if canonicalization fails (e.g. a dangling entry).
    // Canonicalize to stabilize `parent` navigation, then drop the Windows verbatim prefix
    // (`\\?\…`) so the picker shows and re-navigates with ordinary native paths. Falls back to
    // the lexical path if canonicalization fails (e.g. a dangling entry).
    let dir = std::fs::canonicalize(&base)
        .map(|resolved| runtime::strip_verbatim_prefix(&resolved))
        .unwrap_or(base);
    if !std::fs::metadata(&dir).map(|m| m.is_dir()).unwrap_or(false) {
        return (
            StatusCode::BAD_REQUEST,
            format!("not a directory: {}", dir.display()),
        )
            .into_response();
    }
    let mut dirs: Vec<String> = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&dir) {
        for entry in entries.flatten() {
            // Directories only; skip entries we can't stat. Hidden dirs are kept — an operator
            // may legitimately want `~/.config` and the like as a working folder.
            if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                if let Some(name) = entry.file_name().to_str() {
                    dirs.push(name.to_string());
                }
            }
        }
    }
    dirs.sort_by_key(|name| name.to_lowercase());
    let parent = dir.parent().map(|p| p.to_string_lossy().into_owned());
    Json(serde_json::json!({
        "path": dir.to_string_lossy(),
        "parent": parent,
        "dirs": dirs,
        "roots": drive_roots(),
        // The OS path separator, so the browser joins child paths correctly regardless of
        // which platform's filesystem it is browsing (`\` on Windows, `/` elsewhere).
        "sep": std::path::MAIN_SEPARATOR.to_string(),
    }))
    .into_response()
}

/// Coerce a JSON value to a positive integer, accepting both numbers and numeric strings
/// (some backends report context sizes as strings).
fn as_pos_u64(value: &Value) -> Option<u64> {
    value
        .as_u64()
        .or_else(|| value.as_str().and_then(|s| s.trim().parse::<u64>().ok()))
        .filter(|n| *n > 0)
}

/// Total timeout for backend metadata probes (`/models`, Ollama `/api/show`).
///
/// These response bodies are tiny, but the probe must tolerate a high-latency link —
/// a LAN backend reached over a VPN, or a cloud endpoint. The previous fixed 5s was
/// *shorter* than the backend connect timeout itself (10s default), so a slow link
/// aborted the probe before it could even connect, leaving the context gauge blank
/// while the chat (which sets no total request timeout) still worked. Scale with the
/// configured connect timeout so this tracks `CLAW_BACKEND_CONNECT_TIMEOUT_SECS`
/// instead of hardcoding a second, inconsistent number.
fn probe_timeout() -> std::time::Duration {
    api::TimeoutConfig::from_env()
        .connect_timeout
        .unwrap_or_else(|| std::time::Duration::from_secs(10))
        + std::time::Duration::from_secs(5)
}

/// Extract the model context window from an OpenAI-compatible `/models` JSON body.
///
/// There is no standard field for this across backends, so probe the known shapes in
/// priority order: `max_model_len` (vLLM) → `meta.n_ctx` (llama.cpp) → generic
/// `context_length` / `max_context_length` / `n_ctx`. Deliberately NOT `n_ctx_train`
/// (the training maximum overstates the actually-loaded window). Returns `None` when the
/// backend exposes nothing recognizable — the UI then shows a plain token counter without a
/// window (Ollama / LM Studio / cloud fall here until per-backend probes are added).
fn context_window_from_models(body: &Value, model_id: Option<&str>) -> Option<u64> {
    let list = body
        .get("data")
        .or_else(|| body.get("models"))
        .and_then(Value::as_array);
    let entry = list.and_then(|items| {
        model_id
            .and_then(|id| {
                items.iter().find(|m| {
                    m.get("id").and_then(Value::as_str) == Some(id)
                        || m.get("name").and_then(Value::as_str) == Some(id)
                })
            })
            .or_else(|| items.first())
    });
    let m = entry.unwrap_or(body);
    for key in ["max_model_len", "context_length", "max_context_length", "n_ctx"] {
        if let Some(n) = m.get(key).and_then(as_pos_u64) {
            return Some(n);
        }
    }
    m.get("meta")
        .and_then(|meta| meta.get("n_ctx"))
        .and_then(as_pos_u64)
}

/// First model id/name from an OpenAI-style `/models` body — backends like Ollama whose
/// native endpoints need a concrete model name to query.
fn first_model_id(body: &Value) -> Option<String> {
    let list = body
        .get("data")
        .or_else(|| body.get("models"))
        .and_then(Value::as_array)?;
    let m = list.first()?;
    m.get("id")
        .or_else(|| m.get("name"))
        .or_else(|| m.get("model"))
        .and_then(Value::as_str)
        .map(str::to_string)
}

/// Ollama fallback: its OpenAI `/v1/models` shape exposes no context length, so query the
/// native `/api/show` (sibling of the OpenAI base) and read `<arch>.context_length` from
/// `model_info`. Returns `None` for non-Ollama backends (the call simply fails / 404s).
async fn ollama_context_window(base: &str, key: &str, model: &str) -> Option<u64> {
    let root = base.strip_suffix("/v1").unwrap_or(base).trim_end_matches('/');
    let url = format!("{root}/api/show");
    let client = api::build_http_client_or_default();
    // Accept both the current (`model`) and legacy (`name`) parameter spellings.
    let mut req = client
        .post(&url)
        .timeout(probe_timeout())
        .json(&serde_json::json!({ "model": model, "name": model }));
    if !key.is_empty() {
        req = req.bearer_auth(key);
    }
    let body = req.send().await.ok()?.json::<Value>().await.ok()?;
    let info = body.get("model_info").and_then(Value::as_object)?;
    if let Some(arch) = info.get("general.architecture").and_then(Value::as_str) {
        if let Some(n) = info.get(&format!("{arch}.context_length")).and_then(as_pos_u64) {
            return Some(n);
        }
    }
    info.iter()
        .find(|(k, _)| k.ends_with(".context_length"))
        .and_then(|(_, v)| as_pos_u64(v))
}

/// Detect the context window from an already-fetched `/models` body, with the Ollama native
/// fallback when the OpenAI shape exposes nothing recognizable.
async fn window_from_models_or_ollama(
    base: &str,
    key: &str,
    body: &Value,
    preferred_model: Option<&str>,
) -> Option<u64> {
    if let Some(n) = context_window_from_models(body, preferred_model) {
        return Some(n);
    }
    let model = first_model_id(body)?;
    ollama_context_window(base, key, &model).await
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
        return no_store_json(serde_json::json!({ "ok": false, "error": "invalid URL" }));
    }
    let url = format!("{base}/models");
    let client = api::build_http_client_or_default();
    let mut probe = client.get(&url).timeout(probe_timeout());
    let key = request.api_key.trim();
    if !key.is_empty() {
        probe = probe.bearer_auth(key);
    }
    match probe.send().await {
        Ok(response) if response.status().is_success() => {
            // Reuse the round-trip to also report the context window for the settings UX.
            let window = match response.json::<Value>().await {
                Ok(body) => window_from_models_or_ollama(&base, key, &body, None).await,
                Err(_) => None,
            };
            no_store_json(serde_json::json!({ "ok": true, "context_window": window }))
        }
        Ok(response) => no_store_json(serde_json::json!({
            "ok": false,
            "error": format!("HTTP {}", response.status()),
        })),
        Err(error) => {
            no_store_json(serde_json::json!({ "ok": false, "error": error.to_string() }))
        }
    }
}

/// Wrap a JSON body with `Cache-Control: no-store`. Used by the live backend probes
/// (`/ui/model-info`, `/ui/check-backend`): their value is a fresh per-request probe, so a
/// browser or proxy must never serve a stale copy — otherwise a `null` cached on the first
/// load (backend not yet reachable, e.g. over VPN) sticks until a hard refresh.
fn no_store_json(value: Value) -> Response {
    let mut resp = Json(value).into_response();
    resp.headers_mut().insert(
        axum::http::header::CACHE_CONTROL,
        axum::http::HeaderValue::from_static("no-store"),
    );
    resp
}

/// Report the active backend's context window to the UI (for the context-usage gauge).
/// Queries the configured backend `<base>/models` server-side — the browser can't reach it —
/// and parses the window by known fields. Returns `{ "context_window": null }` when the
/// backend or window is unknown, so the UI degrades to a plain token counter. No manual
/// override: the value is auto-detected or absent, keeping the settings surface unchanged.
pub(super) async fn ui_model_info(State(state): State<Arc<OpenAiServerState>>) -> Response {
    let base = std::env::var("OPENAI_BASE_URL")
        .ok()
        .map(|b| b.trim().trim_end_matches('/').to_string())
        .filter(|b| b.starts_with("http://") || b.starts_with("https://"));
    let model = state.backend_model();
    let Some(base) = base else {
        return no_store_json(serde_json::json!({ "context_window": Value::Null, "model": model }));
    };
    let key = std::env::var("OPENAI_API_KEY")
        .ok()
        .map(|k| k.trim().to_string())
        .filter(|k| !k.is_empty())
        .unwrap_or_default();
    let url = format!("{base}/models");
    let client = api::build_http_client_or_default();
    let mut req = client.get(&url).timeout(probe_timeout());
    if !key.is_empty() {
        req = req.bearer_auth(key.clone());
    }
    let window = match req.send().await {
        Ok(response) if response.status().is_success() => match response.json::<Value>().await {
            Ok(body) => window_from_models_or_ollama(&base, &key, &body, Some(&model)).await,
            Err(_) => None,
        },
        _ => None,
    };
    no_store_json(serde_json::json!({ "context_window": window, "model": model }))
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
    let backend_model = state.backend_model();
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

#[derive(Deserialize)]
pub(super) struct SummarizeRequest {
    text: String,
}

/// Summarize an earlier slice of a conversation into compact recap text. Used by the UI's
/// client-side context compaction: the browser folds older turns into this summary, keeps a
/// recent tail verbatim, and sends the shorter history onward — so the compaction persists
/// across turns (unlike the per-request server-side auto-compaction). One-shot, tools off,
/// like `ui_title`, so the model only writes prose and never acts on the snippet.
pub(super) async fn ui_summarize(
    State(state): State<Arc<OpenAiServerState>>,
    Json(request): Json<SummarizeRequest>,
) -> Response {
    let backend_model = state.backend_model();
    let text = request.text;
    let summary = tokio::task::spawn_blocking(move || {
        let system = vec![
            "You compress an earlier portion of a conversation into a concise summary that \
             preserves the facts, decisions, code, names, numbers, and still-open threads \
             needed to continue seamlessly. Write in the language of the conversation. Output \
             ONLY the summary prose — no preamble, no questions, no acting on the content."
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
            .run_prompt_json(&format!("Conversation to summarize:\n{text}"))
            .ok()
            .map(|response| response.message)
    })
    .await
    .ok()
    .flatten()
    .unwrap_or_default();
    Json(serde_json::json!({ "summary": summary })).into_response()
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

    #[cfg(unix)]
    #[test]
    fn write_env_file_falls_back_to_in_place_when_dir_is_read_only() {
        // Reproduces the hardened-install layout: the env file is group-writable but its
        // directory is root-owned (not writable by the service user), so the atomic
        // temp+rename cannot stage a sibling file. The in-place fallback must still persist
        // the change. Regression for the Linux settings-save EACCES.
        use std::os::unix::fs::PermissionsExt;

        let unique = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("clab-env-test-{unique}"));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("openai.env");
        std::fs::write(&path, "OPENAI_MODEL=old\nUNRELATED=keep\n").unwrap();

        // Read+execute but NOT write: blocks creating/renaming entries in the dir while an
        // existing file inside it stays writable — exactly the bой layout.
        std::fs::set_permissions(&dir, std::fs::Permissions::from_mode(0o555)).unwrap();

        let mut updates = std::collections::HashMap::new();
        updates.insert("OPENAI_MODEL".to_string(), "new".to_string());
        let result = write_env_file(&path, &updates);

        // Restore dir perms first so cleanup can proceed regardless of the assertions.
        std::fs::set_permissions(&dir, std::fs::Permissions::from_mode(0o755)).unwrap();

        result.expect("in-place fallback should persist when the dir is not writable");
        let content = std::fs::read_to_string(&path).unwrap();
        assert!(content.contains("OPENAI_MODEL=new"), "updated key not written: {content}");
        assert!(content.contains("UNRELATED=keep"), "unrelated line not preserved: {content}");

        let _ = std::fs::remove_dir_all(&dir);
    }
}
