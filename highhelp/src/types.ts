export interface User {
    id: number;
    student_id: string;
    first_name: string;
    last_name: string;
    email: string;
    role: string;
    permission_level: number;
    created_at: string;
}

export interface Topic {
    id: number;
    subject: string;
    name: string;
    created_at: string;
}

export interface Question {
    id: number;
    topic_id: number;
    question_image_key: string | null;
    answer_image_key: string | null;
    uploader_id: number;
    paper_tag: string | null;
    created_at: string;
}
