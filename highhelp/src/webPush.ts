// Web Push sender built on WebCrypto, so it runs in the Worker without Node's crypto module.
// Payloads are encrypted with aes128gcm (RFC 8291) and each request is signed with a VAPID JWT
// (RFC 8292). The VAPID private key only ever lives in the VAPID_PRIVATE_KEY secret.

const encoder = new TextEncoder();

export function b64urlEncode(bytes: ArrayBuffer | Uint8Array): string {
    const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    let bin = '';
    for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Throws on input that isn't base64/base64url.
export function b64urlDecode(str: string): Uint8Array<ArrayBuffer> {
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    return Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
}

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let offset = 0;
    for (const p of parts) {
        out.set(p, offset);
        offset += p.length;
    }
    return out;
}

export interface VapidKeys {
    publicKey: string; // base64url uncompressed P-256 point (65 bytes)
    privateKey: string; // base64url P-256 private scalar (32 bytes)
    subject: string; // mailto: or https: contact for push services
}

export interface PushTarget {
    endpoint: string;
    p256dh: string;
    auth: string;
}

// The browser hands us an endpoint URL that we later POST to, so only accept the real push services.
// Anything else would let a user point the Worker at an arbitrary URL.
const PUSH_SERVICE_HOSTS = [
    /^fcm\.googleapis\.com$/, // Chrome, Edge on Android, Samsung Internet, Opera
    /^updates\.push\.services\.mozilla\.com$/, // Firefox
    /^web\.push\.apple\.com$/, // Safari, iOS home-screen apps
    /^[a-z0-9-]+\.notify\.windows\.com$/, // Edge on Windows
];

export function isAllowedPushEndpoint(endpoint: string): boolean {
    if (endpoint.length > 1024) return false;
    try {
        const url = new URL(endpoint);
        return url.protocol === 'https:' && url.port === '' && PUSH_SERVICE_HOSTS.some((re) => re.test(url.hostname));
    } catch {
        return false;
    }
}

// Validates the JSON from PushSubscription.toJSON(). Returns null for anything malformed.
export function parsePushSubscription(input: unknown): PushTarget | null {
    if (!input || typeof input !== 'object') return null;
    const { endpoint, keys } = input as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
    if (typeof endpoint !== 'string' || !isAllowedPushEndpoint(endpoint)) return null;
    const p256dh = keys?.p256dh;
    const auth = keys?.auth;
    if (typeof p256dh !== 'string' || typeof auth !== 'string') return null;
    try {
        const pub = b64urlDecode(p256dh);
        if (pub.length !== 65 || pub[0] !== 0x04) return null;
        if (b64urlDecode(auth).length !== 16) return null;
    } catch {
        return null;
    }
    return { endpoint, p256dh, auth };
}

async function hkdf(salt: Uint8Array<ArrayBuffer>, ikm: Uint8Array<ArrayBuffer>, info: Uint8Array<ArrayBuffer>, bytes: number) {
    const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
    return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bytes * 8));
}

// Imports an EC private key from its raw scalar plus the public point it belongs to.
async function importP256Private(privateKey: string, publicPoint: Uint8Array, algorithm: 'ECDSA' | 'ECDH'): Promise<CryptoKey> {
    if (publicPoint.length !== 65 || publicPoint[0] !== 0x04) throw new Error('Expected an uncompressed P-256 public key');
    const jwk: JsonWebKey = {
        kty: 'EC',
        crv: 'P-256',
        x: b64urlEncode(publicPoint.slice(1, 33)),
        y: b64urlEncode(publicPoint.slice(33, 65)),
        d: privateKey,
    };
    return crypto.subtle.importKey('jwk', jwk, { name: algorithm, namedCurve: 'P-256' }, false, algorithm === 'ECDSA' ? ['sign'] : ['deriveBits']);
}

export interface LocalKey {
    privateKey: CryptoKey;
    publicKey: Uint8Array<ArrayBuffer>;
}

// Exposed for the RFC 8291 test vector, which fixes the server key pair and salt.
export async function importLocalKey(privateKey: string, publicKey: string): Promise<LocalKey> {
    const pub = b64urlDecode(publicKey);
    return { privateKey: await importP256Private(privateKey, pub, 'ECDH'), publicKey: pub };
}

const RECORD_SIZE = 4096;
// Push services cap the request body at 4096 bytes; the header and AEAD tag take 103 of them.
export const MAX_PAYLOAD_BYTES = 3900;

// aes128gcm content encoding (RFC 8188) with the Web Push key derivation (RFC 8291), as one record.
export async function encryptPushPayload(
    plaintext: Uint8Array,
    target: { p256dh: string; auth: string },
    fixed?: { localKey?: LocalKey; salt?: Uint8Array<ArrayBuffer> }
): Promise<Uint8Array> {
    if (plaintext.length > MAX_PAYLOAD_BYTES) throw new Error('Push payload too large');
    const uaPublic = b64urlDecode(target.p256dh);
    const authSecret = b64urlDecode(target.auth);

    let local = fixed?.localKey;
    if (!local) {
        const pair = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
        local = { privateKey: pair.privateKey, publicKey: new Uint8Array((await crypto.subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer) };
    }

    const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    // workers-types spells the field `$public`, but the runtime reads `public` (as the spec says).
    const ecdh = { name: 'ECDH', public: uaKey } as unknown as SubtleCryptoDeriveKeyAlgorithm;
    const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits(ecdh, local.privateKey, 256));

    const ikm = await hkdf(authSecret, ecdhSecret, concat(encoder.encode('WebPush: info\0'), uaPublic, local.publicKey), 32);
    const salt = fixed?.salt ?? new Uint8Array(16);
    if (!fixed?.salt) crypto.getRandomValues(salt);
    const cek = await hkdf(salt, ikm, concat(encoder.encode('Content-Encoding: aes128gcm\0')), 16);
    const nonce = await hkdf(salt, ikm, concat(encoder.encode('Content-Encoding: nonce\0')), 12);

    const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
    // 0x02 marks the last (and only) record, with no further padding.
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, concat(plaintext, Uint8Array.of(2)));

    const header = new Uint8Array(21 + local.publicKey.length);
    header.set(salt, 0);
    new DataView(header.buffer).setUint32(16, RECORD_SIZE);
    header[20] = local.publicKey.length;
    header.set(local.publicKey, 21);
    return concat(header, new Uint8Array(ciphertext));
}

let vapidKeyCache: { privateKey: string; key: Promise<CryptoKey> } | null = null;

function vapidSigningKey(keys: VapidKeys): Promise<CryptoKey> {
    if (vapidKeyCache?.privateKey !== keys.privateKey) {
        const key = importP256Private(keys.privateKey, b64urlDecode(keys.publicKey), 'ECDSA');
        // Don't cache a failed import (e.g. a mistyped secret) for the life of the isolate.
        key.catch(() => {
            if (vapidKeyCache?.key === key) vapidKeyCache = null;
        });
        vapidKeyCache = { privateKey: keys.privateKey, key };
    }
    return vapidKeyCache.key;
}

// The Authorization header value for one push service (the JWT audience is the endpoint's origin).
export async function vapidAuthorization(endpoint: string, keys: VapidKeys, now = Date.now()): Promise<string> {
    const header = b64urlEncode(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
    const claims = b64urlEncode(
        encoder.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 60 * 60, sub: keys.subject }))
    );
    const unsigned = `${header}.${claims}`;
    // WebCrypto ECDSA signatures are already the raw r||s form JWS ES256 expects.
    const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, await vapidSigningKey(keys), encoder.encode(unsigned));
    return `vapid t=${unsigned}.${b64urlEncode(signature)}, k=${keys.publicKey}`;
}

export interface PushOptions {
    ttl: number; // seconds the push service may hold the message for an offline device
    urgency?: 'very-low' | 'low' | 'normal' | 'high';
    topic?: string; // a newer message with the same topic replaces an undelivered older one
}

// Sends one message and returns the push service's status: 201 means accepted, while 404/410 mean
// the subscription is gone and should be deleted.
export async function sendWebPush(target: PushTarget, payload: string, keys: VapidKeys, options: PushOptions): Promise<number> {
    const body = await encryptPushPayload(encoder.encode(payload), target);
    const headers: Record<string, string> = {
        Authorization: await vapidAuthorization(target.endpoint, keys),
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: String(options.ttl),
        Urgency: options.urgency ?? 'normal',
    };
    if (options.topic) headers.Topic = options.topic;
    const res = await fetch(target.endpoint, { method: 'POST', headers, body });
    await res.body?.cancel();
    return res.status;
}
