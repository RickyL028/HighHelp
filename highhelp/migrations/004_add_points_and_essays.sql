-- Migration: Add Points and Essays
ALTER TABLE users ADD COLUMN points REAL DEFAULT 0;

CREATE TABLE IF NOT EXISTS essays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  subject TEXT NOT NULL,
  author_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (author_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS essay_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  essay_id INTEGER,
  content TEXT NOT NULL,
  author_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (essay_id) REFERENCES essays(id),
  FOREIGN KEY (author_id) REFERENCES users(id)
);
