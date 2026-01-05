-- Migration: Add action_logs and is_deleted columns
CREATE TABLE action_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action_type TEXT NOT NULL,
  details TEXT,
  target_id INTEGER,
  target_table TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

ALTER TABLE resources ADD COLUMN is_deleted BOOLEAN DEFAULT 0;
ALTER TABLE announcements ADD COLUMN is_deleted BOOLEAN DEFAULT 0;
ALTER TABLE posts ADD COLUMN is_deleted BOOLEAN DEFAULT 0;
ALTER TABLE comments ADD COLUMN is_deleted BOOLEAN DEFAULT 0;
ALTER TABLE questions ADD COLUMN is_deleted BOOLEAN DEFAULT 0;
