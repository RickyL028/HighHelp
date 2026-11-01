import { describe, expect, it } from 'vitest';
import {
	b64urlDecode,
	b64urlEncode,
	encryptPushPayload,
	importLocalKey,
	isAllowedPushEndpoint,
	parsePushSubscription,
	vapidAuthorization,
} from '../src/webPush';

// RFC 8291 Appendix A
const vector = {
	plaintext: 'V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24',
	asPublic: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
	asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
	uaPublic: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
	salt: 'DGv6ra1nlYgDCS1FRnbzlw',
	authSecret: 'BTBZMqHH6r4Tts7J_aSIgg',
	message:
		'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
};

async function newSubscriptionKeys() {
	const pair = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
	const pub = new Uint8Array((await crypto.subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer);
	return { pair, p256dh: b64urlEncode(pub), auth: b64urlEncode(crypto.getRandomValues(new Uint8Array(16))) };
}

describe('encryptPushPayload', () => {
	it('matches the RFC 8291 test vector', async () => {
		const out = await encryptPushPayload(
			b64urlDecode(vector.plaintext),
			{ p256dh: vector.uaPublic, auth: vector.authSecret },
			{ localKey: await importLocalKey(vector.asPrivate, vector.asPublic), salt: b64urlDecode(vector.salt) }
		);
		expect(b64urlEncode(out)).toBe(vector.message);
	});

	it('uses a fresh key and salt for every message', async () => {
		const { p256dh, auth } = await newSubscriptionKeys();
		const a = await encryptPushPayload(new TextEncoder().encode('hi'), { p256dh, auth });
		const b = await encryptPushPayload(new TextEncoder().encode('hi'), { p256dh, auth });
		expect(b64urlEncode(a.slice(0, 16))).not.toBe(b64urlEncode(b.slice(0, 16)));
		expect(b64urlEncode(a.slice(21, 86))).not.toBe(b64urlEncode(b.slice(21, 86)));
	});

	it('refuses payloads push services would reject', async () => {
		const { p256dh, auth } = await newSubscriptionKeys();
		await expect(encryptPushPayload(new Uint8Array(4000), { p256dh, auth })).rejects.toThrow('too large');
	});
});

describe('vapidAuthorization', () => {
	it('signs a JWT for the push service origin that verifies with the public key', async () => {
		const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
		const publicKey = b64urlEncode((await crypto.subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer);
		const privateKey = (await crypto.subtle.exportKey('jwk', pair.privateKey)).d!;
		const now = Date.UTC(2026, 9, 31);

		const value = await vapidAuthorization(
			'https://fcm.googleapis.com/fcm/send/abc',
			{ publicKey, privateKey, subject: 'https://highhelp.org' },
			now
		);
		const match = /^vapid t=([^,]+), k=(.+)$/.exec(value);
		expect(match).not.toBeNull();
		const [, jwt, k] = match!;
		expect(k).toBe(publicKey);

		const [header, claims, signature] = jwt.split('.');
		expect(JSON.parse(new TextDecoder().decode(b64urlDecode(header)))).toEqual({ typ: 'JWT', alg: 'ES256' });
		expect(JSON.parse(new TextDecoder().decode(b64urlDecode(claims)))).toEqual({
			aud: 'https://fcm.googleapis.com',
			exp: now / 1000 + 12 * 60 * 60,
			sub: 'https://highhelp.org',
		});
		const ok = await crypto.subtle.verify(
			{ name: 'ECDSA', hash: 'SHA-256' },
			pair.publicKey,
			b64urlDecode(signature),
			new TextEncoder().encode(`${header}.${claims}`)
		);
		expect(ok).toBe(true);
	});
});

describe('push subscription validation', () => {
	it('only accepts real push service endpoints', () => {
		expect(isAllowedPushEndpoint('https://fcm.googleapis.com/fcm/send/abc')).toBe(true);
		expect(isAllowedPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/abc')).toBe(true);
		expect(isAllowedPushEndpoint('https://web.push.apple.com/QGx')).toBe(true);
		expect(isAllowedPushEndpoint('https://wns2-sy3p.notify.windows.com/w/?token=abc')).toBe(true);

		expect(isAllowedPushEndpoint('http://fcm.googleapis.com/fcm/send/abc')).toBe(false);
		expect(isAllowedPushEndpoint('https://fcm.googleapis.com:8443/fcm/send/abc')).toBe(false);
		expect(isAllowedPushEndpoint('https://fcm.googleapis.com.evil.com/x')).toBe(false);
		expect(isAllowedPushEndpoint('https://evil.com/fcm.googleapis.com')).toBe(false);
		expect(isAllowedPushEndpoint('https://student.sbhs.net.au/api/token')).toBe(false);
		expect(isAllowedPushEndpoint('not a url')).toBe(false);
	});

	it('checks the encryption keys are the right shape', async () => {
		const { p256dh, auth } = await newSubscriptionKeys();
		const endpoint = 'https://fcm.googleapis.com/fcm/send/abc';
		expect(parsePushSubscription({ endpoint, keys: { p256dh, auth } })).toEqual({ endpoint, p256dh, auth });

		expect(parsePushSubscription(null)).toBeNull();
		expect(parsePushSubscription({ endpoint, keys: { p256dh } })).toBeNull();
		expect(parsePushSubscription({ endpoint, keys: { p256dh: auth, auth } })).toBeNull();
		expect(parsePushSubscription({ endpoint, keys: { p256dh, auth: p256dh } })).toBeNull();
		expect(parsePushSubscription({ endpoint, keys: { p256dh: '!!!', auth } })).toBeNull();
		expect(parsePushSubscription({ endpoint: 'https://evil.com/x', keys: { p256dh, auth } })).toBeNull();
	});
});
