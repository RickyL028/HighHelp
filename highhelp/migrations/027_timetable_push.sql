-- Timetable change alerts (Web Push). See src/timetablePush.ts.

-- One row per browser/device that turned alerts on. endpoint is the push service URL the browser
-- handed us; p256dh/auth are its payload-encryption keys (RFC 8291), all base64url.
CREATE TABLE push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_push_subscriptions_user ON push_subscriptions (user_id);

-- Server-held SBHS portal tokens, kept only while the user has at least one push subscription so the
-- cron can read their day timetable. Both tokens are AES-GCM ciphertext (src/portalTokens.ts), never
-- plaintext. version is bumped on every write so a refresh that loses a rotation race can tell.
CREATE TABLE portal_tokens (
    user_id INTEGER PRIMARY KEY,
    client TEXT NOT NULL, -- 'full' | 'basic': which portal OAuth client issued the token
    refresh_token TEXT NOT NULL,
    access_token TEXT,
    access_expires_at INTEGER, -- unix seconds
    version INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'dead' (portal refused the refresh token)
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- The last set of changes alerted for each user and date (JSON array from extractChanges), so each
-- change is pushed once. Rows older than a week are swept by the cron.
CREATE TABLE timetable_snapshots (
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL, -- YYYY-MM-DD
    changes TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, date),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
