-- Isolate Mock Exam Attempts from Global Practice History
ALTER TABLE mock_exam_questions ADD COLUMN response_content TEXT;
ALTER TABLE mock_exam_questions ADD COLUMN selected_option TEXT;
ALTER TABLE mock_exam_questions ADD COLUMN marks_awarded INTEGER;
ALTER TABLE mock_exam_questions ADD COLUMN marker_notes TEXT;
