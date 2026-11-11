import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanSubscription, encrypt, vapid, sendPush, addDevice, fromBase64Url, toBase64Url, replyNote, journalNote, MAX_DEVICES } from '../push.mjs';

const ECDH = { name: 'ECDH', namedCurve: 'P-256' };

// A browser: its key pair, auth secret and subscription.
async function browser(endpoint = 'https://fcm.googleapis.com/fcm/send/abc') {
  const keys = await crypto.subtle.generateKey(ECDH, true, ['deriveBits']);
  const auth = crypto.getRandomValues(new Uint8Array(16));
  const p256dh = new Uint8Array(await crypto.subtle.exportKey('raw', keys.publicKey));
  return { keys, auth, p256dh, subscription: { endpoint, keys: { p256dh: toBase64Url(p256dh), auth: toBase64Url(auth) } } };
}

async function hmac(key, data) {
  const imported = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', imported, data));
}

// What the browser does with an aes128gcm body.
async function decrypt(device, body) {
  const salt = body.slice(0, 16), idLength = body[20], sender = body.slice(21, 21 + idLength), sealed = body.slice(21 + idLength);
  const senderKey = await crypto.subtle.importKey('raw', sender, ECDH, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: senderKey }, device.keys.privateKey, 256));
  const info = new Uint8Array([...new TextEncoder().encode('WebPush: info\0'), ...device.p256dh, ...sender, 1]);
  const prk = await hmac(salt, await hmac(await hmac(device.auth, shared), info));
  const cek = (await hmac(prk, new TextEncoder().encode('Content-Encoding: aes128gcm\0\x01'))).slice(0, 16);
  const nonce = (await hmac(prk, new TextEncoder().encode('Content-Encoding: nonce\0\x01'))).slice(0, 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, sealed));
  assert.equal(plain.at(-1), 2);
  return new TextDecoder().decode(plain.slice(0, -1));
}

async function vapidKeys() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  return { pair, VAPID_PUBLIC_KEY: toBase64Url(await crypto.subtle.exportKey('raw', pair.publicKey)), VAPID_PRIVATE_KEY: (await crypto.subtle.exportKey('jwk', pair.privateKey)).d };
}

test('push: only real push services and well-formed keys are accepted', async () => {
  const { subscription } = await browser();
  assert.deepEqual(cleanSubscription(subscription), subscription);
  for (const endpoint of ['https://web.push.apple.com/Q', 'https://updates.push.services.mozilla.com/wpush/v2/x', 'https://wns2-par02p.notify.windows.com/w/?token=1'])
    assert.ok(cleanSubscription({ ...subscription, endpoint }), endpoint);
  for (const endpoint of ['http://fcm.googleapis.com/x', 'https://evil.example/x', 'https://fcm.googleapis.com:8443/x', 'https://fcm.googleapis.com.evil.example/x', 'not a url'])
    assert.equal(cleanSubscription({ ...subscription, endpoint }), null, endpoint);
  assert.equal(cleanSubscription({ ...subscription, keys: { ...subscription.keys, auth: 'short' } }), null);
  assert.equal(cleanSubscription(null), null);
});

test('push: the browser can open the sealed message', async () => {
  const device = await browser();
  const note = JSON.stringify(replyNote('Hello friend! The waves were huge today.'));
  assert.equal(await decrypt(device, await encrypt(device.subscription, note)), note);
});

test('push: the VAPID token is signed for the push service', async () => {
  const keys = await vapidKeys(), now = Date.UTC(2026, 10, 11);
  const header = await vapid('https://fcm.googleapis.com/fcm/send/abc', keys.VAPID_PUBLIC_KEY, keys.VAPID_PRIVATE_KEY, now);
  const [, token, k] = header.match(/^vapid t=([^,]+), k=(.+)$/);
  assert.equal(k, keys.VAPID_PUBLIC_KEY);
  const [head, claims, signature] = token.split('.');
  assert.deepEqual(JSON.parse(new TextDecoder().decode(fromBase64Url(claims))), { aud: 'https://fcm.googleapis.com', exp: now / 1000 + 12 * 3600, sub: 'https://containedevolution.com' });
  assert.ok(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, keys.pair.publicKey, fromBase64Url(signature), new TextEncoder().encode(`${head}.${claims}`)));
});

test('push: sending posts an encrypted body with the push headers', async () => {
  const device = await browser(), keys = await vapidKeys(), calls = [];
  const status = await sendPush(keys, device.subscription, journalNote({ title: 'Rain day', text: 'I stayed in the cave.' }), async (url, init) => { calls.push({ url, init }); return new Response(null, { status: 201 }); });
  assert.equal(status, 201);
  assert.equal(calls[0].url, device.subscription.endpoint);
  assert.equal(calls[0].init.headers['content-encoding'], 'aes128gcm');
  assert.deepEqual(JSON.parse(await decrypt(device, calls[0].init.body)), { title: 'Patch wrote in his journal', body: 'Rain day: I stayed in the cave.', url: '/patch/journal.html', tag: 'patch-journal' });
});

test('push: an account keeps its newest devices and refreshes a known one', async () => {
  let devices = [];
  for (let i = 0; i < MAX_DEVICES + 2; i++) devices = addDevice(devices, { endpoint: `https://fcm.googleapis.com/${i}`, keys: {} }, { letters: true }, i);
  assert.equal(devices.length, MAX_DEVICES);
  assert.equal(devices[0].endpoint, 'https://fcm.googleapis.com/2');
  devices = addDevice(devices, { endpoint: 'https://fcm.googleapis.com/3', keys: {} }, { journal: true, letters: 'yes' }, 99);
  assert.equal(devices.length, MAX_DEVICES);
  assert.deepEqual(devices.at(-1), { endpoint: 'https://fcm.googleapis.com/3', keys: {}, letters: false, journal: true, at: 99 });
  assert.equal(replyNote('x'.repeat(300)).body.length, 140);
});
