-- Migration: Add paper_tag to questions table
ALTER TABLE questions ADD COLUMN paper_tag TEXT;
