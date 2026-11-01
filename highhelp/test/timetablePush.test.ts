import { env, fetchMock } from 'cloudflare:test';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { storePortalTokens } from '../src/portalTokens';
import { TIMETABLE_PUSH_QUEUE, processTimetableCheckBatch, scheduleTimetableChecks } from '../src/timetablePush';
import { b64urlDecode, b64urlEncode } from '../src/webPush';

const USER = 3;
const DATE = '2026-11-02';

async function vapid() {
	const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
	return {
		VAPID_PUBLIC_KEY: b64urlEncode((await crypto.subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer),
		VAPID_PRIVATE_KEY: (await crypto.subtle.exportKey('jwk', pair.privateKey)).d!,
	};
}

// A browser's side of a push subscription, able to decrypt what the push service would deliver.
async function device() {
	const pair = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
	const pub = new Uint8Array((await crypto.subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer);
	const auth = crypto.getRandomValues(new Uint8Array(16));
	async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: string | Uint8Array, bytes: number) {
		const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
		const infoBytes = typeof info === 'string' ? new TextEncoder().encode(info) : info;
		return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: infoBytes }, key, bytes * 8));
	}
	return {
		p256dh: b64urlEncode(pub),
		auth: b64urlEncode(auth),
		async decrypt(body: Uint8Array): Promise<any> {
			const salt = body.slice(0, 16);
			const serverPub = body.slice(21, 21 + body[20]);
			const serverKey = await crypto.subtle.importKey('raw', serverPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
			const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: serverKey } as any, pair.privateKey, 256));
			const info = new Uint8Array([...new TextEncoder().encode('WebPush: info\0'), ...pub, ...serverPub]);
			const ikm = await hkdf(auth, ecdh, info, 32);
			const cek = await hkdf(salt, ikm, 'Content-Encoding: aes128gcm\0', 16);
			const nonce = await hkdf(salt, ikm, 'Content-Encoding: nonce\0', 12);
			const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
			const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, body.slice(21 + body[20])));
			expect(plain[plain.length - 1]).toBe(2);
			return JSON.parse(new TextDecoder().decode(plain.slice(0, -1)));
		},
	};
}

const dayWithSub = {
	status: 'OK',
	timetable: { timetable: { periods: { '3': { title: 'PHY', room: '402' } } } },
	classVariations: { '3': { type: 'replacement', casualSurname: 'Smith' } },
	roomVariations: {},
};

function mockDay(data: unknown, status = 200) {
	fetchMock
		.get('https://student.sbhs.net.au')
		.intercept({ path: `/api/timetable/daytimetable.json?date=${DATE}`, method: 'GET', headers: { Authorization: 'Bearer A0' } })
		.reply(status, data as any);
}

// Push requests are caught by a fetch stub rather than fetchMock, which turns binary bodies into strings.
let pushed: { headers: Headers; body: Uint8Array }[] = [];
let pushStatus: number | null = null;
const realFetch = globalThis.fetch;
function mockPushService(status = 201) {
	pushStatus = status;
}

function batch(userIds: number[]) {
	let acked = 0;
	const messages = [{ body: { userIds, date: DATE, label: 'today' as const }, ack: () => acked++, retry: () => {} }];
	return { batch: { queue: TIMETABLE_PUSH_QUEUE, messages } as any, acked: () => acked };
}

let testEnv: any;
let dev: Awaited<ReturnType<typeof device>>;

beforeAll(() => {
	fetchMock.activate();
	fetchMock.disableNetConnect();
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = input instanceof Request ? input.url : String(input);
		if (!url.startsWith('https://fcm.googleapis.com/fcm/send/dev1')) return realFetch(input, init);
		pushed.push({ headers: new Headers(init?.headers), body: new Uint8Array(init?.body as Uint8Array) });
		if (pushStatus === null) throw new Error('Unexpected push');
		const status = pushStatus;
		pushStatus = null;
		return new Response(null, { status });
	}) as typeof fetch;
});

afterAll(() => {
	globalThis.fetch = realFetch;
});

beforeEach(async () => {
	await env.DB.batch(
		['push_subscriptions', 'portal_tokens', 'timetable_snapshots'].map((t) => env.DB.prepare(`DROP TABLE IF EXISTS ${t}`))
	);
	await env.DB.batch([
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
	testEnv = { ...env, ...(await vapid()), TOKEN_ENC_KEY: b64urlEncode(crypto.getRandomValues(new Uint8Array(32))) };
	dev = await device();
	await storePortalTokens(testEnv, USER, 'basic', { accessToken: 'A0', refreshToken: 'R0', expiresIn: 3600 });
	await env.DB.prepare('INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)')
		.bind(USER, 'https://fcm.googleapis.com/fcm/send/dev1', dev.p256dh, dev.auth)
		.run();
	pushed = [];
	pushStatus = null;
});

afterEach(() => {
	fetchMock.assertNoPendingInterceptors();
	expect(pushStatus).toBeNull(); // every expected push was sent
});

describe('timetable check consumer', () => {
	it('pushes a new change once, encrypted for the device', async () => {
		mockDay(dayWithSub);
		mockPushService();
		const first = batch([USER]);
		await processTimetableCheckBatch(first.batch, testEnv);
		expect(first.acked()).toBe(1);

		expect(pushed).toHaveLength(1);
		const [{ headers, body }] = pushed;
		expect(headers.get('content-encoding')).toBe('aes128gcm');
		expect(headers.get('authorization')).toMatch(/^vapid t=.+, k=/);
		expect(headers.get('topic')).toBe(`timetable-${DATE}`);
		expect(new TextDecoder().decode(body)).not.toContain('Smith');
		expect(await dev.decrypt(body)).toEqual({
			title: 'Timetable change today',
			body: 'P3 PHY: Sub: Smith',
			url: `/timetable?date=${DATE}#day`,
			tag: `timetable-${DATE}`,
		});

		// Same timetable on the next tick: nothing new to say.
		mockDay(dayWithSub);
		await processTimetableCheckBatch(batch([USER]).batch, testEnv);
		expect(pushed).toHaveLength(1);
	});

	it('deletes subscriptions the push service says are gone', async () => {
		mockDay(dayWithSub);
		mockPushService(410);
		await processTimetableCheckBatch(batch([USER]).batch, testEnv);
		const left = await env.DB.prepare('SELECT COUNT(*) AS n FROM push_subscriptions').first<{ n: number }>();
		expect(left?.n).toBe(0);
		// Not delivered anywhere, so the change isn't recorded as alerted.
		expect(await env.DB.prepare('SELECT * FROM timetable_snapshots').first()).toBeNull();
	});

	it('tells the student to log in again when their token is refused, then stops', async () => {
		await env.DB.prepare('UPDATE portal_tokens SET access_expires_at = 0').run();
		fetchMock.get('https://student.sbhs.net.au').intercept({ path: '/api/token', method: 'POST' }).reply(400, { error: 'invalid_grant' });
		mockPushService();
		await processTimetableCheckBatch(batch([USER]).batch, testEnv);

		expect(pushed).toHaveLength(1);
		expect((await dev.decrypt(pushed[0].body)).title).toBe('Timetable alerts paused');

		const queued: unknown[] = [];
		const monday830 = new Date('2026-11-01T21:30:00Z');
		await scheduleTimetableChecks({ ...testEnv, PUSH_QUEUE: { sendBatch: async (m: unknown[]) => queued.push(...m) } }, monday830);
		expect(queued).toEqual([]);
	});

	it('isolates one failing user from the rest of the chunk', async () => {
		mockDay({ error: 'boom' }, 500);
		const run = batch([USER, 999]);
		await processTimetableCheckBatch(run.batch, testEnv);
		expect(run.acked()).toBe(1);
		expect(pushed).toHaveLength(0);
	});
});

describe('scheduleTimetableChecks', () => {
	it('queues subscribed users with the planned date, and nothing outside hours or without keys', async () => {
		const queued: any[] = [];
		const queueEnv = { ...testEnv, PUSH_QUEUE: { sendBatch: async (m: unknown[]) => queued.push(...m) } };

		await scheduleTimetableChecks(queueEnv, new Date('2026-11-01T21:30:00Z')); // Mon 8:30am
		expect(queued).toEqual([{ body: { userIds: [USER], date: DATE, label: 'today' } }]);

		await scheduleTimetableChecks(queueEnv, new Date('2026-11-01T12:00:00Z')); // Sun 11pm
		await scheduleTimetableChecks({ ...queueEnv, TOKEN_ENC_KEY: undefined }, new Date('2026-11-01T21:30:00Z'));
		expect(queued).toHaveLength(1);
	});
});
