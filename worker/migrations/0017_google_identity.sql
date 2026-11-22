-- Subjects are scoped to the Google issuer verified by the OAuth callback.
ALTER TABLE users ADD COLUMN google_subject TEXT;
CREATE UNIQUE INDEX users_google_subject ON users(google_subject) WHERE google_subject IS NOT NULL;

CREATE TABLE google_link_challenges (
  browser_hash TEXT PRIMARY KEY,
  proof_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  context TEXT NOT NULL
);
