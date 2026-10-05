-- Per-user switches for the nav red dots (Profile Settings > Notifications).
-- Announcements are on by default; Q&A is opt-in.
ALTER TABLE users ADD COLUMN notify_announcements INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN notify_questions INTEGER NOT NULL DEFAULT 0;
