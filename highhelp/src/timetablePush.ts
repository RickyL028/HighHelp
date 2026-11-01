import { Bindings } from './types';
import { heldAccessToken } from './portalTokens';
import { addDays, extractChanges, formatChangeNotification, newChanges, parseSnapshot, planCheck, sydneyClock } from './timetableChanges';
import { PushOptions, PushTarget, VapidKeys, sendWebPush } from './webPush';

// Timetable change alerts. A cron tick every 15 minutes (wrangler.jsonc `triggers`) works out which
// date to check (planCheck) and queues every subscribed user in chunks. The queue consumer reads each
// user's day timetable with their held portal token (portalTokens.ts), compares it with the last
// alerted snapshot, and pushes any new subs, no-cover periods or room changes to all their devices.

export const TIMETABLE_PUSH_QUEUE = 'timetable-push-queue';
const USERS_PER_MESSAGE = 10;
const MAX_DEVICES_PER_USER = 10;

export interface TimetableCheckJob {
    userIds: number[];
    date: string;
    label: 'today' | 'tomorrow';
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
    // Once a night, around 3am.
    if (minutes >= 3 * 60 && minutes < 3 * 60 + 15) await sweepPushData(env, date);

    const plan = planCheck(now);
    if (!plan) return;
    if (!pushConfigured(env)) {
        console.warn('[timetable-push] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / TOKEN_ENC_KEY not set; skipping');
        return;
    }

    const { results } = await env.DB.prepare(
        "SELECT DISTINCT s.user_id FROM push_subscriptions s JOIN portal_tokens t ON t.user_id = s.user_id WHERE t.status = 'active'"
    ).all<{ user_id: number }>();
    const jobs: { body: TimetableCheckJob }[] = [];
    for (let i = 0; i < results.length; i += USERS_PER_MESSAGE) {
        jobs.push({ body: { userIds: results.slice(i, i + USERS_PER_MESSAGE).map((r) => r.user_id), ...plan } });
    }
    // sendBatch takes at most 100 messages.
    for (let i = 0; i < jobs.length; i += 100) await env.PUSH_QUEUE.sendBatch(jobs.slice(i, i + 100));
}

// Drops week-old snapshots, and held tokens of users with no devices left (e.g. every subscription
// expired), so tokens are only ever held for students actively receiving alerts.
async function sweepPushData(env: Bindings, today: string) {
    await env.DB.batch([
        env.DB.prepare('DELETE FROM timetable_snapshots WHERE date < ?').bind(addDays(today, -7)),
        env.DB.prepare('DELETE FROM portal_tokens WHERE user_id NOT IN (SELECT user_id FROM push_subscriptions)'),
        env.DB.prepare('DELETE FROM timetable_snapshots WHERE user_id NOT IN (SELECT user_id FROM push_subscriptions)'),
    ]);
}

// ---- Queue consumer ----

export async function processTimetableCheckBatch(batch: MessageBatch<TimetableCheckJob>, env: Bindings) {
    for (const message of batch.messages) {
        const { userIds, date, label } = message.body;
        // A failure for one user is logged and left for the next tick rather than retrying the whole chunk.
        const results = await Promise.allSettled(userIds.map((userId) => checkUser(env, userId, date, label)));
        results.forEach((r, i) => {
            if (r.status === 'rejected') console.error('[timetable-push] check failed', { userId: userIds[i], error: errorMessage(r.reason) });
        });
        message.ack();
    }
}

function fetchDay(accessToken: string, date: string) {
    return fetch(`https://student.sbhs.net.au/api/timetable/daytimetable.json?date=${date}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
}

async function checkUser(env: Bindings, userId: number, date: string, label: TimetableCheckJob['label']) {
    const subs = (await userDevices(env, userId)).results;
    if (subs.length === 0) return;

    let held = await heldAccessToken(env, userId);
    let res: Response | null = null;
    if (held.status === 'ok') {
        res = await fetchDay(held.accessToken, date);
        if (res.status === 401 || res.status === 403) {
            await res.body?.cancel();
            held = await heldAccessToken(env, userId, true);
            res = held.status === 'ok' ? await fetchDay(held.accessToken, date) : null;
        }
    }
    if (held.status === 'revoked') {
        await pushToDevices(env, subs, ALERTS_PAUSED, { ttl: 7 * 24 * 60 * 60, urgency: 'normal', topic: 'timetable-alerts' });
        return;
    }
    if (!res) return;
    if (!res.ok) {
        await res.body?.cancel();
        throw new Error(`daytimetable.json returned ${res.status}`);
    }

    const day: any = await res.json();
    if (day?.status && day.status !== 'OK') return;
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
            // Worthless once the day is over, and a newer alert for the same date replaces an undelivered one.
            { ttl: 12 * 60 * 60, urgency: 'high', topic: `timetable-${date}` }
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
