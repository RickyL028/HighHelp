export const SUBJECTS = [
    "Biology",
    "Business Studies",
    "Business Studies (HSC)",
    "Chemistry",
    "Chinese Continuers",
    "Chinese Continuers (HSC)",
    "Classical Greek",
    "Drama",
    "Economics",
    "Engineering Studies",
    "English Advanced",
    "Geography",
    "Geography (HSC)",
    "German Continuers (HSC)",
    "Health & Movement Science",
    "Latin Continuers",
    "Legal Studies",
    "Mathematics 2U",
    "Mathematics 2U (HSC)",
    "Mathematics 3U",
    "Modern History",
    "Modern History (HSC)",
    "Music 2",
    "Music 2 (HSC)",
    "NSW School of Languages",
    "Physics",
    "Software Engineering",
    "Visual Arts",
    "Other"
] as const;

export const ANNOUNCEMENT_SUBJECTS = ["All", ...SUBJECTS] as const;

export type Subject = typeof SUBJECTS[number];
