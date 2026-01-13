-- Add ordering_index to exam_questions
-- We default it to the ID value so existing questions maintain order roughly, 
-- but we should probably run a script to set it properly if IDs are not sequential per paper.
-- For simplicity in SQLite ALTER TABLE, we add the column first.

ALTER TABLE exam_questions ADD COLUMN ordering_index REAL DEFAULT 0;

-- Update existing rows to have ordering_index = id (as a baseline)
UPDATE exam_questions SET ordering_index = id;
