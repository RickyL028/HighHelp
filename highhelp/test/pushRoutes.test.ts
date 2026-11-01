import { createExecutionContext, env, fetchMock, waitOnExecutionContext } from 'cloudflare:test';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import pushRoutes from '../src/routes/push';
import authRoutes from '../src/routes/auth';
import { openToken } from '../src/portalTokens';
import { createSessionCookie } from '../src/utils';
import { b64urlEncode } from '../src/webPush';

const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/r1';
let testEnv: any;
let subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
let pushes = 0;
const realFetch = globalThis.fetch;

async function request(
	path: string,
	opts: { body?: unknown; session?: number; refreshCookie?: string; contentType?: string; app?: typeof pushRoutes } = {}
) {
	const cookies = [];
	if (opts.session) cookies.push(`user_id=${await createSessionCookie(opts.session, testEnv.SESSION_SECRET)}`);
	if (opts.refreshCookie) cookies.push(`sbhs_refresh_token=${opts.refreshCookie}`);
	const ctx = createExecutionContext();
	const res = await (opts.app ?? pushRoutes).request(
		`https://highhelp.sbhs27.workers.dev${path}`,
		{
			method: opts.body === undefined ? 'GET' : 'POST',
			headers: { cookie: cookies.join('; '), 'content-type': opts.contentType ?? 'application/json' },
			body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
		},
		testEnv,
		ctx
	);
	await waitOnExecutionContext(ctx);
	return res;
}

function mockPortal(refreshToken: string, studentId: string) {
	const portal = fetchMock.get('https://student.sbhs.net.au');
	portal
		.intercept({ path: '/api/token', method: 'POST' })
		.reply((opts) =>
			new URLSearchParams(String(opts.body)).get('refresh_token') === refreshToken
				? { statusCode: 200, data: { access_token: 'A1', refresh_token: 'R1', expires_in: 3600 } }
				: { statusCode: 400, data: { error: 'invalid_grant' } }
		);
	portal.intercept({ path: '/api/details/userinfo.json', method: 'GET', headers: { Authorization: 'Bearer A1' } }).reply(200, { studentId });
}

const heldTokens = () => env.DB.prepare('SELECT * FROM portal_tokens WHERE user_id = 1').first<any>();
const devices = async () => (await env.DB.prepare('SELECT COUNT(*) AS n FROM push_subscriptions').first<{ n: number }>())!.n;

beforeAll(() => {
	fetchMock.activate();
	fetchMock.disableNetConnect();
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = input instanceof Request ? input.url : String(input);
		if (url !== ENDPOINT) return realFetch(input, init);
		pushes++;
		return new Response(null, { status: 201 });
	}) as typeof fetch;
});

afterAll(() => {
	globalThis.fetch = realFetch;
});

beforeEach(async () => {
	await env.DB.batch(['users', 'push_subscriptions', 'portal_tokens', 'timetable_snapshots'].map((t) => env.DB.prepare(`DROP TABLE IF EXISTS ${t}`)));
	await env.DB.batch([
		env.DB.prepare('CREATE TABLE users (id INTEGER PRIMARY KEY, student_id TEXT NOT NULL, permission_level INTEGER DEFAULT 0)'),
		env.DB.prepare("INSERT INTO users (id, student_id, permission_level) VALUES (1, '441234567', 0), (2, '449999999', -2)"),
		env.DB.prepare(
			'CREATE TABLE push_subscriptions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, endpoint TEXT NOT NULL UNIQUE, p256dh TEXT NOT NULL, auth TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)'
		),
		env.DB.prepare(
			`CREATE TABLE portal_tokens (user_id INTEGER PRIMARY KEY, client TEXT NOT NULL, refresh_token TEXT NOT NULL, access_token TEXT,
			 access_expires_at INTEGER, version INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'active', updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`
		),
		env.DB.prepare(
			'CREATE TABLE timetable_snapshots (user_id INTEGER NOT NULL, date TEXT NOT NULL, changes TEXT NOT NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, date))'
		),
	]);

	const vapid = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
	testEnv = {
		...env,
		SESSION_SECRET: 'test-session-secret',
		VAPID_PUBLIC_KEY: b64urlEncode((await crypto.subtle.exportKey('raw', vapid.publicKey)) as ArrayBuffer),
		VAPID_PRIVATE_KEY: (await crypto.subtle.exportKey('jwk', vapid.privateKey)).d!,
		TOKEN_ENC_KEY: b64urlEncode(crypto.getRandomValues(new Uint8Array(32))),
	};
	const ua = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
	subscription = {
		endpoint: ENDPOINT,
		keys: {
			p256dh: b64urlEncode((await crypto.subtle.exportKey('raw', ua.publicKey)) as ArrayBuffer),
			auth: b64urlEncode(crypto.getRandomValues(new Uint8Array(16))),
		},
	};
	pushes = 0;
});

afterEach(() => fetchMock.assertNoPendingInterceptors());

describe('/api/auth/push/key', () => {
	it('serves only the public key, and 503 when push is not configured', async () => {
		const res = await request('/api/auth/push/key');
		expect(await res.json()).toEqual({ publicKey: testEnv.VAPID_PUBLIC_KEY });

		testEnv.TOKEN_ENC_KEY = undefined;
		expect((await request('/api/auth/push/key')).status).toBe(503);
	});
});

describe('/api/auth/push/subscribe', () => {
	it('takes custody of the portal token when it belongs to the logged-in student', async () => {
		mockPortal('R0', '441234567');
		const res = await request('/api/auth/push/subscribe', { body: { subscription }, session: 1, refreshCookie: 'R0' });
		expect(res.status).toBe(200);
		// The rotated token goes back to the browser too.
		expect(res.headers.get('set-cookie')).toContain('sbhs_refresh_token=R1');

		const held = await heldTokens();
		expect(held.refresh_token).not.toContain('R1');
		expect(await openToken(testEnv, 1, 'refresh', held.refresh_token)).toBe('R1');
		expect(await devices()).toBe(1);
		expect(pushes).toBe(1); // the "alerts are on" confirmation

		// Visiting again re-syncs without touching the portal or re-confirming.
		expect((await request('/api/auth/push/subscribe', { body: { subscription }, session: 1 })).status).toBe(200);
		expect(pushes).toBe(1);
	});

	it("refuses another student's portal cookie (shared computer)", async () => {
		mockPortal('R0', '440000000');
		const res = await request('/api/auth/push/subscribe', { body: { subscription }, session: 1, refreshCookie: 'R0' });
		expect(res.status).toBe(409);
		expect(await heldTokens()).toBeNull();
		expect(await devices()).toBe(0);
	});

	it('asks for a fresh login when there is no usable portal cookie', async () => {
		expect((await request('/api/auth/push/subscribe', { body: { subscription }, session: 1 })).status).toBe(409);
		fetchMock
			.get('https://student.sbhs.net.au')
			.intercept({ path: '/api/token', method: 'POST' })
			.reply(400, { error: 'invalid_grant' });
		expect((await request('/api/auth/push/subscribe', { body: { subscription }, session: 1, refreshCookie: 'stale' })).status).toBe(409);
		expect(await heldTokens()).toBeNull();
	});

	it('rejects missing sessions, banned users, non-JSON bodies and foreign endpoints', async () => {
		expect((await request('/api/auth/push/subscribe', { body: { subscription } })).status).toBe(401);
		expect((await request('/api/auth/push/subscribe', { body: { subscription }, session: 2, refreshCookie: 'R0' })).status).toBe(401);
		expect((await request('/api/auth/push/subscribe', { body: { subscription }, session: 1, contentType: 'text/plain' })).status).toBe(400);
		const foreign = { ...subscription, endpoint: 'https://student.sbhs.net.au/api/token' };
		expect((await request('/api/auth/push/subscribe', { body: { subscription: foreign }, session: 1 })).status).toBe(400);
		expect(await devices()).toBe(0);
	});
});

describe('/api/auth/push/unsubscribe', () => {
	it('drops held tokens with the last device, returning the latest refresh token to its owner', async () => {
		mockPortal('R0', '441234567');
		await request('/api/auth/push/subscribe', { body: { subscription }, session: 1, refreshCookie: 'R0' });

		const res = await request('/api/auth/push/unsubscribe', { body: { endpoint: ENDPOINT }, session: 1 });
		expect(res.status).toBe(200);
		expect(res.headers.get('set-cookie')).toContain('sbhs_refresh_token=R1');
		expect(await devices()).toBe(0);
		expect(await heldTokens()).toBeNull();
	});

	it('works by endpoint alone (logout), without handing out tokens', async () => {
		mockPortal('R0', '441234567');
		await request('/api/auth/push/subscribe', { body: { subscription }, session: 1, refreshCookie: 'R0' });

		const res = await request('/api/auth/push/unsubscribe', { body: { endpoint: ENDPOINT } });
		expect(res.status).toBe(200);
		expect(res.headers.get('set-cookie')).toBeNull();
		expect(await heldTokens()).toBeNull();
	});
});

describe('/api/auth/refresh', () => {
	it('still refreshes from the cookie for students without alerts', async () => {
		fetchMock
			.get('https://student.sbhs.net.au')
			.intercept({ path: '/api/token', method: 'POST', body: (b) => new URLSearchParams(b).get('refresh_token') === 'C0' })
			.reply(200, { access_token: 'AC', refresh_token: 'C1' });
		const res = await request('/api/auth/refresh', { app: authRoutes as any, session: 1, refreshCookie: 'C0' });
		expect(await res.json()).toEqual({ success: true, accessToken: 'AC' });
		expect(res.headers.get('set-cookie')).toContain('sbhs_refresh_token=C1');
	});

	it('uses the held token for students with alerts, even if the cookie went stale', async () => {
		mockPortal('R0', '441234567');
		await request('/api/auth/push/subscribe', { body: { subscription }, session: 1, refreshCookie: 'R0' });

		fetchMock
			.get('https://student.sbhs.net.au')
			.intercept({ path: '/api/token', method: 'POST', body: (b) => new URLSearchParams(b).get('refresh_token') === 'R1' })
			.reply(200, { access_token: 'A2', refresh_token: 'R2' });
		const res = await request('/api/auth/refresh', { app: authRoutes as any, session: 1, refreshCookie: 'stale' });
		expect(await res.json()).toEqual({ success: true, accessToken: 'A2' });
		expect(res.headers.get('set-cookie')).toContain('sbhs_refresh_token=R2');
	});

	it('never hands out a held token without the portal cookie', async () => {
		mockPortal('R0', '441234567');
		await request('/api/auth/push/subscribe', { body: { subscription }, session: 1, refreshCookie: 'R0' });
		const res = await request('/api/auth/refresh', { app: authRoutes as any, session: 1 });
		expect(res.status).toBe(401);
	});
});
