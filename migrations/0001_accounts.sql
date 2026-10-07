-- Projectum accounts. The role comes from the email domain
-- (src/lib/email-rules.ts); partners start pending until the Lab approves
-- them.
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('rep', 'member', 'partner')),
  status TEXT NOT NULL CHECK (status IN ('active', 'pending', 'removed')),
  avatar TEXT,
  created_at TEXT NOT NULL
);

-- One live sign-in code per address, stored hashed.
CREATE TABLE login_codes (
  email TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0
);

-- Sessions, by the hash of the token the browser holds.
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

-- Projects, one row each, the project itself as JSON (src/lib/projects.ts).
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX projects_owner ON projects(owner_id);
