-- Drives the red dot on Q&A: a question is unread for a user when it was posted after their
-- last_read_at, by someone else, in a subject their tags say they take.
CREATE TABLE IF NOT EXISTS forum_read_state (
  user_id INTEGER PRIMARY KEY,
  last_read_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Start everyone from "now" so existing questions don't light the dot for the whole school.
INSERT OR IGNORE INTO forum_read_state (user_id, last_read_at)
SELECT id, CURRENT_TIMESTAMP FROM users;

CREATE INDEX IF NOT EXISTS idx_posts_type_created ON posts (type, created_at);
