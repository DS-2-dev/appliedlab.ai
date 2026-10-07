-- A team's submission: its board moves to its last stage with links and
-- credits, and its final report (a PDF in the REPORTS KV namespace, keyed by
-- the submission's id). The approver accepts it, which shows it to the
-- partner, or returns it with a note, which sends the board back to
-- Prototype.
CREATE TABLE submissions (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  submitted_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  report_name TEXT NOT NULL,
  report_size INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'returned')),
  review_note TEXT NOT NULL DEFAULT '',
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX submissions_claim ON submissions(claim_id);
CREATE INDEX submissions_status ON submissions(status);
