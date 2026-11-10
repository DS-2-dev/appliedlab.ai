-- Why a claim was released, and the status it left, so an admin can reopen
-- it where it was (projects.ts). Both are cleared on reopen.
ALTER TABLE projects ADD COLUMN withdrawn_from TEXT;
ALTER TABLE projects ADD COLUMN withdrawn_reason TEXT;
