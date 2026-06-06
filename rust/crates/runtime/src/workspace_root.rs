//! Ambient, per-thread "workspace root" used by tool execution.
//!
//! The OpenAI-serve path runs each request on its own blocking thread and wants
//! each conversation to resolve filesystem paths against its own directory rather
//! than the single process-wide current directory. A scope guard sets the active
//! root for the current thread; tools call [`current_workspace_root`] instead of
//! `std::env::current_dir` and transparently fall back to the process cwd when no
//! root is active (CLI, tests, subagents).
use std::cell::RefCell;
use std::path::PathBuf;

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
