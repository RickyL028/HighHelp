import { setCookie } from 'hono/cookie';
import { Bindings } from './types';
import { b64urlDecode, b64urlEncode } from './webPush';

// SBHS portal OAuth helpers, plus server-side custody of portal tokens for students who turned on
// timetable alerts, so the cron can read their day timetable while the app is closed.
//
// Held tokens are AES-256-GCM encrypted with TOKEN_ENC_KEY (a Worker secret), and each ciphertext is
// bound to its user and field, so a copied or swapped value fails to decrypt. They are deleted once the
// user has no push subscriptions left. Plaintext tokens are never logged or stored.

export type PortalClient = 'full' | 'basic';

const TOKEN_URL = 'https://student.sbhs.net.au/api/token';
export const REFRESH_COOKIE = 'sbhs_refresh_token';

function isLocalDev(env: Bindings): boolean {
    const flag: unknown = env.LOCAL_DEV;
    return flag === true || flag === 'true';
}

// highhelp.org is registered with the `_full` portal client; workers.dev and local dev use the plain one.
export function portalClient(c: any): PortalClient {
    const host = c.req.header('host') || '';
    return !isLocalDev(c.env) && host.includes('highhelp.org') ? 'full' : 'basic';
}

export function portalCredsFor(env: Bindings, client: PortalClient) {
    if (client === 'full') {
        return { clientId: env.PORTAL_API_CLIENT_ID_full, clientSecret: env.PORTAL_API_CLIENT_SECRET_full, redirectUri: env.APP_REDIRECT_URI_full };
    }
    return { clientId: env.PORTAL_API_CLIENT_ID, clientSecret: env.PORTAL_API_CLIENT_SECRET, redirectUri: env.APP_REDIRECT_URI };
}

export function setRefreshCookie(c: any, refreshToken: string) {
    setCookie(c, REFRESH_COOKIE, refreshToken, {
        path: '/api/auth', // Only send this cookie to auth endpoints
        httpOnly: true, // JavaScript cannot read this (prevents XSS theft)
        secure: !isLocalDev(c.env),
        maxAge: 60 * 60 * 24 * 90, // 90 Days
        sameSite: 'Lax',
    });
}

export interface PortalTokens {
    accessToken: string;
    refreshToken?: string; // only present when the portal rotated it
    expiresIn?: number;
}

export type RefreshResult = ({ ok: true } & PortalTokens) | { ok: false; rejected: boolean };

// `rejected` means the portal refused the refresh token itself (expired or revoked), as opposed to a
// network or server error worth retrying later. Network failures throw.
export async function requestTokenRefresh(env: Bindings, client: PortalClient, refreshToken: string): Promise<RefreshResult> {
    const { clientId, clientSecret } = portalCredsFor(env, client);
    const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: clientId,
            client_secret: clientSecret,
        }),
    });
    const data: any = await res.json().catch(() => null);
    if (res.ok && typeof data?.access_token === 'string') {
        return {
            ok: true,
            accessToken: data.access_token,
            refreshToken: typeof data.refresh_token === 'string' ? data.refresh_token : undefined,
            expiresIn: Number(data.expires_in) || undefined,
        };
    }
    return { ok: false, rejected: res.status === 400 || res.status === 401 };
}

// ---- Encryption at rest ----

type TokenField = 'refresh' | 'access';
const encoder = new TextEncoder();
let keyCache: { raw: string; key: Promise<CryptoKey> } | null = null;

function encryptionKey(env: Bindings): Promise<CryptoKey> {
    const raw = env.TOKEN_ENC_KEY;
    if (!raw) throw new Error('TOKEN_ENC_KEY is not set');
    if (keyCache?.raw !== raw) {
        let bytes: Uint8Array<ArrayBuffer>;
        try {
            bytes = b64urlDecode(raw);
        } catch {
            throw new Error('TOKEN_ENC_KEY must be base64url');
        }
        if (bytes.length !== 32) throw new Error('TOKEN_ENC_KEY must decode to 32 bytes');
        keyCache = { raw, key: crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']) };
    }
    return keyCache.key;
}

function additionalData(userId: number, field: TokenField) {
    return encoder.encode(`portal_tokens:${userId}:${field}`);
}

// Stored as `v1.<iv>.<ciphertext>`; the prefix leaves room to rotate the key format later.
export async function sealToken(env: Bindings, userId: number, field: TokenField, token: string): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv, additionalData: additionalData(userId, field) },
        await encryptionKey(env),
        encoder.encode(token)
    );
    return `v1.${b64urlEncode(iv)}.${b64urlEncode(ct)}`;
}

export async function openToken(env: Bindings, userId: number, field: TokenField, sealed: string): Promise<string> {
    const [version, iv, ct] = sealed.split('.');
    if (version !== 'v1' || !iv || !ct) throw new Error('Unrecognised token format');
    const plain = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: b64urlDecode(iv), additionalData: additionalData(userId, field) },
        await encryptionKey(env),
        b64urlDecode(ct)
    );
    return new TextDecoder().decode(plain);
}

// ---- Custody ----

// Access tokens without an expires_in are assumed to last as long as the client-side refresh interval.
const DEFAULT_ACCESS_TTL = 30 * 60;
// Refresh rather than hand out a cached access token this close to expiry.
const ACCESS_MIN_REMAINING = 2 * 60;

interface TokenRow {
    client: PortalClient;
    refresh_token: string;
    access_token: string | null;
    access_expires_at: number | null;
    version: number;
    status: 'active' | 'dead';
}

function loadRow(env: Bindings, userId: number) {
    return env.DB.prepare(
        'SELECT client, refresh_token, access_token, access_expires_at, version, status FROM portal_tokens WHERE user_id = ?'
    )
        .bind(userId)
        .first<TokenRow>();
}

function expiresAt(tokens: PortalTokens) {
    return Math.floor(Date.now() / 1000) + (tokens.expiresIn ?? DEFAULT_ACCESS_TTL);
}

// Takes custody of a user's tokens (alerts switched on), or replaces the held ones.
export async function storePortalTokens(env: Bindings, userId: number, client: PortalClient, tokens: PortalTokens & { refreshToken: string }) {
    await env.DB.prepare(
        `INSERT INTO portal_tokens (user_id, client, refresh_token, access_token, access_expires_at, version, status, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, 'active', CURRENT_TIMESTAMP)
         ON CONFLICT(user_id) DO UPDATE SET
            client = excluded.client,
            refresh_token = excluded.refresh_token,
            access_token = excluded.access_token,
            access_expires_at = excluded.access_expires_at,
            version = portal_tokens.version + 1,
            status = 'active',
            updated_at = CURRENT_TIMESTAMP`
    )
        .bind(
            userId,
            client,
            await sealToken(env, userId, 'refresh', tokens.refreshToken),
            await sealToken(env, userId, 'access', tokens.accessToken),
            expiresAt(tokens)
        )
        .run();
}

// A fresh portal login replaces held tokens (and revives paused alerts), but never starts custody:
// that only happens when the user switches alerts on.
export async function replaceHeldTokens(env: Bindings, userId: number, client: PortalClient, tokens: PortalTokens & { refreshToken: string }) {
    const held = await env.DB.prepare('SELECT 1 FROM portal_tokens WHERE user_id = ?').bind(userId).first();
    if (held) await storePortalTokens(env, userId, client, tokens);
}

export async function hasActiveTokens(env: Bindings, userId: number): Promise<boolean> {
    const row = await env.DB.prepare("SELECT 1 FROM portal_tokens WHERE user_id = ? AND status = 'active'").bind(userId).first();
    return !!row;
}

export async function heldRefreshToken(env: Bindings, userId: number): Promise<string | null> {
    const row = await loadRow(env, userId);
    return row && row.status === 'active' ? openToken(env, userId, 'refresh', row.refresh_token) : null;
}

export async function dropPortalTokens(env: Bindings, userId: number) {
    await env.DB.batch([
        env.DB.prepare('DELETE FROM portal_tokens WHERE user_id = ?').bind(userId),
        env.DB.prepare('DELETE FROM timetable_snapshots WHERE user_id = ?').bind(userId),
    ]);
}

export type HeldAccess =
    | { status: 'ok'; accessToken: string; refreshToken?: string } // refreshToken: the held one after a refresh
    | { status: 'none' } // not held (alerts never switched on)
    | { status: 'dead' } // held, but already marked unusable
    | { status: 'revoked' }; // the portal refused the refresh token just now; the row is now marked dead

// An access token for a user whose tokens we hold. Reuses the cached access token unless `force` is set
// or it is about to expire. The portal may rotate refresh tokens, so the browser (/api/auth/refresh) and
// the cron both go through here and the held copy is the only one kept current.
export async function heldAccessToken(env: Bindings, userId: number, force = false): Promise<HeldAccess> {
    return heldAccessTokenAttempt(env, userId, force, false);
}

async function heldAccessTokenAttempt(env: Bindings, userId: number, force: boolean, retried: boolean): Promise<HeldAccess> {
    const row = await loadRow(env, userId);
    if (!row) return { status: 'none' };
    if (row.status !== 'active') return { status: 'dead' };

    const now = Math.floor(Date.now() / 1000);
    if (!force && row.access_token && (row.access_expires_at ?? 0) - now > ACCESS_MIN_REMAINING) {
        return { status: 'ok', accessToken: await openToken(env, userId, 'access', row.access_token) };
    }

    const refreshToken = await openToken(env, userId, 'refresh', row.refresh_token);
    const result = await requestTokenRefresh(env, row.client, refreshToken);
    if (result.ok) {
        const nextRefresh = result.refreshToken ?? refreshToken;
        await env.DB.prepare(
            `UPDATE portal_tokens SET refresh_token = ?, access_token = ?, access_expires_at = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP
             WHERE user_id = ?`
        )
            .bind(
                await sealToken(env, userId, 'refresh', nextRefresh),
                await sealToken(env, userId, 'access', result.accessToken),
                expiresAt(result),
                userId
            )
            .run();
        return { status: 'ok', accessToken: result.accessToken, refreshToken: nextRefresh };
    }
    if (!result.rejected) throw new Error('Portal token refresh failed');

    // Another refresh may have rotated the token after we read it. If so, use what it stored.
    const latest = await loadRow(env, userId);
    if (!retried && latest && latest.status === 'active' && latest.version !== row.version) {
        return heldAccessTokenAttempt(env, userId, false, true);
    }
    const marked = await env.DB.prepare(
        "UPDATE portal_tokens SET status = 'dead', access_token = NULL, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND version = ?"
    )
        .bind(userId, row.version)
        .run();
    return marked.meta.changes > 0 ? { status: 'revoked' } : { status: 'dead' };
}
