-- After a submission is accepted, the partner can ask to meet the team (the
-- approver introduces them and marks it arranged) and select the team for
-- an internship, which starts phase 2: implementation milestones the team
-- ticks off until the partner or the approver marks the project complete.
CREATE TABLE meetings (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  requested_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  message TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'arranged')),
  created_at TEXT NOT NULL,
  arranged_at TEXT
);
CREATE INDEX meetings_claim ON meetings(claim_id);
CREATE INDEX meetings_status ON meetings(status);

CREATE TABLE selections (
  claim_id TEXT PRIMARY KEY REFERENCES claims(id) ON DELETE CASCADE,
  selected_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  message TEXT NOT NULL DEFAULT '',
  milestones TEXT NOT NULL DEFAULT '[]',
  completed_at TEXT,
  created_at TEXT NOT NULL
);
