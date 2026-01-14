-- Create Mock Exams Table
CREATE TABLE mock_exams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    subject TEXT NOT NULL,
    exam_name TEXT, -- e.g. "Mock Exam 1", "Auto Generated Exam"
    created_method TEXT NOT NULL, -- 'manual' or 'auto'
    
    -- Timer Logic
    allowed_time_seconds INTEGER, -- Optional: User set limit (null if no limit)
    elapsed_time_seconds INTEGER DEFAULT 0, -- Time spent so far
    is_timed BOOLEAN DEFAULT 0,
    
    -- Status
    status TEXT DEFAULT 'in_progress', -- 'in_progress', 'completed'
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create Mock Exam Questions Table (Junction table)
CREATE TABLE mock_exam_questions (
    mock_exam_id INTEGER NOT NULL,
    question_id INTEGER NOT NULL,
    ordering_index INTEGER NOT NULL, -- To maintain the sequence of questions in the mock
    
    PRIMARY KEY (mock_exam_id, question_id),
    FOREIGN KEY (mock_exam_id) REFERENCES mock_exams(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES exam_questions(id)
);
