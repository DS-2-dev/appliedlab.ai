-- Gates and orgs. The pipeline tables are rebuilt under new names:
--   problems -> postings      (what a partner or the Lab posts)
--   claims   -> projects      (a team's pipeline row, with Gantry's statuses)
--   projects -> boards        (the JSON workspace a team works in)
-- plus orgs, org_requests, taxonomy, reviews (one row per gate round),
-- milestone_baselines and events. Every existing row is carried forward
-- with its status mapped (spec 6.4).
--
-- D1 keeps foreign keys on, so the old projects table is renamed out of the
-- way first, checks are deferred to the end of this file's transaction, and
-- the old tables are dropped children first.
ALTER TABLE projects RENAME TO boards_old;
PRAGMA defer_foreign_keys = true;

-- Schema --------------------------------------------------------------------

CREATE TABLE orgs (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'company' CHECK (kind IN ('company', 'nonprofit', 'public', 'lab')),
  domain TEXT NOT NULL DEFAULT '',
  industry TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  is_public INTEGER NOT NULL DEFAULT 1,
  showcase_consent_default INTEGER NOT NULL DEFAULT 0,
  primary_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  join_domain INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX orgs_domain ON orgs(domain);

ALTER TABLE users ADD COLUMN roles TEXT NOT NULL DEFAULT '[]';
ALTER TABLE users ADD COLUMN org_id TEXT REFERENCES orgs(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN level TEXT NOT NULL DEFAULT 'affiliate' CHECK (level IN ('affiliate', 'sponsored', 'builder'));
ALTER TABLE users ADD COLUMN level_locked INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN interests TEXT NOT NULL DEFAULT '[]';

CREATE TABLE org_requests (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined', 'cancelled')),
  message TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  decided_at TEXT,
  decided_by TEXT,
  note TEXT NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX org_requests_pending ON org_requests(user_id) WHERE status = 'pending';

CREATE TABLE taxonomy (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('discipline', 'tag')),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  position REAL NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (kind, slug)
);

CREATE TABLE postings (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES orgs(id) ON DELETE SET NULL,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  disciplines TEXT NOT NULL DEFAULT '[]',
  tags TEXT NOT NULL DEFAULT '[]',
  effort TEXT NOT NULL DEFAULT '' CHECK (effort IN ('', 'small', 'medium', 'large', 'multi')),
  deliverable TEXT NOT NULL DEFAULT '',
  deadline TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('draft', 'in_review', 'returned', 'live', 'paused', 'closed', 'archived')),
  kind TEXT NOT NULL DEFAULT 'partner' CHECK (kind IN ('partner', 'self')),
  sealed INTEGER NOT NULL DEFAULT 0,
  show_on_profile INTEGER NOT NULL DEFAULT 1,
  submitted_at TEXT,
  published_at TEXT,
  closed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX postings_org ON postings(org_id);
CREATE INDEX postings_status ON postings(status);
CREATE INDEX postings_author ON postings(author_id);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  posting_id TEXT NOT NULL REFERENCES postings(id) ON DELETE CASCADE,
  lead_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('claimed', 'plan_review', 'plan_returned', 'active', 'submission_review', 'submission_returned', 'delivered', 'integrated', 'completion_review', 'complete', 'withdrawn')),
  phase TEXT NOT NULL DEFAULT 'parallel' CHECK (phase IN ('parallel', 'integrated')),
  plan TEXT NOT NULL DEFAULT '{"approach":"","milestones":[],"finishBy":""}',
  ai_disclosure TEXT NOT NULL DEFAULT '',
  planned_terms INTEGER NOT NULL DEFAULT 1,
  claimed_at TEXT NOT NULL,
  plan_submitted_at TEXT,
  activated_at TEXT,
  submitted_at TEXT,
  delivered_at TEXT,
  integrated_at TEXT,
  completed_at TEXT,
  withdrawn_at TEXT,
  updated_at TEXT NOT NULL
);
CREATE INDEX projects_posting ON projects(posting_id);
CREATE INDEX projects_status ON projects(status);

CREATE TABLE project_members (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('lead', 'member')),
  joined_at TEXT NOT NULL,
  PRIMARY KEY (project_id, user_id)
);
CREATE INDEX project_members_user ON project_members(user_id);
-- Its one_active_project trigger is created after the teams are copied in
-- (step 7), a second guard behind migration_superseded (step 6): the old
-- trigger ignored denied claims, the new one counts plan_returned as in play.

CREATE TABLE reviews (
  id TEXT PRIMARY KEY,
  gate TEXT NOT NULL CHECK (gate IN ('posting', 'action_plan', 'submission', 'completion')),
  subject_id TEXT NOT NULL,
  round INTEGER NOT NULL,
  snapshot TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'approved', 'returned', 'withdrawn')),
  assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL,
  decided_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  decided_at TEXT,
  feedback TEXT NOT NULL DEFAULT '',
  score INTEGER,
  opened_at TEXT NOT NULL
);
CREATE INDEX reviews_subject ON reviews(gate, subject_id);
CREATE INDEX reviews_open ON reviews(status) WHERE status = 'open';

CREATE TABLE milestone_baselines (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('plan_submitted', 'plan_approved', 'integrated', 'manual')),
  snapshot TEXT NOT NULL,
  taken_at TEXT NOT NULL
);

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  actor_id TEXT,
  via_user_id TEXT,
  subject_kind TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  posting_id TEXT,
  project_id TEXT,
  org_id TEXT,
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX events_subject ON events(subject_kind, subject_id, created_at);
CREATE INDEX events_project ON events(project_id, created_at);

ALTER TABLE notifications ADD COLUMN court INTEGER NOT NULL DEFAULT 0;
ALTER TABLE notifications ADD COLUMN event_id TEXT;

-- A board belongs to at most one project. project_id is NULL for a board a
-- member made on their own before proposing a project (spec 6.1).
CREATE TABLE boards (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX boards_project ON boards(project_id);
CREATE INDEX boards_owner ON boards(owner_id);

CREATE TABLE submissions_v2 (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  submitted_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  report_name TEXT NOT NULL,
  report_size INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'returned')),
  review_note TEXT NOT NULL DEFAULT '',
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE meetings_v2 (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  requested_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  message TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'scheduled', 'held', 'cancelled')),
  created_at TEXT NOT NULL,
  arranged_at TEXT
);

CREATE TABLE selections_v2 (
  project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  selected_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  message TEXT NOT NULL DEFAULT '',
  milestones TEXT NOT NULL DEFAULT '[]',
  completed_at TEXT,
  created_at TEXT NOT NULL
);

-- Data ----------------------------------------------------------------------

-- 1. Roles become a list.
UPDATE users SET roles = '["' || role || '"]';

-- 2. The Lab's own org, for problems reps posted.
INSERT INTO orgs (id, slug, name, kind, domain, created_at)
VALUES ('org_lab', 'applied-ai-lab', 'Applied AI Lab', 'lab', 'weber.edu', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

-- 3. One org per partner email domain; a partner on a personal address gets
-- an org of their own. The primary is the earliest active partner there.
INSERT INTO orgs (id, slug, name, kind, domain, primary_user_id, created_at)
SELECT
  'org_' || lower(hex(randomblob(8))),
  replace(d.domain, '.', '-'),
  upper(substr(d.domain, 1, 1)) ||
    substr(d.domain, 2, CASE WHEN instr(d.domain, '.') > 0 THEN instr(d.domain, '.') - 2 ELSE length(d.domain) END),
  'company',
  d.domain,
  (SELECT p.id FROM users p
    WHERE p.role = 'partner' AND p.status = 'active' AND lower(substr(p.email, instr(p.email, '@') + 1)) = d.domain
    ORDER BY p.created_at, p.id LIMIT 1),
  d.created_at
FROM (
  SELECT lower(substr(email, instr(email, '@') + 1)) AS domain, MIN(created_at) AS created_at
  FROM users WHERE role = 'partner' GROUP BY 1
) d
WHERE d.domain NOT IN ('gmail.com', 'googlemail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com', 'gmx.com', 'mail.com', 'zoho.com', 'yandex.com');

INSERT INTO orgs (id, slug, name, kind, domain, primary_user_id, created_at)
SELECT
  'org_' || lower(hex(randomblob(8))),
  coalesce(nullif(substr(trim(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(
    lower(trim(u.name)), '''', ''), '"', ''), '.', ''), ',', ''), '!', ''), '?', ''), '(', ''), ')', ''), '&', ''), '@', ''), '/', ''),
    '_', ' '), ' ', '-'), '-'), 1, 40), ''), 'partner') || '-' || lower(hex(randomblob(2))),
  u.name,
  'company',
  '',
  u.id,
  u.created_at
FROM users u
WHERE u.role = 'partner'
  AND lower(substr(u.email, instr(u.email, '@') + 1)) IN ('gmail.com', 'googlemail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com', 'gmx.com', 'mail.com', 'zoho.com', 'yandex.com');

UPDATE users SET org_id = coalesce(
  (SELECT o.id FROM orgs o WHERE o.kind <> 'lab' AND o.domain <> '' AND o.domain = lower(substr(users.email, instr(users.email, '@') + 1))),
  (SELECT o.id FROM orgs o WHERE o.domain = '' AND o.primary_user_id = users.id)
)
WHERE role = 'partner';

-- 4. Disciplines.
INSERT INTO taxonomy (id, kind, name, slug, position, created_at) VALUES
  ('d_finance', 'discipline', 'Finance', 'finance', 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('d_accounting', 'discipline', 'Accounting', 'accounting', 2, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('d_business', 'discipline', 'Business', 'business', 3, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('d_computer-science', 'discipline', 'Computer Science', 'computer-science', 4, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('d_design', 'discipline', 'Design', 'design', 5, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('d_mathematics', 'discipline', 'Mathematics', 'mathematics', 6, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('d_marketing', 'discipline', 'Marketing', 'marketing', 7, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('d_other', 'discipline', 'Other', 'other', 8, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

-- 5. problems -> postings. A member's own proposal becomes a closed,
-- self-posted posting kept off their profile, with no org.
INSERT INTO postings (id, org_id, author_id, title, summary, details, disciplines, deliverable, deadline,
  status, kind, show_on_profile, published_at, closed_at, created_at, updated_at)
SELECT
  pr.id,
  CASE WHEN pr.origin = 'member' THEN NULL WHEN u.role = 'rep' THEN 'org_lab' ELSE u.org_id END,
  pr.owner_id,
  pr.title,
  pr.summary,
  pr.details,
  pr.fields,
  pr.deliverable,
  pr.deadline,
  CASE WHEN pr.origin = 'member' THEN 'closed' WHEN pr.status = 'open' THEN 'live' ELSE 'closed' END,
  CASE WHEN pr.origin = 'member' THEN 'self' ELSE 'partner' END,
  CASE WHEN pr.origin = 'member' THEN 0 ELSE 1 END,
  CASE WHEN pr.origin = 'partner' THEN pr.created_at END,
  CASE WHEN pr.origin = 'member' THEN pr.created_at WHEN pr.status = 'closed' THEN pr.updated_at END,
  pr.created_at,
  pr.updated_at
FROM problems pr JOIN users u ON u.id = pr.owner_id;

-- A denied claim whose team also holds a pending or approved claim on the
-- same problem, or a later denied one, was superseded: it becomes withdrawn
-- rather than plan_returned, so no one has two projects in play on one
-- posting. Dropped in step 13.
CREATE TABLE migration_superseded (claim_id TEXT PRIMARY KEY);
INSERT INTO migration_superseded (claim_id)
SELECT c.id FROM claims c
WHERE c.status = 'denied' AND EXISTS (
  SELECT 1 FROM claims c2
  WHERE c2.problem_id = c.problem_id AND c2.id <> c.id
    AND (c2.status IN ('pending', 'approved')
      OR (c2.status = 'denied' AND (c2.created_at > c.created_at OR (c2.created_at = c.created_at AND c2.id > c.id))))
    AND EXISTS (
      SELECT 1 FROM (SELECT user_id FROM claim_members WHERE claim_id = c.id UNION SELECT c.owner_id) a
      JOIN (SELECT user_id FROM claim_members WHERE claim_id = c2.id UNION SELECT c2.owner_id) b ON b.user_id = a.user_id
    )
);

-- 6. claims -> projects, statuses per spec 6.4. An approved claim's status
-- comes from its selection, else its latest submission.
INSERT INTO projects (id, posting_id, lead_id, status, phase, plan, claimed_at, plan_submitted_at, activated_at,
  submitted_at, delivered_at, integrated_at, completed_at, withdrawn_at, updated_at)
SELECT
  c.id,
  c.problem_id,
  c.owner_id,
  CASE c.status
    WHEN 'pending' THEN 'plan_review'
    WHEN 'denied' THEN CASE WHEN c.id IN (SELECT claim_id FROM migration_superseded) THEN 'withdrawn' ELSE 'plan_returned' END
    WHEN 'withdrawn' THEN 'withdrawn'
    ELSE CASE
      WHEN s.claim_id IS NOT NULL AND s.completed_at IS NOT NULL THEN 'complete'
      WHEN s.claim_id IS NOT NULL THEN 'integrated'
      ELSE CASE (SELECT sb.status FROM submissions sb WHERE sb.claim_id = c.id ORDER BY sb.created_at DESC, sb.rowid DESC LIMIT 1)
        WHEN 'pending' THEN 'submission_review'
        WHEN 'returned' THEN 'submission_returned'
        WHEN 'accepted' THEN 'delivered'
        ELSE 'active'
      END
    END
  END,
  CASE WHEN s.claim_id IS NOT NULL THEN 'integrated' ELSE 'parallel' END,
  c.plan,
  c.created_at,
  c.created_at,
  CASE WHEN c.status = 'approved' THEN c.reviewed_at END,
  (SELECT MAX(sb.created_at) FROM submissions sb WHERE sb.claim_id = c.id),
  (SELECT MAX(sb.reviewed_at) FROM submissions sb WHERE sb.claim_id = c.id AND sb.status = 'accepted'),
  s.created_at,
  s.completed_at,
  CASE WHEN c.status = 'withdrawn' OR c.id IN (SELECT claim_id FROM migration_superseded) THEN c.reviewed_at END,
  c.created_at
FROM claims c LEFT JOIN selections s ON s.claim_id = c.id;

-- 7. claim_members -> project_members: the lead first, then everyone else.
INSERT INTO project_members (project_id, user_id, role, joined_at)
SELECT p.id, p.lead_id, 'lead', p.claimed_at FROM projects p;

INSERT INTO project_members (project_id, user_id, role, joined_at)
SELECT m.claim_id, m.user_id, 'member', p.claimed_at
FROM claim_members m JOIN projects p ON p.id = m.claim_id
WHERE m.user_id <> p.lead_id;

CREATE TRIGGER one_active_project BEFORE INSERT ON project_members
BEGIN
  SELECT RAISE(ABORT, 'already-claimed')
  WHERE EXISTS (
    SELECT 1 FROM project_members m
    JOIN projects p ON p.id = m.project_id
    JOIN projects added ON added.id = NEW.project_id
    WHERE m.user_id = NEW.user_id
      AND p.posting_id = added.posting_id
      AND p.id <> NEW.project_id
      AND p.status NOT IN ('withdrawn', 'complete')
  );
END;

-- 8. One action-plan review per project, round 1.
INSERT INTO reviews (id, gate, subject_id, round, snapshot, status, decided_by, decided_at, feedback, opened_at)
SELECT
  'rev_' || lower(hex(randomblob(12))),
  'action_plan',
  c.id,
  1,
  c.plan,
  CASE
    WHEN c.status = 'pending' THEN 'open'
    WHEN c.status = 'approved' THEN 'approved'
    WHEN c.status = 'denied' AND c.id NOT IN (SELECT claim_id FROM migration_superseded) THEN 'returned'
    ELSE 'withdrawn'
  END,
  c.reviewed_by,
  c.reviewed_at,
  c.review_note,
  c.created_at
FROM claims c;

-- 9. Milestone baselines: as submitted, and as approved.
INSERT INTO milestone_baselines (id, project_id, reason, snapshot, taken_at)
SELECT
  'mb_' || lower(hex(randomblob(12))),
  c.id,
  'plan_submitted',
  CASE WHEN json_valid(c.plan) THEN coalesce(json_extract(c.plan, '$.milestones'), '[]') ELSE '[]' END,
  c.created_at
FROM claims c;

INSERT INTO milestone_baselines (id, project_id, reason, snapshot, taken_at)
SELECT
  'mb_' || lower(hex(randomblob(12))),
  c.id,
  'plan_approved',
  CASE WHEN json_valid(c.plan) THEN coalesce(json_extract(c.plan, '$.milestones'), '[]') ELSE '[]' END,
  coalesce(c.reviewed_at, c.created_at)
FROM claims c WHERE c.status = 'approved';

-- 10. Levels: Builder once on an integrated project, Sponsored once on an
-- active one. Withdrawn projects count for neither, as before (builder's
-- status <> 'withdrawn' narrowing matches the old levelOf, by ruling).
UPDATE users SET level = CASE
  WHEN EXISTS (
    SELECT 1 FROM project_members m JOIN projects p ON p.id = m.project_id
    WHERE m.user_id = users.id AND p.phase = 'integrated' AND p.status <> 'withdrawn'
  ) THEN 'builder'
  WHEN EXISTS (
    SELECT 1 FROM project_members m JOIN projects p ON p.id = m.project_id
    WHERE m.user_id = users.id
      AND p.status IN ('active', 'submission_review', 'submission_returned', 'delivered', 'integrated', 'completion_review', 'complete')
  ) THEN 'sponsored'
  ELSE 'affiliate'
END;

-- 11. Boards, every one, including those made before any project (NULL
-- claim_id). Projects with no board yet (plans still in review) get one
-- from the Worker's ensureBoards(), which builds the board JSON.
INSERT INTO boards (id, project_id, owner_id, data, created_at, updated_at)
SELECT b.id, b.claim_id, b.owner_id, b.data, b.created_at, b.updated_at
FROM boards_old b;

-- 12. Submissions, meetings and selections, pointed at the new rows.
INSERT INTO submissions_v2 (id, project_id, board_id, submitted_by, report_name, report_size, status, review_note,
  reviewed_by, reviewed_at, created_at)
SELECT id, claim_id, project_id, submitted_by, report_name, report_size, status, review_note, reviewed_by, reviewed_at, created_at
FROM submissions;

INSERT INTO meetings_v2 (id, project_id, requested_by, message, status, created_at, arranged_at)
SELECT id, claim_id, requested_by, message, CASE status WHEN 'arranged' THEN 'scheduled' ELSE status END, created_at, arranged_at
FROM meetings;

INSERT INTO selections_v2 (project_id, selected_by, message, milestones, completed_at, created_at)
SELECT claim_id, selected_by, message, milestones, completed_at, created_at
FROM selections;

-- 13. Drop the old tables, children before parents, and move the rebuilt
-- ones into their names.
DROP TRIGGER one_active_claim;
DROP TABLE claim_members;
DROP TABLE selections;
DROP TABLE meetings;
DROP TABLE submissions;
DROP TABLE boards_old;
DROP TABLE claims;
DROP TABLE problems;
DROP TABLE migration_superseded;

ALTER TABLE submissions_v2 RENAME TO submissions;
ALTER TABLE meetings_v2 RENAME TO meetings;
ALTER TABLE selections_v2 RENAME TO selections;

CREATE INDEX submissions_project ON submissions(project_id);
CREATE INDEX submissions_status ON submissions(status);
-- One submission waiting or accepted per project.
CREATE UNIQUE INDEX submissions_open ON submissions(project_id) WHERE status IN ('pending', 'accepted');
CREATE INDEX meetings_project ON meetings(project_id);
CREATE INDEX meetings_status ON meetings(status);
-- One meeting request waiting per project.
CREATE UNIQUE INDEX meetings_open ON meetings(project_id) WHERE status = 'requested';
