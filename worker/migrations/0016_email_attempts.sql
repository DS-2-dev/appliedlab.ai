-- How many times a notification's email has been tried. A send that keeps
-- failing stops after three, so it cannot hold the queue.
ALTER TABLE notifications ADD COLUMN email_attempts INTEGER NOT NULL DEFAULT 0;
