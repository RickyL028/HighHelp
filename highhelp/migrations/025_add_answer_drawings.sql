-- Handwritten answers drawn in the past-paper editor (js-draw). The SVG itself lives in R2 at
-- drawings/q<question_id>/u<user_id>/<context>.svg; this row only records that it exists.
-- Kept apart from the attempt tables on purpose: opening the editor must not count as an attempt
-- or pull the question into the Review queue.
-- context is 'practice', 'review' or 'mock-<mock_exam_id>'.
CREATE TABLE answer_drawings (
    user_id INTEGER NOT NULL,
    question_id INTEGER NOT NULL,
    context TEXT NOT NULL,
    byte_size INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, question_id, context),
    FOREIGN KEY (user_id) REFERENCES users(id),
    -- Cascade so the paper delete and re-import paths are never blocked by D1's foreign key checks.
    FOREIGN KEY (question_id) REFERENCES exam_questions(id) ON DELETE CASCADE
);

CREATE INDEX idx_answer_drawings_question ON answer_drawings(question_id);
