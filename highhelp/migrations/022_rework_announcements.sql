-- Announcements are reworked around a propose/review flow: anyone can propose, admins
-- (permission_level >= 5) accept or reject, and the announcement is only visible to users
-- whose tags match the target audience. The old table is discarded -- it was barely used.

DROP TABLE IF EXISTS announcements;

CREATE TABLE announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  -- JSON array of audience keys: 'all', 'tag:<Visibility Tag>' or 'year:<Year tag>'
  target_tags TEXT NOT NULL DEFAULT '["all"]',
  -- "Additional needs" note, visible only to the author and to reviewers
  private_note TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | published | rejected
  review_feedback TEXT,
  reviewed_by INTEGER,
  reviewed_at TIMESTAMP,
  published_at TIMESTAMP,
  author_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_deleted BOOLEAN DEFAULT 0,
  FOREIGN KEY (author_id) REFERENCES users(id)
);

CREATE INDEX idx_announcements_status_published ON announcements (status, published_at);
CREATE INDEX idx_announcements_author ON announcements (author_id, status);

-- One row per user per announcement; the UNIQUE pair is what makes the 👍 a toggle.
CREATE TABLE announcement_reactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  announcement_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (announcement_id, user_id),
  FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_announcement_reactions_announcement ON announcement_reactions (announcement_id);

-- Drives the red dot on the Announcements tab.
CREATE TABLE announcement_read_state (
  user_id INTEGER PRIMARY KEY,
  last_read_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
