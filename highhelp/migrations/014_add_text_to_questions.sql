-- Migration number: 014 	 2026-01-17T08:38:00
ALTER TABLE exam_questions ADD COLUMN question_text TEXT;
ALTER TABLE exam_questions ADD COLUMN answer_text TEXT;
ALTER TABLE exam_questions ADD COLUMN stimulus_text TEXT;
