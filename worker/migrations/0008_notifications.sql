-- What happened that concerns each person, for the bell in Projectum: a
-- line of text, where it leads, and when it was read. Written alongside the
-- emails (src/notify.ts); read ones older than 60 days are cleared daily.
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  href TEXT NOT NULL DEFAULT '',
  read_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX notifications_user ON notifications(user_id, created_at);
