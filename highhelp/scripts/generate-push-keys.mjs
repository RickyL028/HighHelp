// Generates the three secrets timetable change alerts need (see src/timetablePush.ts) and prints them
// in .dev.vars format. Nothing is written to disk and nothing leaves this machine.
//
//   Local dev:   node scripts/generate-push-keys.mjs >> .dev.vars
//   Production:  run it again (use different keys from local) and paste each value into
//                npx wrangler secret put VAPID_PUBLIC_KEY
//                npx wrangler secret put VAPID_PRIVATE_KEY
//                npx wrangler secret put TOKEN_ENC_KEY
//
// Never commit these. Changing VAPID_* later means every device has to switch alerts on again, and
// changing TOKEN_ENC_KEY makes held portal tokens unreadable (those students have to log in again).

const b64url = (bytes) => Buffer.from(bytes).toString('base64url');

const vapid = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const publicKey = b64url(new Uint8Array(await crypto.subtle.exportKey('raw', vapid.publicKey)));
const { d: privateKey } = await crypto.subtle.exportKey('jwk', vapid.privateKey);
const tokenKey = b64url(crypto.getRandomValues(new Uint8Array(32)));

console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log(`TOKEN_ENC_KEY=${tokenKey}`);
