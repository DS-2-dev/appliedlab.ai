-- Which notifications each person wants, per kind (an event type, see
-- src/lib/notification-kinds.ts): in the bell, by email, or neither. No row
-- means the role's defaults. emit() (events.ts) reads it as it writes, and
-- marks the ones to email; sendPendingEmails (notify.ts) sends and clears them.
CREATE TABLE notification_prefs (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  in_app INTEGER NOT NULL,
  email INTEGER NOT NULL,
  PRIMARY KEY (user_id, kind)
);
ALTER TABLE notifications ADD COLUMN email_pending INTEGER NOT NULL DEFAULT 0;
