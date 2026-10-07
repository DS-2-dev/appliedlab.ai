-- Reminders already sent, by a key that names what each was about
-- (src/reminders.ts), so the daily run never sends the same one twice.
CREATE TABLE reminders_sent (
  key TEXT PRIMARY KEY,
  sent_at TEXT NOT NULL
);
