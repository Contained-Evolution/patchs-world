// Keeps Patch's island on the device and shows his notifications. build.mjs fills in VERSION and FILES.
const VERSION = '__VERSION__';
const FILES = __FILES__;
const BASE = '/';
const CACHE = `patch-${VERSION}`;

// Fetch every island file once per version. Files whose hash didn't change come from the last version's cache.
async function fill() {
  const cache = await caches.open(CACHE);
  const older = await Promise.all((await caches.keys()).filter(name => name.startsWith('patch-') && name !== CACHE).map(name => caches.open(name)));
  const queue = Object.entries(FILES);
  async function next() {
    for (let item; (item = queue.shift());) {
      const [path, hash] = item, url = BASE + path;
      if ((await cache.match(url))?.headers.get('x-patch-hash') === hash) continue;
      let kept;
      for (const old of older) { const hit = await old.match(url); if (hit?.headers.get('x-patch-hash') === hash) { kept = hit; break; } }
      if (!kept) {
        const response = await fetch(url, { cache: 'no-cache' });
        if (!response.ok) throw new Error(`${path}: ${response.status}`);
        const headers = new Headers(response.headers); headers.set('x-patch-hash', hash);
        kept = new Response(await response.blob(), { status: response.status, headers });
      }
      await cache.put(url, kept);
    }
  }
  await Promise.all(Array.from({ length: 6 }, next));
}

self.addEventListener('install', event => event.waitUntil(fill()));

self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const name of await caches.keys()) if (name.startsWith('patch-') && name !== CACHE) await caches.delete(name);
  await self.clients.claim();
})()));

// The page's "Update ready" button.
self.addEventListener('message', event => { if (event.data === 'update') self.skipWaiting(); });

// Island files come from the cache; Patch's live state, letters and anything else always go to the network.
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  const path = url.pathname === BASE ? 'index.html' : url.pathname.slice(BASE.length);
  if (!(path in FILES)) return;
  event.respondWith(caches.open(CACHE).then(cache => cache.match(BASE + path)).then(hit => hit || fetch(event.request)));
});

self.addEventListener('push', event => {
  let note = {};
  try { note = event.data?.json() || {}; } catch {}
  event.waitUntil(self.registration.showNotification(note.title || "Patch's World", {
    body: note.body || '', tag: note.tag, icon: `${BASE}icons/icon-192.png`, data: { url: note.url || BASE },
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || BASE, self.location.origin);
  if (!url.pathname.startsWith(BASE)) url.href = new URL(BASE, self.location.origin).href;
  event.waitUntil((async () => {
    const open = (await self.clients.matchAll({ type: 'window' })).find(client => new URL(client.url).pathname.startsWith(BASE));
    // A window this worker doesn't control yet can't be navigated from here, so open a new one instead.
    if (open) try { await open.focus(); return await open.navigate(url.href); } catch {}
    return self.clients.openWindow(url.href);
  })());
});
