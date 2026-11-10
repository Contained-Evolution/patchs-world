// Patch's World Worker. Tenari's Worker forwards tenari.world/patch* here through a service binding.

import { DurableObject } from 'cloudflare:workers';
import { advance, newBody, view } from './body.mjs';
import { ponder, writeDiary, nextWake, allMemories, MONTHLY_BUDGET } from './mind.mjs';
import { STARTING_CATEGORIES } from '../shared/memory.js';

const headers = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'strict-transport-security': 'max-age=31536000',
};

const json = (body, status = 200) => Response.json(body, { status, headers: { ...headers, 'cache-control': 'no-store' } });

// The one Patch. Every visitor reads the same body; one alarm runs his mind.
export class PatchWorld extends DurableObject {
  async body(now) {
    let body = await this.ctx.storage.get('body');
    let changed = false;
    if (!body) { body = newBody(now, now & 0xffffffff); changed = true; }
    if (advance(body, now)) changed = true;
    if (changed) await this.ctx.storage.put('body', body);
    return body;
  }

  async state() {
    const now = Date.now();
    const body = await this.body(now);
    if (this.env.OPENROUTER_API_KEY && !(await this.ctx.storage.getAlarm())) await this.ctx.storage.setAlarm(now + 60000);
    return view(body, now);
  }

  async alarm() {
    const now = Date.now();
    const body = await this.body(now);
    const stored = await this.ctx.storage.get(['mind', 'memories', 'categories']);
    const world = { body, mind: stored.get('mind') || {}, memories: stored.get('memories') || [], categories: stored.get('categories') || {} };
    try {
      const resting = body.activity.action === 'sleep';
      if (!resting) await ponder(this.env, world, now);
      const diary = await writeDiary(this.env, world, now);
      if (diary) await this.ctx.storage.put(`diary:${diary.date}`, diary);
    } catch (error) {
      world.mind.lastError = { at: now, message: String(error.message || error).slice(0, 300) };
      console.error('Patch could not think:', error);
    }
    await this.ctx.storage.put({ body: world.body, mind: world.mind, memories: world.memories, categories: world.categories });
    await this.ctx.storage.setAlarm(nextWake(world.body, now));
  }

  async journal() {
    const mind = (await this.ctx.storage.get('mind')) || {};
    const diary = [...(await this.ctx.storage.list({ prefix: 'diary:', reverse: true, limit: 14 })).values()];
    return {
      thoughts: (mind.thoughts || []).slice(-20).reverse().map(({ at, thought, says }) => ({ at: new Date(at).toISOString(), thought, says })),
      diary: diary.map(({ date, title, text }) => ({ date, title, text })),
      words: (mind.words || []).map(({ word, meaning, from, at }) => ({ word, meaning, from, at: new Date(at).toISOString() })),
      budget: { month: mind.spend?.month || null, spent: Math.round((mind.spend?.total || 0) * 10000) / 10000, limit: MONTHLY_BUDGET },
      lastError: mind.lastError && mind.lastError.at > (mind.lastWake || 0) ? { at: new Date(mind.lastError.at).toISOString(), message: mind.lastError.message } : null,
    };
  }

  async memory() {
    const stored = await this.ctx.storage.get(['memories', 'categories']);
    return { categories: { ...STARTING_CATEGORIES, ...(stored.get('categories') || {}) }, memories: allMemories(stored.get('memories') || []) };
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
const words={eat:'eating',fish:'fishing',swim:'swimming',swing:'swinging through the trees',climb:'climbing',sit:'sitting',look:'looking out over the water',phone:'checking his phone',think:'thinking',sleep:'asleep',walk:'walking',run:'running',idle:'looking around',explore:'exploring','watch-sky':'watching the sky'};
const places={hammock:'in his hammock',shelves:'by his rope shelves',pond:'at the pond','banana-grove':'in the banana grove','tall-trees':'in the tall trees',beach:'on the beach',lookout:'at the lookout','tide-pools':'at the tide pools',meadow:'in the meadow',cave:'at the cave'};
async function tick(){try{const s=await (await fetch('/patch/api/state',{cache:'no-store'})).json();const p=s.patch;
const targets={hammock:'to his hammock',shelves:'to his rope shelves',pond:'to the pond','banana-grove':'to the banana grove','tall-trees':'to the tall trees',beach:'to the beach',lookout:'to the lookout','tide-pools':'to the tide pools',meadow:'to the meadow',cave:'to the cave'};
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
    if (path === '/api/journal' || path === '/api/memory') {
      if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
      const patch = env.PATCH_WORLD.get(env.PATCH_WORLD.idFromName('patch'));
      return json(path === '/api/journal' ? await patch.journal() : await patch.memory());
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
