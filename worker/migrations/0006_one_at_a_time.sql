-- Rules the Worker checks, also held by the database, so requests sent at
-- the same moment can't both get through.

-- One submission waiting or accepted per claim.
CREATE UNIQUE INDEX submissions_open ON submissions(claim_id) WHERE status IN ('pending', 'accepted');

-- One meeting request waiting per claim.
CREATE UNIQUE INDEX meetings_open ON meetings(claim_id) WHERE status = 'requested';

-- One claim in play per person per problem: adding someone to a claim fails
-- when they are already on another pending or approved claim there.
CREATE TRIGGER one_active_claim BEFORE INSERT ON claim_members
BEGIN
  SELECT RAISE(ABORT, 'already-claimed')
  WHERE EXISTS (
    SELECT 1 FROM claim_members m
    JOIN claims c ON c.id = m.claim_id
    JOIN claims added ON added.id = NEW.claim_id
    WHERE m.user_id = NEW.user_id
      AND c.problem_id = added.problem_id
      AND c.id <> NEW.claim_id
      AND c.status IN ('pending', 'approved')
  );
END;
