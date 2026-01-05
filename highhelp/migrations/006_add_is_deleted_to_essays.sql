-- Migration: Add is_deleted to essays and essay_comments
ALTER TABLE essays ADD COLUMN is_deleted BOOLEAN DEFAULT 0;
ALTER TABLE essay_comments ADD COLUMN is_deleted BOOLEAN DEFAULT 0;
