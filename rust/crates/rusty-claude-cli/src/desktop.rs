//! Thin adapter between the CLI and the `clab-desktop` crate.
//!
//! All Windows FFI `unsafe` lives in `clab-desktop` (the quarantine crate) so
//! this crate keeps the upstream `unsafe_code = "forbid"`. Here we only wire the
//! CLI's types into `clab-desktop`'s decoupled API: build the `serve` closure
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
    permission_mode: PermissionMode,
) -> Result<(), Box<dyn std::error::Error>> {
    let serve_bind = bind.clone();
    clab_desktop::run_tray(bind, move || {
        // The tray always serves the built-in UI; an unconfigured engine is
        // fine (configured in the browser), exactly like `openai-serve --ui`.
        if let Err(error) = crate::openai_server::serve_blocking(
            serve_bind,
            model,
            allowed_tools,
            permission_mode,
            true,
        ) {
            eprintln!("clab tray: server stopped with error: {error}");
        }
    })
}

pub(crate) fn run_uninstall(assume_yes: bool) -> Result<(), Box<dyn std::error::Error>> {
    clab_desktop::run_uninstall(uninstall_data_dirs(), assume_yes)
}

pub(crate) fn launched_by_double_click() -> bool {
    clab_desktop::launched_by_double_click()
}

/// The per-user directories an uninstall should remove: the config home
/// (settings, keys, env) and the UI data dir (conversations DB). They share a
/// root by default but can diverge via `CLAW_CONFIG_HOME` / `CLAW_UI_DATA_DIR`,
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
