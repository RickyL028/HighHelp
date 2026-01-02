import { getCookie } from 'hono/cookie'
import { SUBJECTS } from './constants'

export const PRIORITY_STANDARD = [
    "English Advanced",
    "Mathematics Advanced",
    "Mathematics Extension 1",
    "Physics",
    "Chemistry",
    "Biology",
    "Economics",
    "Business Studies",
    "Modern History",
    "Geography",
    "Legal Studies",
    "Software Engineering",
    "Engineering Studies"
];

export const PRIORITY_ESSAY = [
    "English Advanced",
    "Economics",
    "Business Studies",
    "Modern History",
    "Geography",
    "Legal Studies"
];

// --- HELPER FUNCTIONS ---

export async function getUser(c: any) {
    const userId = getCookie(c, 'user_id')
    if (!userId) return null
    return await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first()
}

// New Helper to sort subjects based on the requested priority
export const getSortedSubjects = (type: 'standard' | 'essay') => {
    // Cast the priority list to match the type of the elements in SUBJECTS
    const priorityList = (type === 'essay' ? PRIORITY_ESSAY : PRIORITY_STANDARD) as typeof SUBJECTS[number][];

    // Now TypeScript knows 's' is the specific literal type, not just a generic 'string'
    const popular = priorityList.filter(s => SUBJECTS.includes(s));

    const others = SUBJECTS
        .filter(s => !(priorityList as string[]).includes(s))
        .sort((a, b) => a.localeCompare(b));

    return { popular, others };
}

// Helper to render tags pill
export const renderTags = (tagsJson: string | null) => {
    if (!tagsJson) return '';
    try {
        const tags = JSON.parse(tagsJson);
        const activeTags = Object.entries(tags)
            .filter(([_, val]) => val === 1)
            .map(([key, _]) => key);

        if (activeTags.length === 0) return '';

        return activeTags.map(tag =>
            `<span class="inline-block bg-transparent text-gray-600 text-xs px-2 py-0.5 rounded-full font-bold border border-gray-300 mr-1 align-middle">${tag}</span>`
        ).join('');
    } catch (e) {
        return '';
    }
}

export const getFruitPermission = (level: number) => {
    const fruits = ["Apple", "Banana", "Oranges", "Watermelon", "Cherry", "Avocado"];
    return fruits[level] || "No fruit for you :<";
}

export const censorEmail = (email: string) => {
    if (!email) return "";
    const [local, domain] = email.split('@');
    if (!local || !domain) return email;
    const start = local.slice(0, 3);
    return `${start}******@${domain}`;
}
