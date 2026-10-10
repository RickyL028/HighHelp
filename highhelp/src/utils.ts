import { getCookie } from 'hono/cookie'
import { SUBJECTS } from './constants'
import { forumRelevanceMatch } from './forumRelevance'

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

// SQL fragment that reports whether an announcement's target audience matches the viewer.
// `a` must be in scope (an `announcements` row); `viewerTags` is any SQL expression yielding
// the viewer's `users.tags` JSON -- a `u.tags` column, or `(SELECT tags FROM viewer)`.
//
// Audience keys are namespaced so both sides can be compared as plain strings:
//   'all'             -> everyone
//   'tag:<name>'      -> the viewer has that Visibility Tag on their profile
//   'year:<value>'    -> the viewer's Year tag equals <value>
// The tag key is wrapped in double quotes because subject names contain spaces, dots and
// parentheses, which SQLite's JSON path parser would otherwise read as path syntax.
//
// The match is on the key *existing*, not on its value: buildUserTags() creates a key for every
// subject a student has on their portal timetable, so `{"Physics Yr11": 0}` means "takes
// Physics, hasn't ticked the profile box". The 0/1 is display state (renderTags only shows the
// ticked ones), so a 0 still counts as a match.
export const announcementAudienceMatch = (viewerTags: string) => `
    EXISTS (
        SELECT 1 FROM json_each(a.target_tags) je
        WHERE je.value = 'all'
           OR (je.value LIKE 'tag:%' AND json_type(${viewerTags}, '$."' || substr(je.value, 5) || '"') IS NOT NULL)
           OR (je.value LIKE 'year:%' AND json_extract(${viewerTags}, '$.Year') = substr(je.value, 6))
    )`;

// The same predicate, reading the viewer's tags from a CTE that takes them as a single bound
// value. D1 counts parameter *occurrences*, so a named parameter may not be repeated in one
// statement -- which is exactly what the predicate above does with `viewerTags`.
export const VIEWER_TAGS_CTE = `WITH viewer AS (SELECT ? AS tags)`;
export const VIEWER_TAGS_EXPR = `(SELECT tags FROM viewer)`;

// Viewer tags plus viewer id in one CTE, so a query can bind everything positionally and in a
// fixed order: viewer tags first, viewer id second.
export const VIEWER_CTE = `WITH viewer AS (SELECT ? AS tags), me AS (SELECT ? AS id)`;
export const VIEWER_ID_EXPR = `(SELECT id FROM me)`;

export async function getUser(c: any) {
    if (userCache.has(c)) return userCache.get(c);
    const userId = await getSessionUserId(c);
    const user = userId
        ? await c.env.DB.prepare(`
            SELECT u.*,
                -- The two unread counts only run when the user has that notification switched on.
                CASE WHEN u.notify_announcements THEN (SELECT COUNT(*) FROM announcements a
                  WHERE a.status = 'published'
                    AND a.is_deleted = 0
                    AND COALESCE(a.published_at, a.created_at) > COALESCE(ars.last_read_at, '1970-01-01 00:00:00')
                    AND ${announcementAudienceMatch('u.tags')}
                ) ELSE 0 END AS unread_announcements,
                (SELECT COUNT(*) FROM announcements pa
                  WHERE pa.status = 'pending' AND pa.is_deleted = 0
                ) AS pending_announcements,
                CASE WHEN u.notify_questions THEN (SELECT COUNT(*) FROM posts p
                  WHERE p.type = 'question'
                    AND p.is_deleted = 0
                    AND p.author_id IS NOT u.id
                    AND p.created_at > COALESCE(frs.last_read_at, u.created_at, '1970-01-01 00:00:00')
                    AND ${forumRelevanceMatch('p.subject', 'u.tags')}
                ) ELSE 0 END AS unread_questions,
                COALESCE(frs.last_read_at, u.created_at) AS forum_last_read_at
            FROM users u
            LEFT JOIN announcement_read_state ars ON ars.user_id = u.id
            LEFT JOIN forum_read_state frs ON frs.user_id = u.id
            WHERE u.id = ?`).bind(userId).first()
        : null;
    userCache.set(c, user);
    return user;
}

// Mark everything the user can see as read. Called by the announcement routes after the
// badge count has already been computed for this request, so the red dot stays lit on the
// page that cleared it and disappears on the next navigation.
export async function markAnnouncementsRead(db: D1Database, userId: number) {
    try {
        await db.prepare(`
            INSERT INTO announcement_read_state (user_id, last_read_at)
            VALUES (?, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id) DO UPDATE SET last_read_at = CURRENT_TIMESTAMP
        `).bind(userId).run();
    } catch (e) {
        console.error('Failed to mark announcements read', e);
    }
}

// Same idea for Q&A: clears the red dot for new questions in the user's subjects.
export async function markQuestionsRead(db: D1Database, userId: number) {
    try {
        await db.prepare(`
            INSERT INTO forum_read_state (user_id, last_read_at)
            VALUES (?, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id) DO UPDATE SET last_read_at = CURRENT_TIMESTAMP
        `).bind(userId).run();
    } catch (e) {
        console.error('Failed to mark questions read', e);
    }
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

// Tags that are managed by the system or by hand, so they are never treated as a
// user-toggleable visibility tag and survive a rebuild of the tag object.
export const RESERVED_TAGS = ['Year', 'External'];

// Accounts tagged "External" (e.g. { "External": 1 }) signed in with a login code
// rather than the portal API, so the portal-backed features (timetable, attendance,
// points) have no data behind them for that account.
export function isExternalUser(user: { tags?: string | null } | null | undefined): boolean {
	if (!user?.tags) return false;
	try {
		const parsed = JSON.parse(user.tags);
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
		return parsed['External'] !== undefined && parsed['External'] !== null;
	} catch (e) {
		return false;
	}
}

// Build the display tags object for a user.
// Subject tags default to 0 (hidden) and preserve any existing user toggle (0 or 1).
// Reserved tags are carried over untouched: the Year tag keeps its raw value
// (e.g. "7") so it is never rendered (renderTags only shows tags whose value is
// exactly 1), and manually set tags such as External are never dropped.
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

    for (const tag of RESERVED_TAGS) {
        if (existing[tag] !== undefined) tags[tag] = existing[tag];
    }

    if (yearGroup !== undefined && yearGroup !== null && yearGroup !== '') {
        tags['Year'] = String(yearGroup);
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

// Separator characters left at the seam of a split, e.g. the dash in "Calculus - 1.2 Differentiation".
const trimTopicSeparators = (value: string) => normalizeTopicHierarchyLabel(value.replace(/^[\s\-–—:.,]+|[\s\-–—:.,]+$/g, ''));

// The first digit anywhere after the first character, even inside a word: "M1.1 - Vectors" and
// "M1.2 Forces" are both under "M".
const SECTION_NUMBER = /(?<=.)\d/;
// A dash with a space before it, or any en or em dash. A hyphen inside a word ("Z-scores") is part of the name.
const TOPIC_DASH = /\s-|[–—]/;

/**
 * Browse groups topics by the phrase before the first number: "Calculus 1.2 Differentiation" and
 * "M1.1 - Vectors" are subtopics of "Calculus" and "M", the number starting the subtopic. The number
 * decides first, so "Mechanics – Projectiles 2" is under "Mechanics – Projectiles". Only a name with no
 * number is split at a dash, as "Calculus - Integration" is. "Product-to-Sum Identities" and
 * "Z-scores" stay whole topics, and so does "3D Vectors", whose number has nothing before it.
 */
export function parseTopicHierarchy(name: string): TopicHierarchy {
    const value = normalizeTopicHierarchyLabel(name);

    for (const separator of [SECTION_NUMBER, TOPIC_DASH]) {
        const index = value.search(separator);
        if (index <= 0) continue;
        const topic = trimTopicSeparators(value.slice(0, index));
        const subtopic = trimTopicSeparators(value.slice(index));
        if (topic && subtopic) return { topic, subtopic };
    }

    return { topic: trimTopicSeparators(value) || value, subtopic: null };
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
