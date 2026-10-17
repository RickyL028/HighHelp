-- Results students submit for the Hall of Fame (/leaderboard). Submitting never changes the page:
-- the leaderboard itself is hardcoded in src/routes/leaderboard.tsx, and admins review these rows at
-- /leaderboard/submissions before editing that data by hand.
CREATE TABLE leaderboard_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    submitter_id INTEGER NOT NULL,
    subject TEXT NOT NULL,
    nominee_name TEXT NOT NULL,
    rank INTEGER NOT NULL,
    percentage REAL, -- optional
    is_deleted BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (submitter_id) REFERENCES users(id)
);

CREATE INDEX idx_leaderboard_submissions_subject ON leaderboard_submissions (is_deleted, subject, rank);
