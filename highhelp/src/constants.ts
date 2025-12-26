export const SUBJECTS = [
    "Biology",
    "Business Studies",
    "Business Studies (HSC Accelerated)",
    "Chemistry",
    "Chinese Continuers",
    "Chinese Continuers (HSC Accelerated)",
    "Classical Greek",
    "Drama",
    "Economics",
    "Engineering Studies",
    "English Advanced",
    "Geography",
    "Geography (HSC Accelerated)",
    "German Continuers (HSC Accelerated)",
    "Health & Movement Science",
    "Latin Continuers",
    "Legal Studies",
    "Mathematics Advanced",
    "Mathematics Advanced X1",
    "Modern History",
    "Modern History (HSC Accelerated)",
    "Music 2",
    "Music 2 (HSC Accelerated)",
    "NSW School of Languages",
    "Physics",
    "Software Engineering",
    "Visual Arts",
    "Other"
] as const;

export const ANNOUNCEMENT_SUBJECTS = ["All", ...SUBJECTS] as const;

export type Subject = typeof SUBJECTS[number];
