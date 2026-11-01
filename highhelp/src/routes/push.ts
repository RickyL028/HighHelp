import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { Bindings } from '../types'
import { getSessionUserId } from '../utils'
import { PermissionLevel } from '../permissions'
import { parsePushSubscription } from '../webPush'
import {
    REFRESH_COOKIE,
    dropPortalTokens,
    hasActiveTokens,
    heldRefreshToken,
    portalClient,
    requestTokenRefresh,
    setRefreshCookie,
    storePortalTokens,
} from '../portalTokens'
import { PushMessage, pushConfigured, pushToDevices, trimDevices } from '../timetablePush'

// Turning timetable change alerts on and off (see src/timetablePush.ts). These live under /api/auth so
// the browser sends the httpOnly sbhs_refresh_token cookie (path /api/auth): switching alerts on is how
// a device hands its portal login to the server. That path also skips the global ban check, so it is
// repeated here.

const app = new Hono<{ Bindings: Bindings }>()

const ALERTS_ON: PushMessage = {
    title: 'Timetable alerts are on',
    body: "You'll get a notification here when a class has a sub, no cover or a room change.",
    url: '/timetable',
    tag: 'timetable-alerts',
}

async function sessionUser(c: any) {
    const userId = await getSessionUserId(c)
    if (!userId) return null
    const user: { id: number; student_id: string; permission_level: number } | null = await c.env.DB.prepare(
        'SELECT id, student_id, permission_level FROM users WHERE id = ?'
    )
        .bind(userId)
        .first()
    if (!user || user.permission_level === PermissionLevel.BANNED) return null
    return user
}

// JSON-only bodies force a CORS preflight, so other sites can't post here with the user's cookies.
async function jsonBody(c: any): Promise<any | null> {
    if (!(c.req.header('content-type') || '').includes('application/json')) return null
    return c.req.json().catch(() => null)
}

// Makes sure we hold a working portal token for this user, taking it from the browser's refresh cookie
// if not. The cookie belongs to whoever last logged in to the portal in this browser, which on a shared
// computer may be someone other than the HighHelp session's user, so it must match by student ID.
async function takeCustody(c: any, user: { id: number; student_id: string }): Promise<boolean> {
    if (await hasActiveTokens(c.env, user.id)) return true

    const cookieToken = getCookie(c, REFRESH_COOKIE)
    if (!cookieToken) return false

    const client = portalClient(c)
    const refreshed = await requestTokenRefresh(c.env, client, cookieToken)
    if (!refreshed.ok) return false

    const info = await fetch('https://student.sbhs.net.au/api/details/userinfo.json', {
        headers: { Authorization: `Bearer ${refreshed.accessToken}` },
    })
    const userData: any = await info.json().catch(() => null)
    if (!userData?.studentId || String(userData.studentId) !== String(user.student_id)) return false

    const refreshToken = refreshed.refreshToken ?? cookieToken
    await storePortalTokens(c.env, user.id, client, { ...refreshed, refreshToken })
    if (refreshed.refreshToken) setRefreshCookie(c, refreshed.refreshToken)
    return true
}

app.get('/api/auth/push/key', (c) => {
    if (!pushConfigured(c.env)) return c.json({ error: 'unavailable' }, 503)
    return c.json({ publicKey: c.env.VAPID_PUBLIC_KEY })
})

// Body: { subscription: PushSubscription.toJSON(), replaces?: oldEndpoint }. Idempotent: the timetable
// page re-sends its subscription on every visit, which also restores custody after a fresh login.
app.post('/api/auth/push/subscribe', async (c) => {
    if (!pushConfigured(c.env)) return c.json({ error: 'unavailable' }, 503)
    const user = await sessionUser(c)
    if (!user) return c.json({ error: 'login' }, 401)

    const body = await jsonBody(c)
    const sub = parsePushSubscription(body?.subscription)
    if (!sub) return c.json({ error: 'invalid' }, 400)

    try {
        if (!(await takeCustody(c, user))) return c.json({ error: 'reauth' }, 409)
    } catch (e: any) {
        console.error('[push] custody failed', e?.message)
        return c.json({ error: 'unavailable' }, 503)
    }

    const existing = await c.env.DB.prepare('SELECT user_id FROM push_subscriptions WHERE endpoint = ?')
        .bind(sub.endpoint)
        .first<{ user_id: number }>()
    const row = await c.env.DB.prepare(
        `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)
         ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth
         RETURNING id`
    )
        .bind(user.id, sub.endpoint, sub.p256dh, sub.auth)
        .first<{ id: number }>()

    if (typeof body.replaces === 'string' && body.replaces !== sub.endpoint) {
        await c.env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?').bind(body.replaces, user.id).run()
    }
    await trimDevices(c.env, user.id)

    if (row && existing?.user_id !== user.id) {
        c.executionCtx.waitUntil(pushToDevices(c.env, [{ id: row.id, ...sub }], ALERTS_ON, { ttl: 60 * 60, topic: 'timetable-alerts' }))
    }
    return c.json({ ok: true })
})

// Body: { endpoint }. The endpoint is an unguessable URL only that browser knows, so it is enough to
// remove it without a session (logout calls this after the session cookie is gone).
app.post('/api/auth/push/unsubscribe', async (c) => {
    const body = await jsonBody(c)
    const endpoint = typeof body?.endpoint === 'string' ? body.endpoint : null
    if (!endpoint) return c.json({ error: 'invalid' }, 400)

    const removed = await c.env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? RETURNING user_id')
        .bind(endpoint)
        .first<{ user_id: number }>()
    if (!removed) return c.json({ ok: true })

    const left = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM push_subscriptions WHERE user_id = ?')
        .bind(removed.user_id)
        .first<{ n: number }>()
    if (!left?.n) {
        // Last device: stop holding the user's tokens. The held refresh token may have been rotated past
        // the cookie's copy, so hand it back to its owner's browser first.
        if ((await getSessionUserId(c)) === removed.user_id) {
            try {
                const token = await heldRefreshToken(c.env, removed.user_id)
                if (token) setRefreshCookie(c, token)
            } catch (e: any) {
                console.error('[push] could not return held token', e?.message)
            }
        }
        await dropPortalTokens(c.env, removed.user_id)
    }
    return c.json({ ok: true })
})

export default app
