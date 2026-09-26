import { getCookie } from 'hono/cookie'
import { SUBJECTS } from './constants'

export const PRIORITY_STANDARD = [
    "Mathematics 3U (HSC)",
    "Mathematics 4U (HSC)",
    "Physics (HSC)",
    "Chemistry (HSC)",
    "Biology (HSC)",
    "Mathematics 2U (HSC)",
    "Economics (HSC)",
    "Modern History (HSC)",
    "Business Studies (HSC)",
    "Legal Studies (HSC)",
    "Geography (HSC)",    
    "English Advanced (HSC)",
    "Ancient History (HSC)",
    "Engineering Studies (HSC)",
    "Music 2 (HSC)",
    "Studies of Religion II (HSC)",
    "English Extension 1 (HSC)",
    "Health & Movement Science (HSC)",

    "Software Engineering (HSC)",

];

export async function updatePoints(userId: number, amount: number, db: D1Database) {
    try {
        await db.prepare('UPDATE users SET points = points + ? WHERE id = ?').bind(amount, userId).run();
    } catch (e) {
        console.error('Failed to update points', e);
    }
}


export const PRIORITY_ESSAY = [
    "English Advanced (HSC)",
    "English Advanced",
    "Economics",
    "Business Studies (HSC)",
    "Business Studies",
    "Modern History (HSC)",
    "Ancient History (HSC)",
    "Modern History",
    "Geography (HSC)",
    "Geography",
    "Legal Studies",
    "Studies of Religion II (HSC)"
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

// A post-login return target. Only same-origin relative paths made of URL-safe
// characters are accepted, so a crafted `?next=` can neither bounce a freshly
// authenticated user off-site nor break out of the markup the target is
// interpolated into.
export function safeNext(next: unknown): string | null {
    if (typeof next !== 'string') return null;
    const value = next.trim();
    if (!value.startsWith('/')) return null;
    if (value.startsWith('//') || value.startsWith('/\\')) return null;
    if (!/^[A-Za-z0-9\-._~%!$&'()*+,;=:@/?#[\]]*$/.test(value)) return null;
    // Never loop back into the auth flow itself
    if (/^\/(login|logout|code-login)(\/|\?|$)/.test(value)) return null;
    if (value.startsWith('/api/auth')) return null;
    return value;
}

// The same-origin page that made the current request, if any. Used as the
// return target for plain "/login" links so a user who clicks one while sitting
// on a page lands back on that page.
export function refererTarget(c: any): string | null {
    const referer = c.req.header('referer');
    if (!referer) return null;
    try {
        const from = new URL(referer);
        if (from.host !== new URL(c.req.url).host) return null;
        return safeNext(from.pathname + from.search);
    } catch (e) {
        return null;
    }
}

// The page the user was trying to reach when they got bounced to /login.
// A GET knows its own target; other methods (form posts, fetches) fall back to
// the same-origin page that made the request.
function returnTarget(c: any): string | null {
    const current = new URL(c.req.url);

    if (c.req.method === 'GET') {
        return safeNext(current.pathname + current.search);
    }

    return refererTarget(c);
}

// Login URL that remembers where the user was headed, so they land back there
// after authenticating. `fallback` is used when the request gives us nothing
// usable (e.g. a POST with no same-origin referer).
export function loginRedirect(c: any, fallback: string = '/'): string {
    const target = returnTarget(c) ?? safeNext(fallback) ?? '/';
    return target === '/' ? '/login' : `/login?next=${encodeURIComponent(target)}`;
}

const userCache = new WeakMap<object, any>();

export async function getUser(c: any) {
    if (userCache.has(c)) return userCache.get(c);
    const userId = await getSessionUserId(c);
    const user = userId
        ? await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first()
        : null;
    userCache.set(c, user);
    return user;
}

// sort subjects based on the requested priority
export const getSortedSubjects = (type: 'standard' | 'essay') => {

    const priorityList = (type === 'essay' ? PRIORITY_ESSAY : PRIORITY_STANDARD) as typeof SUBJECTS[number][];


    const popular = priorityList.filter(s => SUBJECTS.includes(s));

    // Surface every (HSC) subject as popular too, so new current-year subjects are never missed.
    const hscNotListed = SUBJECTS.filter(s => /\(HSC\)/.test(s) && !popular.includes(s));
    const finalPopular = type === 'standard' ? [...popular, ...hscNotListed] : popular;

    const others = SUBJECTS
        .filter(s => !finalPopular.includes(s))
        .sort((a, b) => a.localeCompare(b));

    return { popular: finalPopular, others };
}

// Derive the student's subject names from the timetable payload.
// Each subject is stored as { "9Ma1": { ..., "subject": "English", ... } }.
// We use the `subject` field, and skip non-academic entries (meetings/sport/year).
const NON_SUBJECT_MARKERS = ['meetings', 'sport', 'year'];
export function extractTimetableSubjects(timetable: any): string[] {
    const names = new Set<string>();
    const subjects = timetable?.subjects || {};
    const entries: any[] = Array.isArray(subjects) ? subjects : Object.values(subjects);
    for (const s of entries) {
        const name = s?.subject;
        if (!name || typeof name !== 'string') continue;
        const trimmed = name.trim();
        if (!trimmed) continue;
        const lower = trimmed.toLowerCase();
        if (NON_SUBJECT_MARKERS.some(m => lower.includes(m))) continue;
        names.add(trimmed);
    }
    return Array.from(names);
}

// Build the display tags object for a user.
// Subject tags default to 0 (hidden) and preserve any existing user toggle (0 or 1).
// The Year tag is stored with its raw value (e.g. "7") so it is never rendered
// (renderTags only shows tags whose value is exactly 1).
export function buildUserTags(existingTagsJson: string | null | undefined, subjects: string[], yearGroup: string | number | null | undefined): string {
    let existing: Record<string, any> = {};
    if (existingTagsJson) {
        try {
            const parsed = JSON.parse(existingTagsJson);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) existing = parsed;
        } catch (e) {
        }
    }

    const tags: Record<string, any> = {};

    for (const subject of subjects) {
        const current = existing[subject];
        const value = current === 1 || current === 0 ? current : 0;
        tags[subject] = value;
    }

    if (yearGroup !== undefined && yearGroup !== null && yearGroup !== '') {
        tags['Year'] = String(yearGroup);
    } else if (existing['Year'] !== undefined) {
        tags['Year'] = existing['Year'];
    }

    return JSON.stringify(tags);
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

export type TopicHierarchy = {
    topic: string;
    subtopic: string | null;
};

export const normalizeTopicHierarchyLabel = (value: string) => value.trim().replace(/\s+/g, ' ');

export function parseTopicHierarchy(name: string): TopicHierarchy {
    const value = normalizeTopicHierarchyLabel(name);
    const numberIndex = value.search(/\d/);

    if (numberIndex > 0) {
        return {
            topic: normalizeTopicHierarchyLabel(value.slice(0, numberIndex)),
            subtopic: normalizeTopicHierarchyLabel(value.slice(numberIndex))
        };
    }

    const dashIndex = value.search(/[-–—]/);
    if (dashIndex > 0) {
        return {
            topic: normalizeTopicHierarchyLabel(value.slice(0, dashIndex)),
            subtopic: normalizeTopicHierarchyLabel(value.slice(dashIndex + 1))
        };
    }

    return { topic: value, subtopic: null };
}

export const topicHierarchyKey = (value: string) => normalizeTopicHierarchyLabel(value).toLowerCase();

export async function getTopicIdsForHierarchy(db: D1Database, subject: string, topic: string): Promise<number[]> {
    const target = topicHierarchyKey(topic);
    if (!target) return [];

    const topics = await db.prepare('SELECT id, name FROM topics WHERE subject = ?').bind(subject).all<{ id: number; name: string }>();
    return topics.results
        .filter(row => topicHierarchyKey(parseTopicHierarchy(row.name).topic) === target)
        .map(row => row.id);
}
