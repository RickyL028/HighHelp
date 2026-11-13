export const SUBJECTS = [
    "Biology",
    "Business Studies",
    "Business Studies (HSC)",
    "Chemistry",
    "Economics",
    "Engineering Studies",
    "Engineering Studies (HSC)",
    "English Advanced",
    "English Advanced (HSC)",
    "English Extension 1 (HSC)",
    "Geography",
    "Geography (HSC)",
    "Health & Movement Science (HSC)",
    "Economics (HSC)",
    "Software Engineering",
    "Software Engineering (HSC)",
    "Mathematics 2U (HSC)",
    "Mathematics 3U (HSC)",
    "Mathematics 4U (HSC)",
    "Legal Studies (HSC)",
    "Modern History",
    "Modern History (HSC)",
    "Ancient History (HSC)",
    "Music 2 (HSC)",
    "Physics",
    "Physics (HSC)",
    "Chemistry (HSC)",
    "Biology (HSC)",
    "Studies of Religion II (HSC)",
    "Studies of Religion I (HSC)",
    "English Extension 2 (HSC)",
    "Chinese Continuers (HSC)",
    "Latin (HSC)",
    "Music Extension (HSC)",
    "Other",
] as const;

// The canonical subject key (as stored in the DB / used in ?subject= filters) may differ from
// what we render in the UI. Bare names (the cohort's prior-year subjects) display with an
// explicit "(Y11)" suffix; already-suffixed and special catch-all values are left untouched.
// Tag-named keys ("Physics Yr11", used by newer Q&A questions) already carry their year.
const YEAR_SUFFIX = /\((?:HSC|Y1[0-9])\)$| Yr[0-9]{2}$/;
const SPECIAL_SUBJECTS = new Set(['All', 'General', 'Other']);
export const subjectLabel = (key: string) =>
    SPECIAL_SUBJECTS.has(key) || YEAR_SUFFIX.test(key) ? key : `${key} (Y11)`;

export type Subject = typeof SUBJECTS[number];
