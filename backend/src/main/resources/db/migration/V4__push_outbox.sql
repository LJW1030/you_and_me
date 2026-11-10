-- Additive migration: existing chat and account data is unchanged.
CREATE TABLE push_outbox (
 id BIGSERIAL PRIMARY KEY,
 room BIGINT NOT NULL,
 seq BIGINT NOT NULL,
 token_hash VARCHAR(64) NOT NULL REFERENCES push_devices(token_hash) ON DELETE CASCADE,
 recipient BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 session_id VARCHAR(36) NOT NULL,
 attempts INT NOT NULL DEFAULT 0,
 available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 FOREIGN KEY(room,seq) REFERENCES messages(room,seq) ON DELETE CASCADE,
 UNIQUE(room,seq,token_hash)
);
CREATE INDEX push_outbox_due ON push_outbox(available_at,id);
