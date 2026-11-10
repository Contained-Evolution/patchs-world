// Patch's World Worker. Tenari's Worker forwards tenari.world/patch* here through a service binding.

import { DurableObject } from 'cloudflare:workers';
import { advance, newBody, view } from './body.mjs';

const headers = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'strict-transport-security': 'max-age=31536000',
};

const json = (body, status = 200) => Response.json(body, { status, headers: { ...headers, 'cache-control': 'no-store' } });

// The one Patch. Every visitor reads the same body.
export class PatchWorld extends DurableObject {
  async state() {
    const now = Date.now();
    let body = await this.ctx.storage.get('body');
    let changed = false;
    if (!body) { body = newBody(now, now & 0xffffffff); changed = true; }
    if (advance(body, now)) changed = true;
    if (changed) await this.ctx.storage.put('body', body);
    return view(body, now);
  }
}

const HOLDING = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Patch's World</title>
<style>
@font-face{font-family:Pangolin;src:url(/patch/assets/Pangolin-Regular.ttf)}
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0f2a24;color:#f6f2e8;font:18px/1.5 Pangolin,system-ui,sans-serif;text-align:center}
main{max-width:520px;padding:24px}h1{font-weight:normal;font-size:34px;margin:0 0 8px}#now{font-size:22px;margin:18px 0}small{opacity:.7}
</style></head><body><main>
<h1>Patch's World</h1>
<p>Patch is a five-year-old monkey living on his own island. He's Contained Evolution's living AI.</p>
<p id="now">Checking on Patch…</p>
<small>His island is still being drawn. He's already living there.</small>
</main><script>
const words={eat:'eating',fish:'fishing',swim:'swimming',swing:'swinging through the trees',climb:'climbing',sit:'sitting',look:'looking out over the water',phone:'checking his phone',think:'thinking',sleep:'asleep',walk:'walking',run:'running',idle:'looking around'};
const places={hammock:'in his hammock',shelves:'by his rope shelves',pond:'at the pond','banana-grove':'in the banana grove','tall-trees':'in the tall trees',beach:'on the beach',lookout:'at the lookout'};
async function tick(){try{const s=await (await fetch('/patch/api/state',{cache:'no-store'})).json();const p=s.patch;
const targets={hammock:'to his hammock',shelves:'to his rope shelves',pond:'to the pond','banana-grove':'to the banana grove','tall-trees':'to the tall trees',beach:'to the beach',lookout:'to the lookout'};
const where=p.target?'on his way '+targets[p.target]:places[p.place];
document.getElementById('now').textContent='Patch is '+(words[p.action]||p.action)+' '+where+'.'+(p.says?' "'+p.says+'"':'');}catch{}}
tick();setInterval(tick,10000);
</script></body></html>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/patch') return Response.redirect(new URL('/patch/', url).href, 301);
    if (!url.pathname.startsWith('/patch/')) return json({ error: 'Not found.' }, 404);
    const path = url.pathname.slice('/patch'.length);

    if (path === '/api/state') {
      if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
      const patch = env.PATCH_WORLD.get(env.PATCH_WORLD.idFromName('patch'));
      return json(await patch.state());
    }
    if (path.startsWith('/api/')) return json({ error: 'Not found.' }, 404);

    const assetUrl = new URL(path, url);
    const asset = await env.ASSETS.fetch(new Request(assetUrl, request));
    if (asset.status === 404 && (path === '/' || path === '/index.html'))
      return new Response(HOLDING, { headers: { ...headers, 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
    const out = new Headers(asset.headers);
    for (const [name, value] of Object.entries(headers)) out.set(name, value);
    return new Response(asset.body, { status: asset.status, headers: out });
  },
};
