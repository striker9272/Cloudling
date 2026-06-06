//! Verifies that the ambient per-run workspace root isolates tool filesystem
//! access between conversations: a relative file written under one scoped root is
//! not visible from another, and lands in the scoped directory rather than the
//! process current directory.
use runtime::scoped_workspace_root;
use runtime::{permission_enforcer::PermissionEnforcer, PermissionMode, PermissionPolicy};
use serde_json::json;
use std::fs;
use std::path::PathBuf;
use tools::{mvp_tool_specs, GlobalToolRegistry};

fn temp_dir(name: &str) -> PathBuf {
    let unique = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("time")
        .as_nanos();
    let path = std::env::temp_dir().join(format!("clab-ws-iso-{unique}-{name}"));
    fs::create_dir_all(&path).expect("create temp workspace");
    path
}

fn workspace_write_registry() -> GlobalToolRegistry {
    let policy = mvp_tool_specs().into_iter().fold(
        PermissionPolicy::new(PermissionMode::WorkspaceWrite),
        |policy, spec| policy.with_tool_requirement(spec.name, spec.required_permission),
    );
    GlobalToolRegistry::builtin().with_enforcer(PermissionEnforcer::new(policy))
}

#[test]
fn relative_writes_land_in_the_scoped_root_and_are_isolated_between_scopes() {
    let dialog_a = temp_dir("a");
    let dialog_b = temp_dir("b");

    // Dialog A writes a relative file; it must land inside dialog A's root.
    {
        let _guard = scoped_workspace_root(Some(dialog_a.clone()));
        workspace_write_registry()
            .execute("write_file", &json!({ "path": "note.txt", "content": "from A" }))
            .expect("write in dialog A should succeed");
    }
    assert_eq!(
        fs::read_to_string(dialog_a.join("note.txt")).expect("A/note.txt exists"),
        "from A"
    );

    // Dialog B must not see dialog A's relative file, and its own write stays in B.
    {
        let _guard = scoped_workspace_root(Some(dialog_b.clone()));
        let read_back = workspace_write_registry()
            .execute("read_file", &json!({ "path": "note.txt" }));
        assert!(
            read_back.is_err(),
            "dialog B must not see dialog A's note.txt, got: {read_back:?}"
        );
        workspace_write_registry()
            .execute("write_file", &json!({ "path": "note.txt", "content": "from B" }))
            .expect("write in dialog B should succeed");
    }

    // Each dialog's file is its own; no cross-contamination.
    assert_eq!(
        fs::read_to_string(dialog_b.join("note.txt")).expect("B/note.txt exists"),
        "from B"
    );
    assert_eq!(
        fs::read_to_string(dialog_a.join("note.txt")).expect("A/note.txt still exists"),
        "from A"
    );

    let _ = fs::remove_dir_all(&dialog_a);
    let _ = fs::remove_dir_all(&dialog_b);
}
