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
    // Nav red-dot switches (profile page). 1 = on.
    notify_announcements?: number;
    notify_questions?: number;
    points: number; // Defaults to 0 but actually +2 because logic change
    // Computed by getUser, not real columns.
    // unread_announcements: published announcements matching this user's tags that are newer
    // than their last visit to /announcements. Drives the nav red dot.
    // pending_announcements: proposals waiting for review. Also drives the nav red dot, but
    // only reviewers act on it, so the layout gates it on the permission level.
    unread_announcements?: number;
    pending_announcements?: number;
    // unread_questions: Q&A questions in this user's subjects (see forumRelevance.ts), by someone
    // else, newer than forum_last_read_at -- their last visit to the Q&A feed. Drives the Q&A dot.
    unread_questions?: number;
    forum_last_read_at?: string | null;
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

export interface Paper {
    id: number;
    subject: string;
    school_name: string;
    academic_year: number;
    reference_link: string | null;
    created_at: string;
}

export interface ExamQuestion {
    id: number;
    paper_id: number;
    section_label: string;
    segment_label: string | null;
    question_number: string;
    question_full_label: string | null;
    question_type: 'multiple_choice' | 'short_answer' | 'extended_response';
    marks: number | null;
    question_image_key: string | null;
    answer_image_key: string | null;
    stimulus_image_key: string | null;
    mc_answer: string | null;
    uploader_id: number;
    user_id: number;
    is_deleted: boolean;
    ordering_index: number;
    created_at: string;
}

export type Bindings = Env & {
    AI_QUEUE: Queue;
    SESSION_SECRET: string;
    PORTAL_API_CLIENT_ID: string;
    PORTAL_API_CLIENT_SECRET: string;
    APP_REDIRECT_URI: string;
    PORTAL_API_CLIENT_ID_full: string;
    PORTAL_API_CLIENT_SECRET_full: string;
    APP_REDIRECT_URI_full: string;
    GEMINI_API_KEY: string;
    LOCAL_DEV?: boolean | string;
}
