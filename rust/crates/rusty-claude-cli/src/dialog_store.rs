//! SQLite-backed storage for the built-in web UI's chat transcripts.
//!
//! Used only when `openai-serve --ui` is active. The chat endpoint itself stays
//! stateless (the client sends the full history every turn); this is a separate
//! persistence layer so the UI can list and reopen past dialogs. The location is
//! `CLAW_UI_DATA_DIR` with a portable default under the config home — never hardcoded.

use std::path::PathBuf;
use std::sync::Mutex;

use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;

const SCHEMA: &str = r"
CREATE TABLE IF NOT EXISTS dialogs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    created_ms INTEGER NOT NULL,
    updated_ms INTEGER NOT NULL,
    messages_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_dialogs_updated ON dialogs(updated_ms DESC);
CREATE TABLE IF NOT EXISTS presets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    prompt TEXT NOT NULL,
    created_ms INTEGER NOT NULL,
    updated_ms INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS ui_kv (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
";

/// Resolve the UI data directory. `CLAW_UI_DATA_DIR` wins; otherwise a portable
/// default under the config home (`CLAW_CONFIG_HOME`/ui, else `$HOME`/.claw/ui).
pub fn resolve_data_dir() -> PathBuf {
    if let Ok(dir) = std::env::var("CLAW_UI_DATA_DIR") {
        let dir = dir.trim();
        if !dir.is_empty() {
            return PathBuf::from(dir);
        }
    }
    if let Ok(home) = std::env::var("CLAW_CONFIG_HOME") {
        let home = home.trim();
        if !home.is_empty() {
            return PathBuf::from(home).join("ui");
        }
    }
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home).join(".claw").join("ui")
}

#[derive(Serialize)]
pub struct DialogSummary {
    pub id: String,
    pub title: String,
    pub updated_ms: i64,
}

#[derive(Serialize)]
pub struct Dialog {
    pub id: String,
    pub title: String,
    pub created_ms: i64,
    pub updated_ms: i64,
    pub messages: serde_json::Value,
}

#[derive(Serialize)]
pub struct Preset {
    pub id: String,
    pub name: String,
    pub prompt: String,
    pub created_ms: i64,
    pub updated_ms: i64,
}

/// Thread-safe handle to the dialog database (single connection behind a mutex —
/// concurrency here is low and the writes are tiny). Also holds UI presets and a
/// small key/value table for UI preferences (e.g. the active preset).
pub struct DialogStore {
    conn: Mutex<Connection>,
}

fn now_ms() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| i64::try_from(d.as_millis()).unwrap_or(i64::MAX))
        .unwrap_or(0)
}

impl DialogStore {
    /// Open the dialog database under the resolved data dir, creating the directory
    /// and schema if needed.
    pub fn open() -> Result<Self, String> {
        let dir = resolve_data_dir();
        std::fs::create_dir_all(&dir).map_err(|e| format!("create {}: {e}", dir.display()))?;
        let path = dir.join("dialogs.sqlite");
        let conn = Connection::open(&path).map_err(|e| e.to_string())?;
        conn.execute_batch("PRAGMA journal_mode = WAL;")
            .map_err(|e| e.to_string())?;
        conn.execute_batch(SCHEMA).map_err(|e| e.to_string())?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    /// All dialogs, newest first (id, title, updated_ms only).
    pub fn list(&self) -> Result<Vec<DialogSummary>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT id, title, updated_ms FROM dialogs ORDER BY updated_ms DESC")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |r| {
                Ok(DialogSummary {
                    id: r.get(0)?,
                    title: r.get(1)?,
                    updated_ms: r.get(2)?,
                })
            })
            .map_err(|e| e.to_string())?;
        let mut out = Vec::new();
        for row in rows {
            out.push(row.map_err(|e| e.to_string())?);
        }
        Ok(out)
    }

    /// One full dialog (with messages), or `None` if absent.
    pub fn get(&self, id: &str) -> Result<Option<Dialog>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let row = conn
            .query_row(
                "SELECT id, title, created_ms, updated_ms, messages_json FROM dialogs WHERE id = ?1",
                params![id],
                |r| {
                    Ok((
                        r.get::<_, String>(0)?,
                        r.get::<_, String>(1)?,
                        r.get::<_, i64>(2)?,
                        r.get::<_, i64>(3)?,
                        r.get::<_, String>(4)?,
                    ))
                },
            )
            .optional()
            .map_err(|e| e.to_string())?;
        Ok(row.map(|(id, title, created_ms, updated_ms, messages_json)| {
            let messages = serde_json::from_str(&messages_json)
                .unwrap_or_else(|_| serde_json::Value::Array(Vec::new()));
            Dialog {
                id,
                title,
                created_ms,
                updated_ms,
                messages,
            }
        }))
    }

    /// Insert or update a dialog. Keeps the original `created_ms` on update and
    /// always bumps `updated_ms`.
    pub fn upsert(
        &self,
        id: &str,
        title: &str,
        messages: &serde_json::Value,
    ) -> Result<DialogSummary, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let now = now_ms();
        let messages_json = serde_json::to_string(messages).map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO dialogs (id, title, created_ms, updated_ms, messages_json)
             VALUES (?1, ?2, ?3, ?3, ?4)
             ON CONFLICT(id) DO UPDATE SET title = ?2, updated_ms = ?3, messages_json = ?4",
            params![id, title, now, messages_json],
        )
        .map_err(|e| e.to_string())?;
        Ok(DialogSummary {
            id: id.to_string(),
            title: title.to_string(),
            updated_ms: now,
        })
    }

    pub fn delete(&self, id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM dialogs WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    // ---- system-prompt presets ----

    /// All presets, oldest first.
    pub fn list_presets(&self) -> Result<Vec<Preset>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT id, name, prompt, created_ms, updated_ms FROM presets ORDER BY created_ms ASC")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |r| {
                Ok(Preset {
                    id: r.get(0)?,
                    name: r.get(1)?,
                    prompt: r.get(2)?,
                    created_ms: r.get(3)?,
                    updated_ms: r.get(4)?,
                })
            })
            .map_err(|e| e.to_string())?;
        let mut out = Vec::new();
        for row in rows {
            out.push(row.map_err(|e| e.to_string())?);
        }
        Ok(out)
    }

    pub fn upsert_preset(&self, id: &str, name: &str, prompt: &str) -> Result<Preset, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let now = now_ms();
        conn.execute(
            "INSERT INTO presets (id, name, prompt, created_ms, updated_ms)
             VALUES (?1, ?2, ?3, ?4, ?4)
             ON CONFLICT(id) DO UPDATE SET name = ?2, prompt = ?3, updated_ms = ?4",
            params![id, name, prompt, now],
        )
        .map_err(|e| e.to_string())?;
        let created_ms = conn
            .query_row(
                "SELECT created_ms FROM presets WHERE id = ?1",
                params![id],
                |r| r.get::<_, i64>(0),
            )
            .unwrap_or(now);
        Ok(Preset {
            id: id.to_string(),
            name: name.to_string(),
            prompt: prompt.to_string(),
            created_ms,
            updated_ms: now,
        })
    }

    pub fn delete_preset(&self, id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM presets WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    // ---- small key/value store for UI preferences ----

    pub fn get_kv(&self, key: &str) -> Result<Option<String>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let value = conn
            .query_row(
                "SELECT value FROM ui_kv WHERE key = ?1",
                params![key],
                |r| r.get::<_, String>(0),
            )
            .optional()
            .map_err(|e| e.to_string())?;
        Ok(value)
    }

    pub fn set_kv(&self, key: &str, value: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO ui_kv (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = ?2",
            params![key, value],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }
}
