export interface User {
    id: number;
    student_id: string;
    first_name: string;
    last_name: string;
    email: string;
    role: string;
    permission_level: number;
    created_at: string;
    tags?: string | null;
    points: number; // Defaults to 0
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

export type Bindings = Env & {
    PORTAL_API_CLIENT_ID: string;
    PORTAL_API_CLIENT_SECRET: string;
    APP_REDIRECT_URI: string;
}
