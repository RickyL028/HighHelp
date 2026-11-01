import { env, fetchMock } from 'cloudflare:test';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { heldAccessToken, openToken, sealToken, storePortalTokens } from '../src/portalTokens';
import { b64urlEncode } from '../src/webPush';

const testEnv = { ...env, TOKEN_ENC_KEY: b64urlEncode(crypto.getRandomValues(new Uint8Array(32))) } as any;
const USER = 7;

// A stand-in for student.sbhs.net.au/api/token that rotates refresh tokens on every use.
let validRefresh = new Set<string>();
let issued = 0;
function mockTokenEndpoint(onRequest?: () => void) {
	return fetchMock
		.get('https://student.sbhs.net.au')
		.intercept({ path: '/api/token', method: 'POST' })
		.reply((opts) => {
			onRequest?.();
			const token = new URLSearchParams(String(opts.body)).get('refresh_token') ?? '';
			if (!validRefresh.delete(token)) return { statusCode: 400, data: { error: 'invalid_grant' } };
			issued++;
			validRefresh.add(`R${issued}`);
			return { statusCode: 200, data: { access_token: `A${issued}`, refresh_token: `R${issued}`, expires_in: 3600 } };
		});
}

async function row() {
	return env.DB.prepare('SELECT * FROM portal_tokens WHERE user_id = ?').bind(USER).first<any>();
}

beforeAll(() => {
	fetchMock.activate();
	fetchMock.disableNetConnect();
});

beforeEach(async () => {
	await env.DB.prepare('DROP TABLE IF EXISTS portal_tokens').run();
	await env.DB.prepare(
		`CREATE TABLE portal_tokens (user_id INTEGER PRIMARY KEY, client TEXT NOT NULL, refresh_token TEXT NOT NULL, access_token TEXT,
		 access_expires_at INTEGER, version INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'active', updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`
	).run();
	validRefresh = new Set(['R0']);
	issued = 0;
});

afterEach(() => fetchMock.assertNoPendingInterceptors());

describe('token encryption at rest', () => {
	it('round-trips, and binds each ciphertext to its user and field', async () => {
		const sealed = await sealToken(testEnv, USER, 'refresh', 'secret-token');
		expect(sealed).not.toContain('secret-token');
		expect(sealed).not.toBe(await sealToken(testEnv, USER, 'refresh', 'secret-token'));
		expect(await openToken(testEnv, USER, 'refresh', sealed)).toBe('secret-token');

		await expect(openToken(testEnv, USER + 1, 'refresh', sealed)).rejects.toThrow();
		await expect(openToken(testEnv, USER, 'access', sealed)).rejects.toThrow();
		const otherKey = { ...testEnv, TOKEN_ENC_KEY: b64urlEncode(crypto.getRandomValues(new Uint8Array(32))) };
		await expect(openToken(otherKey, USER, 'refresh', sealed)).rejects.toThrow();
	});

	it('refuses to run without a proper key', async () => {
		await expect(sealToken({ ...testEnv, TOKEN_ENC_KEY: undefined }, USER, 'access', 'x')).rejects.toThrow('not set');
		await expect(sealToken({ ...testEnv, TOKEN_ENC_KEY: 'c2hvcnQ' }, USER, 'access', 'x')).rejects.toThrow('32 bytes');
	});
});

describe('heldAccessToken', () => {
	it('returns none when alerts were never switched on', async () => {
		expect(await heldAccessToken(testEnv, USER)).toEqual({ status: 'none' });
	});

	it('reuses a cached access token without calling the portal', async () => {
		await storePortalTokens(testEnv, USER, 'basic', { accessToken: 'A0', refreshToken: 'R0', expiresIn: 3600 });
		const stored = await row();
		expect(stored.refresh_token).not.toContain('R0');
		expect(stored.access_token).not.toContain('A0');

		expect(await heldAccessToken(testEnv, USER)).toEqual({ status: 'ok', accessToken: 'A0' });
	});

	it('refreshes when forced or near expiry, keeping the rotated token', async () => {
		await storePortalTokens(testEnv, USER, 'basic', { accessToken: 'A0', refreshToken: 'R0', expiresIn: 60 });
		mockTokenEndpoint().times(2);

		expect(await heldAccessToken(testEnv, USER)).toEqual({ status: 'ok', accessToken: 'A1', refreshToken: 'R1' });
		expect(await heldAccessToken(testEnv, USER, true)).toEqual({ status: 'ok', accessToken: 'A2', refreshToken: 'R2' });
		const stored = await row();
		expect(await openToken(testEnv, USER, 'refresh', stored.refresh_token)).toBe('R2');
		expect(stored.version).toBe(3);
	});

	it('marks the token dead once when the portal refuses it', async () => {
		await storePortalTokens(testEnv, USER, 'basic', { accessToken: 'A0', refreshToken: 'expired', expiresIn: 3600 });
		mockTokenEndpoint();

		expect(await heldAccessToken(testEnv, USER, true)).toEqual({ status: 'revoked' });
		expect((await row()).status).toBe('dead');
		expect((await row()).access_token).toBeNull();
		expect(await heldAccessToken(testEnv, USER)).toEqual({ status: 'dead' });

		// A fresh login revives it.
		await storePortalTokens(testEnv, USER, 'basic', { accessToken: 'A9', refreshToken: 'R9', expiresIn: 3600 });
		expect(await heldAccessToken(testEnv, USER)).toEqual({ status: 'ok', accessToken: 'A9' });
	});

	it('uses the token another refresh just rotated in, instead of marking it dead', async () => {
		await storePortalTokens(testEnv, USER, 'basic', { accessToken: 'A0', refreshToken: 'R0', expiresIn: 3600 });
		// While our request is in flight, another refresh (say the browser's) uses R0 first and stores R5.
		let other: Promise<void> | undefined;
		mockTokenEndpoint(() => {
			validRefresh.delete('R0');
			other = storePortalTokens(testEnv, USER, 'basic', { accessToken: 'A5', refreshToken: 'R5', expiresIn: 3600 });
		}).delay(100);

		const result = await heldAccessToken(testEnv, USER, true);
		await other;
		expect(result).toEqual({ status: 'ok', accessToken: 'A5' });
		expect((await row()).status).toBe('active');
	});
});
