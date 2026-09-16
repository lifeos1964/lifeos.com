CREATE TABLE IF NOT EXISTS lifeos_state (
    user_id TEXT PRIMARY KEY,
    state_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS lifeos_state_updated_at_idx
    ON lifeos_state (updated_at);