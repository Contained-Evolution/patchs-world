// Web Push: encrypt a message for one browser (RFC 8291) and sign the request with the VAPID key (RFC 8292).

const SUBJECT = 'https://containedevolution.com';
// Browsers' push services. Endpoints anywhere else are refused, so a subscription can't aim the Worker at another host.
const HOSTS = [/^fcm\.googleapis\.com$/, /^(updates\.)?push\.services\.mozilla\.com$/, /^web\.push\.apple\.com$/, /^[a-z0-9-]+\.notify\.windows\.com$/];
export const MAX_DEVICES = 5;

const text = value => new TextEncoder().encode(value);
const join = (...parts) => {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) { out.set(part, at); at += part.length; }
  return out;
};

export function fromBase64Url(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]*={0,2}$/.test(value)) return null;
  try { return Uint8Array.from(atob(value.replace(/=+$/, '').replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0)); } catch { return null; }
}

export function toBase64Url(bytes) {
  let binary = '';
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmac(key, data) {
  const imported = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', imported, data));
}

// A browser's subscription as { endpoint, keys: { p256dh, auth } }, or null when it isn't one.
export function cleanSubscription(value) {
  const endpoint = value?.endpoint, p256dh = fromBase64Url(value?.keys?.p256dh), auth = fromBase64Url(value?.keys?.auth);
  if (typeof endpoint !== 'string' || endpoint.length > 1024 || p256dh?.length !== 65 || p256dh[0] !== 4 || auth?.length !== 16) return null;
  let url;
  try { url = new URL(endpoint); } catch { return null; }
  if (url.protocol !== 'https:' || url.port || !HOSTS.some(host => host.test(url.hostname))) return null;
  return { endpoint: url.href, keys: { p256dh: value.keys.p256dh, auth: value.keys.auth } };
}

// The aes128gcm body for one subscription: salt, record size, the sender's public key, then the sealed message.
export async function encrypt(subscription, message) {
  const receiver = fromBase64Url(subscription.keys.p256dh), secret = fromBase64Url(subscription.keys.auth);
  const sender = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const senderPublic = new Uint8Array(await crypto.subtle.exportKey('raw', sender.publicKey));
  const receiverKey = await crypto.subtle.importKey('raw', receiver, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: receiverKey }, sender.privateKey, 256));
  const ikm = await hmac(await hmac(secret, shared), join(text('WebPush: info\0'), receiver, senderPublic, [1]));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, text('Content-Encoding: aes128gcm\0\x01'))).slice(0, 16);
  const nonce = (await hmac(prk, text('Content-Encoding: nonce\0\x01'))).slice(0, 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, join(text(message), [2])));
  return join(salt, [0, 0, 16, 0], [senderPublic.length], senderPublic, sealed);
}

// "vapid t=<signed token>, k=<public key>" for the push service at this endpoint.
export async function vapid(endpoint, publicKey, privateKey, now = Date.now()) {
  const raw = fromBase64Url(publicKey);
  const key = await crypto.subtle.importKey('jwk', {
    kty: 'EC', crv: 'P-256', x: toBase64Url(raw.slice(1, 33)), y: toBase64Url(raw.slice(33, 65)), d: privateKey, ext: true,
  }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const part = value => toBase64Url(text(JSON.stringify(value)));
  const unsigned = `${part({ typ: 'JWT', alg: 'ES256' })}.${part({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: SUBJECT })}`;
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, text(unsigned));
  return `vapid t=${unsigned}.${toBase64Url(signature)}, k=${publicKey}`;
}

// Sends { title, body, url, tag } to one subscription. Returns the push service's status; 404 and 410 mean it's gone.
export async function sendPush(env, subscription, note, fetcher = fetch) {
  const response = await fetcher(subscription.endpoint, {
    method: 'POST',
    headers: {
      authorization: await vapid(subscription.endpoint, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY),
      'content-encoding': 'aes128gcm', 'content-type': 'application/octet-stream', ttl: '86400', urgency: 'normal',
    },
    body: await encrypt(subscription, JSON.stringify(note)),
  });
  return response.status;
}

export const gone = status => status === 404 || status === 410;

// An account's devices with this one added or refreshed, newest last. Each device chooses reply and journal news.
export function addDevice(devices = [], subscription, { letters, journal } = {}, now) {
  return [...devices.filter(device => device.endpoint !== subscription.endpoint), { ...subscription, letters: letters === true, journal: journal === true, at: now }].slice(-MAX_DEVICES);
}

const excerpt = value => { const line = String(value || '').replace(/\s+/g, ' ').trim(); return line.length > 140 ? `${line.slice(0, 139)}…` : line; };
export const replyNote = reply => ({ title: 'Patch wrote back', body: excerpt(reply), url: '/patch/?view=letters', tag: 'patch-letter' });
export const journalNote = entry => ({ title: 'Patch wrote in his journal', body: excerpt(entry.title ? `${entry.title}: ${entry.text}` : entry.text), url: '/patch/', tag: 'patch-journal' });
