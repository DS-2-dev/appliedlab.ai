-- More detail a partner can give a posting, all optional (postings.ts):
-- the business side, what it achieves, and a Drive folder to share.
ALTER TABLE postings ADD COLUMN business_model TEXT NOT NULL DEFAULT '';
ALTER TABLE postings ADD COLUMN why TEXT NOT NULL DEFAULT '';
ALTER TABLE postings ADD COLUMN dependencies TEXT NOT NULL DEFAULT '';
ALTER TABLE postings ADD COLUMN achieves TEXT NOT NULL DEFAULT '';
ALTER TABLE postings ADD COLUMN goal TEXT NOT NULL DEFAULT '';
ALTER TABLE postings ADD COLUMN key_milestones TEXT NOT NULL DEFAULT '';
ALTER TABLE postings ADD COLUMN drive_url TEXT NOT NULL DEFAULT '';
