-- An optional daily email of a person's unread notifications. digest_sent_at
-- is when the last one went out.
ALTER TABLE users ADD COLUMN digest INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN digest_sent_at TEXT;
