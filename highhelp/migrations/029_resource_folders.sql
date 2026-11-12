-- Resources become a folder tree (src/resourceFolders.ts, src/routes/resources.tsx).
--
--   subject folder            kind 'subject'  one per subject, parent_id NULL
--     Task 1 … HSC, Unfiled   kind 'section'  seven per subject
--       user folders          kind 'folder'   any depth
--         notes               resources.folder_id
--           attached files    resource_files
--   Removed                   kind 'trash'    parent_id NULL, admins only
--
-- 'subject', 'section' and 'trash' rows are root folders: never renamed, moved or removed.
-- Removing a note or folder moves it into the Removed folder and remembers where it came from,
-- so "is this removed?" is always "is the top of its folder chain the trash folder?".
-- Existing rows carry no task / trial / HSC information, so every existing resource lands in its
-- subject's Unfiled folder (soft-deleted ones in Removed) with its single file as the first attachment.

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
-- These make the runtime "create any missing root folder" inserts (INSERT OR IGNORE) idempotent.
CREATE UNIQUE INDEX idx_resource_folders_subject ON resource_folders (subject) WHERE kind = 'subject';
CREATE UNIQUE INDEX idx_resource_folders_section ON resource_folders (parent_id, name) WHERE kind = 'section';
CREATE UNIQUE INDEX idx_resource_folders_trash ON resource_folders (kind) WHERE kind = 'trash';

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

ALTER TABLE resources ADD COLUMN folder_id INTEGER REFERENCES resource_folders(id);
ALTER TABLE resources ADD COLUMN removed_from_id INTEGER;
ALTER TABLE resources ADD COLUMN removed_by INTEGER;
ALTER TABLE resources ADD COLUMN removed_at TIMESTAMP;

CREATE INDEX idx_resources_folder ON resources (folder_id);

-- Root folders: the canonical subjects (src/constants.ts) …
INSERT INTO resource_folders (name, kind, subject) VALUES
    ('Biology', 'subject', 'Biology'),
    ('Business Studies', 'subject', 'Business Studies'),
    ('Business Studies (HSC)', 'subject', 'Business Studies (HSC)'),
    ('Chemistry', 'subject', 'Chemistry'),
    ('Economics', 'subject', 'Economics'),
    ('Engineering Studies', 'subject', 'Engineering Studies'),
    ('Engineering Studies (HSC)', 'subject', 'Engineering Studies (HSC)'),
    ('English Advanced', 'subject', 'English Advanced'),
    ('English Advanced (HSC)', 'subject', 'English Advanced (HSC)'),
    ('English Extension 1 (HSC)', 'subject', 'English Extension 1 (HSC)'),
    ('Geography', 'subject', 'Geography'),
    ('Geography (HSC)', 'subject', 'Geography (HSC)'),
    ('Health & Movement Science (HSC)', 'subject', 'Health & Movement Science (HSC)'),
    ('Economics (HSC)', 'subject', 'Economics (HSC)'),
    ('Software Engineering', 'subject', 'Software Engineering'),
    ('Software Engineering (HSC)', 'subject', 'Software Engineering (HSC)'),
    ('Mathematics 2U (HSC)', 'subject', 'Mathematics 2U (HSC)'),
    ('Mathematics 3U (HSC)', 'subject', 'Mathematics 3U (HSC)'),
    ('Mathematics 4U (HSC)', 'subject', 'Mathematics 4U (HSC)'),
    ('Legal Studies (HSC)', 'subject', 'Legal Studies (HSC)'),
    ('Modern History', 'subject', 'Modern History'),
    ('Modern History (HSC)', 'subject', 'Modern History (HSC)'),
    ('Ancient History (HSC)', 'subject', 'Ancient History (HSC)'),
    ('Music 2 (HSC)', 'subject', 'Music 2 (HSC)'),
    ('Physics', 'subject', 'Physics'),
    ('Physics (HSC)', 'subject', 'Physics (HSC)'),
    ('Chemistry (HSC)', 'subject', 'Chemistry (HSC)'),
    ('Biology (HSC)', 'subject', 'Biology (HSC)'),
    ('Studies of Religion II (HSC)', 'subject', 'Studies of Religion II (HSC)'),
    ('Other', 'subject', 'Other');

-- … plus any subject existing resources were filed under that is no longer in that list.
INSERT OR IGNORE INTO resource_folders (name, kind, subject)
SELECT DISTINCT subject, 'subject', subject FROM resources;

INSERT INTO resource_folders (name, kind) VALUES ('Removed', 'trash');

-- (A VALUES list, because D1 caps a compound SELECT at five terms.)
WITH s(name, position) AS (
    VALUES ('Task 1', 1), ('Task 2', 2), ('Task 3', 3), ('Task 4', 4), ('Trial', 5), ('HSC', 6), ('Unfiled', 7)
)
INSERT INTO resource_folders (parent_id, name, kind, position)
SELECT f.id, s.name, 'section', s.position
FROM resource_folders f
JOIN s
WHERE f.kind = 'subject'
ORDER BY f.id, s.position;

-- Each resource's single file becomes its first attachment. Keys look like
-- 'resources/<timestamp>-<name>', so the display name is whatever follows the first '-'.
-- (The uploader is looked up because some old rows point at users that no longer exist, which the
-- foreign key on resource_files would reject.)
INSERT INTO resource_files (resource_id, file_key, file_name, uploader_id, created_at)
SELECT id, file_key, substr(file_key, instr(file_key, '-') + 1), (SELECT u.id FROM users u WHERE u.id = resources.uploader_id), created_at
FROM resources
WHERE file_key IS NOT NULL AND file_key != '';

-- File every resource under its subject's Unfiled folder …
UPDATE resources SET folder_id = (
    SELECT s.id
    FROM resource_folders s
    JOIN resource_folders p ON p.id = s.parent_id
    WHERE p.kind = 'subject' AND p.subject = resources.subject AND s.kind = 'section' AND s.name = 'Unfiled'
);

-- … then move the soft-deleted ones into Removed. resources.is_deleted and resources.file_key are
-- left as they were, but nothing reads or writes them any more.
UPDATE resources
SET removed_from_id = folder_id,
    folder_id = (SELECT id FROM resource_folders WHERE kind = 'trash'),
    removed_at = CURRENT_TIMESTAMP
WHERE is_deleted = 1;
