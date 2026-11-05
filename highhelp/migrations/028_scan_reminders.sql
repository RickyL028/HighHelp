-- Scan-on reminders already sent (src/timetablePush.ts), so each student gets at most one per day.
-- Rows older than a week are swept by the cron.
CREATE TABLE scan_reminders (
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL, -- YYYY-MM-DD
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, date),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
