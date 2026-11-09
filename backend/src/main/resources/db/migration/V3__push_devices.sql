CREATE TABLE push_devices (
 token_hash VARCHAR(64) PRIMARY KEY,
 token TEXT NOT NULL,
 usr BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 session_id VARCHAR(36) NOT NULL,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX push_devices_user ON push_devices(usr);
CREATE INDEX push_devices_session ON push_devices(session_id);
