-- DROP TABLE IF EXISTS comments;
-- DROP TABLE IF EXISTS posts;
-- DROP TABLE IF EXISTS announcements;
-- DROP TABLE IF EXISTS resources;
-- DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT UNIQUE NOT NULL, -- 9 digits
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT, -- hashed password (plain text for initial prototype if needed, but should be hashed)
  role TEXT DEFAULT 'student',
  permission_level INTEGER DEFAULT 0,
  tags TEXT, -- JSON string or comma-separated list
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- Nav red-dot switches, set on the profile page.
  notify_announcements INTEGER NOT NULL DEFAULT 1,
  notify_questions INTEGER NOT NULL DEFAULT 0
);

-- Resources are a folder tree (src/resourceFolders.ts, src/routes/resources.tsx):
--
--   subject folder            kind 'subject'  one per subject, parent_id NULL
--     Task 1 … HSC, Unfiled   kind 'section'  seven per subject
--       user folders          kind 'folder'   any depth
--         notes               resources.folder_id
--           attached files    resource_files
--   Removed                   kind 'trash'    parent_id NULL, admins only
--
-- 'subject', 'section' and 'trash' rows are root folders: never renamed, moved or removed. The
-- routes create any that are missing (a subject added to src/constants.ts), so they need no seed.
-- Removing a note or folder moves it into the Removed folder and remembers where it came from, so
-- "is this removed?" is always "is the top of its folder chain the trash folder?".
CREATE TABLE resource_folders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id INTEGER, -- NULL for subject folders and the Removed folder
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'folder', -- 'subject' | 'section' | 'folder' | 'trash'
  subject TEXT, -- subject key; set on 'subject' rows only
  access TEXT NOT NULL DEFAULT 'everyone', -- who may add to it: 'everyone' | 'owner'
  creator_id INTEGER, -- NULL for root folders
  position INTEGER NOT NULL DEFAULT 0, -- order of the seven sections
  removed_from_id INTEGER, -- the parent it was removed from, while it sits in Removed
  removed_by INTEGER,
  removed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES resource_folders(id),
  FOREIGN KEY (creator_id) REFERENCES users(id)
);

CREATE INDEX idx_resource_folders_parent ON resource_folders (parent_id);
CREATE INDEX idx_resource_folders_creator ON resource_folders (creator_id);
-- These make the "create any missing root folder" inserts (INSERT OR IGNORE) idempotent.
CREATE UNIQUE INDEX idx_resource_folders_subject ON resource_folders (subject) WHERE kind = 'subject';
CREATE UNIQUE INDEX idx_resource_folders_section ON resource_folders (parent_id, name) WHERE kind = 'section';
CREATE UNIQUE INDEX idx_resource_folders_trash ON resource_folders (kind) WHERE kind = 'trash';

-- A note in the resources tree.
CREATE TABLE resources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  file_key TEXT NOT NULL, -- legacy single file; '' on new rows. The files live in resource_files.
  subject TEXT NOT NULL, -- subject of the folder chain's root; kept in step when the note is moved
  type TEXT DEFAULT 'resource', -- 'resource' or 'past_paper'
  uploader_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_deleted BOOLEAN DEFAULT 0, -- legacy; removed notes now sit under the Removed folder
  download_count INTEGER DEFAULT 0,
  uploader_display TEXT DEFAULT 'initials', -- 'anonymous' | 'initials' | 'full'
  folder_id INTEGER REFERENCES resource_folders(id),
  removed_from_id INTEGER, -- the folder it was removed from, while it sits in Removed
  removed_by INTEGER,
  removed_at TIMESTAMP,
  FOREIGN KEY (uploader_id) REFERENCES users(id)
);

CREATE INDEX idx_resources_folder ON resources (folder_id);

-- Files attached to a note. Removing one only sets is_deleted; the R2 object stays.
CREATE TABLE resource_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  resource_id INTEGER NOT NULL,
  file_key TEXT NOT NULL, -- R2 object key
  file_name TEXT NOT NULL, -- name shown to users
  size INTEGER, -- bytes; NULL for files migrated from resources.file_key
  uploader_id INTEGER,
  is_deleted BOOLEAN DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (resource_id) REFERENCES resources(id),
  FOREIGN KEY (uploader_id) REFERENCES users(id)
);

CREATE INDEX idx_resource_files_resource ON resource_files (resource_id, is_deleted);

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

CREATE TABLE announcement_read_state (
  user_id INTEGER PRIMARY KEY,
  last_read_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL, -- 'qa' or 'essay'
  author_id INTEGER,
  subject TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_deleted BOOLEAN DEFAULT 0,
  FOREIGN KEY (author_id) REFERENCES users(id)
);

CREATE INDEX idx_posts_type_created ON posts (type, created_at);

CREATE TABLE comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER,
  content TEXT NOT NULL,
  author_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_deleted BOOLEAN DEFAULT 0,
  FOREIGN KEY (author_id) REFERENCES users(id)
);

-- Drives the red dot on Q&A (see forumRelevance.ts).
CREATE TABLE forum_read_state (
  user_id INTEGER PRIMARY KEY,
  last_read_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE papers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject TEXT NOT NULL,
    school_name TEXT NOT NULL,
    academic_year INTEGER NOT NULL,
    reference_link TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE exam_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paper_id INTEGER NOT NULL,
    section_label TEXT NOT NULL,
    segment_label TEXT,
    question_number TEXT NOT NULL,
    question_full_label TEXT,
    question_type TEXT,
    marks INTEGER,
    question_image_key TEXT,
    answer_image_key TEXT,
    stimulus_image_key TEXT,
    mc_answer TEXT,
    uploader_id INTEGER,
    is_deleted BOOLEAN DEFAULT 0,
    ordering_index REAL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (paper_id) REFERENCES papers(id),
    FOREIGN KEY (uploader_id) REFERENCES users(id)
);

CREATE TABLE question_topics (
    question_id INTEGER NOT NULL,
    topic_id INTEGER NOT NULL,
    PRIMARY KEY (question_id, topic_id),
    FOREIGN KEY (question_id) REFERENCES exam_questions(id),
    FOREIGN KEY (topic_id) REFERENCES topics(id)
);

CREATE TABLE user_question_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    question_id INTEGER NOT NULL,
    response_content TEXT,
    selected_option TEXT,
    marks_awarded INTEGER,
    marker_notes TEXT,
    is_completed BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (question_id) REFERENCES exam_questions(id),
    UNIQUE(user_id, question_id)
);

-- Handwritten answers. The SVG lives in R2 at drawings/q<question_id>/u<user_id>/<context>.svg;
-- context is 'practice', 'review' or 'mock-<mock_exam_id>'.
CREATE TABLE answer_drawings (
    user_id INTEGER NOT NULL,
    question_id INTEGER NOT NULL,
    context TEXT NOT NULL,
    byte_size INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, question_id, context),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (question_id) REFERENCES exam_questions(id) ON DELETE CASCADE
);

CREATE INDEX idx_answer_drawings_question ON answer_drawings(question_id);

CREATE TABLE class_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    class_name TEXT NOT NULL,
    date TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'adopted', 'developing', 'discarded'
    submitter_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (submitter_id) REFERENCES users(id)
);

CREATE TABLE atar_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    rank INTEGER NOT NULL,
    aggregate REAL NOT NULL,
    calculators_data TEXT NOT NULL,
    is_deleted BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE atar_submission_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    submission_id INTEGER,
    action TEXT NOT NULL,
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (submission_id) REFERENCES atar_submissions(id)
);

-- Hall of Fame submissions. Admin-only review queue; never read by the leaderboard page itself.
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

-- Timetable change alerts (Web Push), see src/timetablePush.ts. One row per device that turned alerts on.
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

-- Encrypted portal tokens, held only while the user has a push subscription (src/portalTokens.ts).
CREATE TABLE portal_tokens (
    user_id INTEGER PRIMARY KEY,
    client TEXT NOT NULL, -- 'full' | 'basic'
    refresh_token TEXT NOT NULL,
    access_token TEXT,
    access_expires_at INTEGER, -- unix seconds
    version INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'dead'
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Last alerted changes per user and date, so each change is pushed once.
CREATE TABLE timetable_snapshots (
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL, -- YYYY-MM-DD
    changes TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, date),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Scan-on reminders already sent, at most one per student per day.
CREATE TABLE scan_reminders (
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL, -- YYYY-MM-DD
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, date),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
