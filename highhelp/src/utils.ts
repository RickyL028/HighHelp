import { getCookie } from 'hono/cookie'
import { SUBJECTS } from './constants'

export const PRIORITY_STANDARD = [
    "English Advanced",
    "Mathematics 2U (HSC)",
    "Mathematics 3U",
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

export async function updatePoints(userId: number, amount: number, db: D1Database) {
    try {
        await db.prepare('UPDATE users SET points = points + ? WHERE id = ?').bind(amount, userId).run();
    } catch (e) {
        console.error('Failed to update points', e);
    }
}


export const PRIORITY_ESSAY = [
    "English Advanced",
    "Economics",
    "Business Studies",
    "Modern History",
    "Geography",
    "Legal Studies"
];

// --- HELPER FUNCTIONS ---

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 1 week
const encoder = new TextEncoder();

async function hmacKey(secret: string): Promise<CryptoKey> {
    return await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify']
    );
}

// Signs a user id into an unforgeable `userId.expiry.signature` session cookie value.
export async function createSessionCookie(userId: number, secret: string): Promise<string> {
    const expires = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
    const payload = `${userId}.${expires}`;
    const key = await hmacKey(secret);
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    return `${payload}.${signatureB64}`;
}

// Validates a signed session cookie and returns the user id, or null if forged/expired.
export async function getSessionUserId(c: any): Promise<number | null> {
    const cookie = getCookie(c, 'user_id');
    if (!cookie) return null;
    const secret = c.env?.SESSION_SECRET;
    if (!secret) return null;

    const parts = cookie.split('.');
    if (parts.length !== 3) return null;
    const [userIdStr, expiresStr, signatureB64] = parts;
    if (!signatureB64) return null;

    const userId = Number.parseInt(userIdStr, 10);
    if (!Number.isInteger(userId) || userId <= 0) return null;

    const expires = Number.parseInt(expiresStr, 10);
    if (!Number.isInteger(expires) || expires < Math.floor(Date.now() / 1000)) return null;

    try {
        const payload = `${userIdStr}.${expiresStr}`;
        const signature = Uint8Array.from(
            atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/')),
            (char) => char.charCodeAt(0)
        );
        const key = await hmacKey(secret);
        const valid = await crypto.subtle.verify('HMAC', key, signature, encoder.encode(payload));
        return valid ? userId : null;
    } catch (e) {
        return null;
    }
}

export async function getUser(c: any) {
    const userId = await getSessionUserId(c);
    if (!userId) return null;
    return await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
}

// sort subjects based on the requested priority
export const getSortedSubjects = (type: 'standard' | 'essay') => {

    const priorityList = (type === 'essay' ? PRIORITY_ESSAY : PRIORITY_STANDARD) as typeof SUBJECTS[number][];


    const popular = priorityList.filter(s => SUBJECTS.includes(s));

    const others = SUBJECTS
        .filter(s => !(priorityList as string[]).includes(s))
        .sort((a, b) => a.localeCompare(b));

    return { popular, others };
}

// render tags pill
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
    const fruits = ["Apple", "Banana", "Oranges", "Boba", "Mango", "Avocado"];
    return fruits[level] || "No fruit for you :<";
}

export const censorEmail = (email: string) => {
    if (!email) return "";
    const [local, domain] = email.split('@');
    if (!local || !domain) return email;
    const start = local.slice(0, 3);
    return `${start}******@${domain}`;
}

export async function logAction(db: D1Database, userId: number, actionType: string, details?: string, targetId?: number, targetTable?: string) {
    try {
        await db.prepare(
            'INSERT INTO action_logs (user_id, action_type, details, target_id, target_table) VALUES (?, ?, ?, ?, ?)'
        ).bind(userId, actionType, details || null, targetId || null, targetTable || null).run();
    } catch (e) {
        console.error('Failed to log action', e);
    }
}

export const formatDate = (dateInput: string | number | Date) => {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return 'N/A';

    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = String(date.getFullYear()).slice(-2);

    return `${d}-${m}-${y}`;
}
