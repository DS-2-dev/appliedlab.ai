-- Levels and profiles. A member's level (Affiliate, Sponsored, Builder) is
-- worked out from their claims, so it isn't stored. Stored here: whether
-- their profile page is public and its address, whether the Lab has given
-- them a funded Claude account, and, for partners, whether their name stays
-- off student profiles.
ALTER TABLE users ADD COLUMN profile_public INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN handle TEXT;
CREATE UNIQUE INDEX users_handle ON users(handle);
ALTER TABLE users ADD COLUMN claude_access INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN hide_name INTEGER NOT NULL DEFAULT 0;
