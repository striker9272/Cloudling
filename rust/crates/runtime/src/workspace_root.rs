//! Ambient, per-thread "workspace root" used by tool execution.
//!
//! The OpenAI-serve path runs each request on its own blocking thread and wants
//! each conversation to resolve filesystem paths against its own directory rather
//! than the single process-wide current directory. A scope guard sets the active
//! root for the current thread; tools call [`current_workspace_root`] instead of
//! `std::env::current_dir` and transparently fall back to the process cwd when no
//! root is active (CLI, tests, subagents).
use std::cell::RefCell;
use std::path::{Path, PathBuf};

use crate::sandbox::FilesystemIsolationMode;

thread_local! {
    static ACTIVE_WORKSPACE_ROOT: RefCell<Option<PathBuf>> = const { RefCell::new(None) };
}

/// RAII guard that restores the previously active workspace root on drop.
#[must_use]
pub struct WorkspaceRootGuard {
    previous: Option<PathBuf>,
}

impl Drop for WorkspaceRootGuard {
    fn drop(&mut self) {
        let previous = self.previous.take();
        ACTIVE_WORKSPACE_ROOT.with(|cell| {
            *cell.borrow_mut() = previous;
        });
    }
}

/// Sets the active workspace root for the current thread until the returned guard
/// is dropped. Passing `None` clears it for the scope. Nested scopes restore the
/// prior value on drop.
pub fn scoped_workspace_root(root: Option<PathBuf>) -> WorkspaceRootGuard {
    let previous = ACTIVE_WORKSPACE_ROOT.with(|cell| {
        let mut slot = cell.borrow_mut();
        std::mem::replace(&mut *slot, root)
    });
    WorkspaceRootGuard { previous }
}

/// Returns the active per-run workspace root if one is set for this thread,
/// otherwise the process current directory.
pub fn current_workspace_root() -> std::io::Result<PathBuf> {
    if let Some(root) = ACTIVE_WORKSPACE_ROOT.with(|cell| cell.borrow().clone()) {
        return Ok(root);
    }
    std::env::current_dir()
}

/// Filesystem-access policy for the dedicated file tools (read/write/edit/glob/
/// grep), resolved per run from the merged sandbox config — the same
/// `settings.json` the bash sandbox and the UI "Security" panel use. This is what
/// makes `filesystemMode` govern the file tools, not just bash.
#[derive(Debug, Clone)]
pub struct FilesystemPolicy {
    pub mode: FilesystemIsolationMode,
    pub trusted_roots: Vec<PathBuf>,
}

impl Default for FilesystemPolicy {
    fn default() -> Self {
        // Safe default = today's behavior: confine the file tools to the workspace.
        Self {
            mode: FilesystemIsolationMode::WorkspaceOnly,
            trusted_roots: Vec::new(),
        }
    }
}

thread_local! {
    static ACTIVE_FS_POLICY: RefCell<Option<FilesystemPolicy>> = const { RefCell::new(None) };
}

/// RAII guard that restores the previously active filesystem policy on drop.
#[must_use]
pub struct FilesystemPolicyGuard {
    previous: Option<FilesystemPolicy>,
}

impl Drop for FilesystemPolicyGuard {
    fn drop(&mut self) {
        let previous = self.previous.take();
        ACTIVE_FS_POLICY.with(|cell| {
            *cell.borrow_mut() = previous;
        });
    }
}

/// Sets the active filesystem policy for the current thread until the returned
/// guard is dropped. Mirrors [`scoped_workspace_root`]; each serve request runs on
/// its own thread, so this gives a per-run policy without global state.
pub fn scoped_filesystem_policy(policy: Option<FilesystemPolicy>) -> FilesystemPolicyGuard {
    let previous = ACTIVE_FS_POLICY.with(|cell| {
        let mut slot = cell.borrow_mut();
        std::mem::replace(&mut *slot, policy)
    });
    FilesystemPolicyGuard { previous }
}

/// Returns the active per-run filesystem policy, or the safe default
/// (workspace-only) when none is set (CLI, tests, subagents).
#[must_use]
pub fn current_filesystem_policy() -> FilesystemPolicy {
    ACTIVE_FS_POLICY
        .with(|cell| cell.borrow().clone())
        .unwrap_or_default()
}

/// Resolve the filesystem policy from the merged config for a directory context.
/// Reads `settings.json` the same way the bash sandbox does, so changes from the
/// UI "Security" panel apply on the next request without a restart. Falls back to
/// the safe default if the config can't be loaded.
#[must_use]
pub fn load_filesystem_policy_for(cwd: Option<&Path>) -> FilesystemPolicy {
    let cwd = match cwd {
        Some(path) => path.to_path_buf(),
        None => std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")),
    };
    match crate::config::ConfigLoader::default_for(cwd).load() {
        Ok(config) => {
            // Effective allow-list roots = configured trusted roots ∪ the single working
            // folder (when set). The working folder is the source of truth surfaced in the
            // UI; merging it here lets the "Рабочая папка" preset (allow-list mode) reach it
            // without duplicating the path into `trustedRoots`. In `off`/`workspace-only`
            // modes the extra root is simply unused.
            let mut trusted_roots: Vec<PathBuf> =
                config.trusted_roots().iter().map(PathBuf::from).collect();
            if let Some(folder) = config.workspace_folder() {
                let folder = PathBuf::from(folder);
                if !trusted_roots.contains(&folder) {
                    trusted_roots.push(folder);
                }
            }
            FilesystemPolicy {
                mode: config.sandbox().filesystem_mode.unwrap_or_default(),
                trusted_roots,
            }
        }
        Err(_) => FilesystemPolicy::default(),
    }
}

#[cfg(test)]
mod tests {
    use super::{current_workspace_root, scoped_workspace_root};
    use std::path::PathBuf;

    #[test]
    fn falls_back_to_process_cwd_when_no_scope_is_active() {
        let expected = std::env::current_dir().expect("cwd");
        assert_eq!(current_workspace_root().expect("root"), expected);
    }

    #[test]
    fn scope_overrides_root_and_restores_on_drop() {
        let scoped = PathBuf::from("/tmp/clab-test-root");
        {
            let _guard = scoped_workspace_root(Some(scoped.clone()));
            assert_eq!(current_workspace_root().expect("root"), scoped);
        }
        // After the guard drops, we fall back to the process cwd again.
        assert_eq!(
            current_workspace_root().expect("root"),
            std::env::current_dir().expect("cwd")
        );
    }

    #[test]
    fn nested_scopes_restore_the_previous_root() {
        let outer = PathBuf::from("/tmp/clab-outer");
        let inner = PathBuf::from("/tmp/clab-inner");
        let _outer_guard = scoped_workspace_root(Some(outer.clone()));
        assert_eq!(current_workspace_root().expect("root"), outer);
        {
            let _inner_guard = scoped_workspace_root(Some(inner.clone()));
            assert_eq!(current_workspace_root().expect("root"), inner);
        }
        // Inner guard dropped → back to the outer root, not the process cwd.
        assert_eq!(current_workspace_root().expect("root"), outer);
    }
}
