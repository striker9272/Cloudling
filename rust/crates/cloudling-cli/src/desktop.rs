//! Thin adapter between the CLI and the `cloudling-desktop` crate.
//!
//! All Windows FFI `unsafe` lives in `cloudling-desktop` (the quarantine crate) so
//! this crate keeps the upstream `unsafe_code = "forbid"`. Here we only wire the
//! CLI's types into `cloudling-desktop`'s decoupled API: build the `serve` closure
//! (which starts the OpenAI server + built-in UI) and collect the per-user data
//! directories to remove on uninstall.

use std::collections::BTreeSet;
use std::path::PathBuf;

use crate::AllowedToolSet;
use runtime::PermissionMode;

pub(crate) fn run_tray(
    bind: String,
    model: String,
    allowed_tools: Option<AllowedToolSet>,
    // `None` = no explicit `--permission-mode`; the serve path adopts the persisted
    // CLAW_PERMISSION_MODE at startup (fallback read-only). `Some` = explicit override.
    permission_mode: Option<PermissionMode>,
) -> Result<(), Box<dyn std::error::Error>> {
    let serve_bind = bind.clone();
    cloudling_desktop::run_tray(bind, move || {
        // The tray always serves the built-in UI; an unconfigured engine is
        // fine (configured in the browser), exactly like `openai-serve --ui`.
        // Return the outcome as a string so the tray can surface a startup
        // failure (e.g. the port already in use) instead of vanishing.
        crate::openai_server::serve_blocking(serve_bind, model, allowed_tools, permission_mode, true)
            .map_err(|error| error.to_string())
    })
}

pub(crate) fn run_uninstall(assume_yes: bool) -> Result<(), Box<dyn std::error::Error>> {
    cloudling_desktop::run_uninstall(uninstall_data_dirs(), assume_yes)
}

pub(crate) fn launched_by_double_click() -> bool {
    cloudling_desktop::launched_by_double_click()
}

/// The per-user directories an uninstall should remove: the config home
/// (settings, keys, env) and the UI data dir (conversations DB). They share a
/// root by default but can diverge via `CLAW_CONFIG_HOME` / `CLOUDLING_UI_DATA_DIR`,
/// so collect both and de-duplicate.
fn uninstall_data_dirs() -> Vec<PathBuf> {
    let mut seen = BTreeSet::new();
    [
        runtime::default_config_home(),
        crate::dialog_store::resolve_data_dir(),
    ]
    .into_iter()
    .filter(|dir| seen.insert(dir.clone()))
    .collect()
}
