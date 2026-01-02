-- Migration: Enhance Essays
ALTER TABLE essays ADD COLUMN question TEXT;
ALTER TABLE essays ADD COLUMN full_marks REAL;
ALTER TABLE essays ADD COLUMN file_key TEXT;
ALTER TABLE essay_comments ADD COLUMN grade REAL;
