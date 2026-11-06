CREATE TABLE users (id BIGSERIAL PRIMARY KEY, login VARCHAR(40) UNIQUE NOT NULL, password TEXT NOT NULL, nickname VARCHAR(40) NOT NULL);
CREATE TABLE friends (owner BIGINT REFERENCES users, friend BIGINT REFERENCES users, PRIMARY KEY(owner,friend), CHECK(owner<>friend));
CREATE TABLE rooms (id BIGSERIAL PRIMARY KEY, direct_key TEXT UNIQUE, title VARCHAR(100) NOT NULL, seq BIGINT NOT NULL DEFAULT 0);
CREATE TABLE members (room BIGINT REFERENCES rooms, usr BIGINT REFERENCES users, last_read BIGINT NOT NULL DEFAULT 0, PRIMARY KEY(room,usr));
CREATE INDEX members_user ON members(usr);
CREATE TABLE messages (room BIGINT REFERENCES rooms, seq BIGINT NOT NULL, sender BIGINT REFERENCES users, client_id UUID NOT NULL, body VARCHAR(2000) NOT NULL CHECK(length(trim(body))>0), sent_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(room,seq), UNIQUE(room,sender,client_id));
