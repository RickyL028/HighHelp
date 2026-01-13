-- Create Papers Table
CREATE TABLE papers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject TEXT NOT NULL,
    school_name TEXT NOT NULL,
    academic_year INTEGER NOT NULL,
    reference_link TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Exam Questions Table (Replacing 'questions' logic for this feature)
CREATE TABLE exam_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paper_id INTEGER NOT NULL,
    section_label TEXT NOT NULL, -- e.g. "I", "II"
    segment_label TEXT, -- e.g. "A", "B" (optional grouping)
    question_number TEXT NOT NULL, -- e.g. "1", "1.a"
    question_full_label TEXT, -- generated for display e.g. "A 1.a"
    question_type TEXT, -- 'multiple_choice', 'short_answer', 'extended_response'
    marks INTEGER,
    question_image_key TEXT,
    answer_image_key TEXT,
    stimulus_image_key TEXT,
    mc_answer TEXT, -- 'A', 'B', 'C', 'D'
    uploader_id INTEGER,
    is_deleted BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (paper_id) REFERENCES papers(id),
    FOREIGN KEY (uploader_id) REFERENCES users(id)
);

-- Create Question Topics Table (Many-to-Many)
CREATE TABLE question_topics (
    question_id INTEGER NOT NULL,
    topic_id INTEGER NOT NULL,
    PRIMARY KEY (question_id, topic_id),
    FOREIGN KEY (question_id) REFERENCES exam_questions(id),
    FOREIGN KEY (topic_id) REFERENCES topics(id)
);
