-- The pipeline: partners post problems, members claim them with an action
-- plan, and the approver approves or denies each claim
-- (src/lib/problems.ts holds the rules).
CREATE TABLE problems (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  fields TEXT NOT NULL DEFAULT '[]',
  deliverable TEXT NOT NULL DEFAULT '',
  deadline TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX problems_owner ON problems(owner_id);
CREATE INDEX problems_status ON problems(status);

CREATE TABLE claims (
  id TEXT PRIMARY KEY,
  problem_id TEXT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'withdrawn')),
  review_note TEXT NOT NULL DEFAULT '',
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX claims_problem ON claims(problem_id);
CREATE INDEX claims_status ON claims(status);

-- Everyone on a claim's team, its owner included.
CREATE TABLE claim_members (
  claim_id TEXT NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (claim_id, user_id)
);
CREATE INDEX claim_members_user ON claim_members(user_id);
