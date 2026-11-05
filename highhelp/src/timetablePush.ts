import { Bindings } from './types';
import { HeldAccess, heldAccessToken } from './portalTokens';
import {
    CheckPlan,
    ScanDeadline,
    addDays,
    extractChanges,
    firstClassGroup,
    formatChangeNotification,
    newChanges,
    parseSnapshot,
    planTick,
    scannedOn,
    sydneyClock,
} from './timetableChanges';
import { PushOptions, PushTarget, VapidKeys, sendWebPush } from './webPush';

// Timetable change alerts and scan-on reminders. A cron tick every 5 minutes (wrangler.jsonc
// `triggers`) works out what to check (planTick) and queues every subscribed user in chunks. The queue
// consumer reads each user's timetable with their held portal token (portalTokens.ts), then:
// - for each planned date, compares the day with the last alerted snapshot and pushes any new subs,
//   no-cover periods or room changes to all their devices;
// - at a scan-on deadline, reminds students whose first class is in that group and who have no scan-in
//   for today yet.

export const TIMETABLE_PUSH_QUEUE = 'timetable-push-queue';
const USERS_PER_MESSAGE = 10;
const MAX_DEVICES_PER_USER = 10;

export interface TimetableCheckJob {
    userIds: number[];
    checks: CheckPlan[];
    scan: (ScanDeadline & { date: string }) | null;
}

export interface PushMessage {
    title: string;
    body: string;
    url: string;
    tag: string;
}

interface SubscriptionRow extends PushTarget {
    id: number;
}

export function pushConfigured(env: Bindings): boolean {
    return !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.TOKEN_ENC_KEY);
}

function vapidKeys(env: Bindings): VapidKeys {
    return { publicKey: env.VAPID_PUBLIC_KEY!, privateKey: env.VAPID_PRIVATE_KEY!, subject: 'https://highhelp.org' };
}

function errorMessage(err: unknown): string {
    return String((err as any)?.message ?? err);
}

// Sends to every device, deleting subscriptions the push service says are gone. Returns how many
// devices accepted the message.
export async function pushToDevices(env: Bindings, subs: SubscriptionRow[], message: PushMessage, options: PushOptions): Promise<number> {
    const payload = JSON.stringify(message);
    const results = await Promise.all(
        subs.map(async (sub) => {
            try {
                const status = await sendWebPush(sub, payload, vapidKeys(env), options);
                if (status === 404 || status === 410) {
                    await env.DB.prepare('DELETE FROM push_subscriptions WHERE id = ?').bind(sub.id).run();
                } else if (status >= 400) {
                    // The endpoint URL is a credential for that device, so only log its host.
                    console.warn('[timetable-push] push rejected', { status, host: new URL(sub.endpoint).host });
                }
                return status >= 200 && status < 300;
            } catch (err) {
                console.error('[timetable-push] push failed', { host: new URL(sub.endpoint).host, error: errorMessage(err) });
                return false;
            }
        })
    );
    return results.filter(Boolean).length;
}

export function userDevices(env: Bindings, userId: number) {
    return env.DB.prepare('SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?').bind(userId).all<SubscriptionRow>();
}

// Keeps the newest MAX_DEVICES_PER_USER subscriptions.
export async function trimDevices(env: Bindings, userId: number) {
    await env.DB.prepare(
        'DELETE FROM push_subscriptions WHERE user_id = ? AND id NOT IN (SELECT id FROM push_subscriptions WHERE user_id = ? ORDER BY id DESC LIMIT ?)'
    )
        .bind(userId, userId, MAX_DEVICES_PER_USER)
        .run();
}

export const ALERTS_PAUSED: PushMessage = {
    title: 'Timetable alerts paused',
    body: 'Your school login has expired. Open HighHelp and log in again to keep getting alerts.',
    url: '/api/auth/login?next=/timetable',
    tag: 'timetable-alerts',
};

// ---- Cron ----

export async function scheduleTimetableChecks(env: Bindings, now: Date) {
    const { date, minutes } = sydneyClock(now);
    // Once a night, at 3am.
    if (minutes >= 3 * 60 && minutes < 3 * 60 + 5) await sweepPushData(env, date);

    const { checks, scan } = planTick(now);
    if (checks.length === 0 && !scan) return;
    if (!pushConfigured(env)) {
        console.warn('[timetable-push] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / TOKEN_ENC_KEY not set; skipping');
        return;
    }

    const { results } = await env.DB.prepare(
        "SELECT DISTINCT s.user_id FROM push_subscriptions s JOIN portal_tokens t ON t.user_id = s.user_id WHERE t.status = 'active'"
    ).all<{ user_id: number }>();
    const jobs: { body: TimetableCheckJob }[] = [];
    for (let i = 0; i < results.length; i += USERS_PER_MESSAGE) {
        const userIds = results.slice(i, i + USERS_PER_MESSAGE).map((r) => r.user_id);
        jobs.push({ body: { userIds, checks, scan: scan ? { ...scan, date } : null } });
    }
    // sendBatch takes at most 100 messages.
    for (let i = 0; i < jobs.length; i += 100) await env.PUSH_QUEUE.sendBatch(jobs.slice(i, i + 100));
}

// Drops week-old snapshots and reminders, and held tokens of users with no devices left (e.g. every
// subscription expired), so tokens are only ever held for students actively receiving alerts.
async function sweepPushData(env: Bindings, today: string) {
    const cutoff = addDays(today, -7);
    await env.DB.batch([
        env.DB.prepare('DELETE FROM timetable_snapshots WHERE date < ?').bind(cutoff),
        env.DB.prepare('DELETE FROM scan_reminders WHERE date < ?').bind(cutoff),
        env.DB.prepare('DELETE FROM portal_tokens WHERE user_id NOT IN (SELECT user_id FROM push_subscriptions)'),
        env.DB.prepare('DELETE FROM timetable_snapshots WHERE user_id NOT IN (SELECT user_id FROM push_subscriptions)'),
        env.DB.prepare('DELETE FROM scan_reminders WHERE user_id NOT IN (SELECT user_id FROM push_subscriptions)'),
    ]);
}

// ---- Queue consumer ----

export async function processTimetableCheckBatch(batch: MessageBatch<TimetableCheckJob>, env: Bindings) {
    for (const message of batch.messages) {
        const job = message.body;
        // A failure for one user is logged and left for the next tick rather than retrying the whole chunk.
        const results = await Promise.allSettled(job.userIds.map((userId) => checkUser(env, userId, job)));
        results.forEach((r, i) => {
            if (r.status === 'rejected') console.error('[timetable-push] check failed', { userId: job.userIds[i], error: errorMessage(r.reason) });
        });
        message.ack();
    }
}

// Portal GETs for one user with their held token, refreshing it once if the portal rejects it.
// `get` returns null when there is no usable token; `revoked` says the portal refused it just now.
function portalSession(env: Bindings, userId: number) {
    let held: HeldAccess | null = null;
    let refreshed = false;
    const session = {
        revoked: false,
        async get(url: string): Promise<any> {
            held ??= await heldAccessToken(env, userId);
            while (true) {
                if (held.status !== 'ok') {
                    if (held.status === 'revoked') session.revoked = true;
                    return null;
                }
                const res = await fetch(url, { headers: { Authorization: `Bearer ${held.accessToken}` } });
                if ((res.status === 401 || res.status === 403) && !refreshed) {
                    await res.body?.cancel();
                    refreshed = true;
                    held = await heldAccessToken(env, userId, true);
                    continue;
                }
                if (!res.ok) {
                    await res.body?.cancel();
                    throw new Error(`${new URL(url).pathname} returned ${res.status}`);
                }
                return res.json();
            }
        },
    };
    return session;
}

function isSchoolDayData(day: any): boolean {
    return !!day && (!day.status || day.status === 'OK');
}

async function checkUser(env: Bindings, userId: number, job: TimetableCheckJob) {
    const subs = (await userDevices(env, userId)).results;
    if (subs.length === 0) return;

    const portal = portalSession(env, userId);
    const days = new Map<string, any>();
    async function day(date: string) {
        if (!days.has(date)) days.set(date, await portal.get(`https://student.sbhs.net.au/api/timetable/daytimetable.json?date=${date}`));
        return days.get(date);
    }

    for (const check of job.checks) {
        const data = await day(check.date);
        if (portal.revoked) return alertsPaused(env, subs);
        if (!data) return;
        if (isSchoolDayData(data)) await alertChanges(env, userId, subs, check, data);
    }

    if (job.scan) {
        const data = await day(job.scan.date);
        if (portal.revoked) return alertsPaused(env, subs);
        if (isSchoolDayData(data) && firstClassGroup(data) === job.scan.group) await remindScan(env, userId, subs, portal, job.scan);
    }
}

async function alertsPaused(env: Bindings, subs: SubscriptionRow[]) {
    await pushToDevices(env, subs, ALERTS_PAUSED, { ttl: 7 * 24 * 60 * 60, urgency: 'normal', topic: 'timetable-alerts' });
}

async function alertChanges(env: Bindings, userId: number, subs: SubscriptionRow[], { date, label }: CheckPlan, day: any) {
    const changes = extractChanges(day);
    const snapshot = await env.DB.prepare('SELECT changes FROM timetable_snapshots WHERE user_id = ? AND date = ?')
        .bind(userId, date)
        .first<{ changes: string }>();
    const fresh = newChanges(parseSnapshot(snapshot?.changes), changes);

    if (fresh.length > 0) {
        const { title, body } = formatChangeNotification(changes, label);
        const delivered = await pushToDevices(
            env,
            subs,
            { title, body, url: `/timetable?date=${date}#day`, tag: `timetable-${date}` },
            // A newer alert for the same date replaces an undelivered one.
            { ttl: (label === 'today' ? 12 : 24) * 60 * 60, urgency: 'high', topic: `timetable-${date}` }
        );
        // Leave the snapshot alone so the next tick tries again.
        if (delivered === 0) return;
    }

    const serialized = JSON.stringify(changes);
    if (snapshot?.changes !== serialized) {
        await env.DB.prepare(
            `INSERT INTO timetable_snapshots (user_id, date, changes, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
             ON CONFLICT(user_id, date) DO UPDATE SET changes = excluded.changes, updated_at = CURRENT_TIMESTAMP`
        )
            .bind(userId, date, serialized)
            .run();
    }
}

async function remindScan(
    env: Bindings,
    userId: number,
    subs: SubscriptionRow[],
    portal: ReturnType<typeof portalSession>,
    scan: NonNullable<TimetableCheckJob['scan']>
) {
    const user = await env.DB.prepare('SELECT student_id FROM users WHERE id = ?').bind(userId).first<{ student_id: string }>();
    if (!user?.student_id) return;
    const scanIns = await portal.get(`https://api.sbhs.net.au/api/core/students/${encodeURIComponent(user.student_id)}/attendance/scan-ins`);
    if (!scanIns || scannedOn(scanIns, scan.date)) return;

    // At most one reminder per student per day, even if the queue redelivers this message.
    const claimed = await env.DB.prepare('INSERT OR IGNORE INTO scan_reminders (user_id, date) VALUES (?, ?)').bind(userId, scan.date).run();
    if (!claimed.meta.changes) return;
    await pushToDevices(
        env,
        subs,
        { title: `You have not scanned on as of ${scan.time}`, body: '', url: `/timetable?date=${scan.date}#day`, tag: `scan-${scan.date}` },
        { ttl: 2 * 60 * 60, urgency: 'high', topic: `scan-${scan.date}` }
    );
}
