-- Boards come from approved plans: a project row belongs to the claim that
-- made it. Problems are either posted by a partner or proposed by a member
-- as their own project; proposals stay off the Notice Board.
ALTER TABLE projects ADD COLUMN claim_id TEXT REFERENCES claims(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX projects_claim ON projects(claim_id);
ALTER TABLE problems ADD COLUMN origin TEXT NOT NULL DEFAULT 'partner' CHECK (origin IN ('partner', 'member'));
