CREATE INDEX idx_papers_subject_school_year
    ON papers(subject, school_name, academic_year DESC, created_at DESC, id);

CREATE INDEX idx_exam_questions_paper_active_order
    ON exam_questions(paper_id, is_deleted, ordering_index, id);

CREATE INDEX idx_exam_questions_paper_active_section
    ON exam_questions(paper_id, is_deleted, section_label, id);

CREATE INDEX idx_question_topics_topic_question
    ON question_topics(topic_id, question_id);

CREATE INDEX idx_user_question_attempts_user_created
    ON user_question_attempts(user_id, created_at DESC, id DESC);

CREATE INDEX idx_user_review_attempts_user_question_created
    ON user_review_attempts(user_id, question_id, created_at DESC, id DESC);

CREATE INDEX idx_topics_subject_name_nocase
    ON topics(subject, name COLLATE NOCASE);

PRAGMA optimize;
