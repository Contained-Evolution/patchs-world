// Patch's World Worker, reached through the company website service binding.

import { DurableObject } from 'cloudflare:workers';
import { advance, newBody, view } from './body.mjs';
import { ponder, writeDiary, answerLetters, moderate, spend, overBudget, localDate, nextWake, allMemories, MONTHLY_BUDGET } from './mind.mjs';
import { visitor, SIGN_IN } from './accounts.mjs';
import { LIMITS, cleanText, freshLimits, checkLetter, checkPost, countLetter, countPost, pickLetters, postKey } from './letters.mjs';
import { STARTING_CATEGORIES } from '../shared/memory.js';

const headers = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'strict-transport-security': 'max-age=31536000',
};

const json = (body, status = 200) => Response.json(body, { status, headers: { ...headers, 'cache-control': 'no-store' } });

const publicLetter = ({ id, text, at, reply, repliedAt }) => ({
  id, text, at: new Date(at).toISOString(), reply, repliedAt: repliedAt ? new Date(repliedAt).toISOString() : null,
});

async function readText(request) {
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > 8192) return null;
  try { return JSON.parse(new TextDecoder().decode(bytes))?.text; } catch { return null; }
}

const newId = now => `${now.toString(36)}${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`;

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
    const stored = await this.ctx.storage.get(['mind', 'memories', 'categories', 'unread', 'people']);
    const world = { body, mind: stored.get('mind') || {}, memories: stored.get('memories') || [], categories: stored.get('categories') || {} };
    const startSpend = world.mind.spend?.total || 0;
    const people = stored.get('people') || {};
    const answered = [];
    try {
      if (body.activity.action !== 'sleep') {
        await ponder(this.env, world, now);
        const ids = (stored.get('unread') || []).slice(0, 50);
        const letters = ids.length ? [...(await this.ctx.storage.get(ids.map(id => `letter:${id}`))).values()] : [];
        for (const reply of await answerLetters(this.env, world, pickLetters(letters, people), people, now)) {
          const letter = letters.find(item => item.id === reply.id);
          Object.assign(letter, { reply: reply.reply, repliedAt: now });
          await this.ctx.storage.put(`letter:${letter.id}`, letter);
          const person = people[letter.from.id] ||= { name: letter.from.name, firstAt: now, notes: [] };
          person.name = letter.from.name;
          person.answered = (person.answered || 0) + 1;
          if (reply.note) person.notes = [...person.notes, reply.note].slice(-10);
          world.body.needs.social = Math.min(1, world.body.needs.social + 0.08);
          answered.push(letter.id);
        }
      }
      const diary = await writeDiary(this.env, world, now);
      if (diary) await this.ctx.storage.put(`diary:${diary.date}`, diary);
    } catch (error) {
      world.mind.lastError = { at: now, message: String(error.message || error).slice(0, 300) };
      console.error('Patch could not think:', error);
    }
    // New letters and filter costs may have arrived while he was thinking; keep them.
    const latest = await this.ctx.storage.get(['mind', 'unread']);
    const latestMind = latest.get('mind');
    const extra = latestMind?.spend?.month === world.mind.spend?.month ? (latestMind.spend.total || 0) - startSpend : 0;
    if (extra > 0) spend(world.mind, extra, now);
    const unread = (latest.get('unread') || []).filter(id => !answered.includes(id));
    await this.ctx.storage.put({ body: world.body, mind: world.mind, memories: world.memories, categories: world.categories, unread, people });
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

  // The automatic filter. Records its cost; returns null when allowed, otherwise the reason.
  async filter(text, now) {
    if (overBudget((await this.ctx.storage.get('mind')) || {}, now)) return "Patch's mailbox is closed until next month.";
    const result = await moderate(this.env, text);
    const mind = (await this.ctx.storage.get('mind')) || {};
    spend(mind, result.cost, now);
    await this.ctx.storage.put('mind', mind);
    return result.allowed ? null : result.reason || "That message can't be shared here.";
  }

  async limits(who, now) {
    return freshLimits(await this.ctx.storage.get(`limits:${who.id}`), localDate(now));
  }

  async isBlocked(who) {
    return ((await this.ctx.storage.get('blocked')) || []).includes(who.id);
  }

  async sendLetter(who, raw) {
    const now = Date.now(), text = cleanText(raw);
    if (await this.isBlocked(who)) return { status: 403, error: "You can't write to Patch." };
    const problem = checkLetter(text, await this.limits(who, now), ((await this.ctx.storage.get('unread')) || []).length);
    if (problem) return { status: /a day|full/.test(problem) ? 429 : 400, error: problem };
    let refused;
    try { refused = await this.filter(text, now); } catch { return { status: 503, error: "Patch can't get mail right now. Try again soon." }; }
    if (refused) return { status: 400, error: refused };
    const id = newId(now);
    const letter = { id, from: { id: who.id, name: who.name }, text, at: now, reply: null, repliedAt: null };
    const inbox = (await this.ctx.storage.get(`inbox:${who.id}`)) || [];
    const unread = (await this.ctx.storage.get('unread')) || [];
    const limits = countLetter(await this.limits(who, now), text);
    await this.ctx.storage.put({ [`letter:${id}`]: letter, [`inbox:${who.id}`]: [...inbox, id].slice(-30), unread: [...unread, id], [`limits:${who.id}`]: limits });
    return { status: 201, letter: publicLetter(letter) };
  }

  async letters(who) {
    const ids = (await this.ctx.storage.get(`inbox:${who.id}`)) || [];
    const letters = await this.ctx.storage.get(ids.map(id => `letter:${id}`));
    return ids.map(id => letters.get(`letter:${id}`)).filter(Boolean).reverse().map(publicLetter);
  }

  async board(before) {
    const options = { prefix: 'post:', limit: 30 };
    if (before) options.startAfter = before;
    const posts = [...(await this.ctx.storage.list(options)).entries()];
    return {
      posts: posts.filter(([, post]) => !post.hidden).map(([id, post]) => ({ id, name: post.name, text: post.text, at: new Date(post.at).toISOString() })),
      next: posts.length === 30 ? posts.at(-1)[0] : null,
    };
  }

  async sendPost(who, raw) {
    const now = Date.now(), text = cleanText(raw);
    if (await this.isBlocked(who)) return { status: 403, error: "You can't post here." };
    const problem = checkPost(text, await this.limits(who, now), now);
    if (problem) return { status: /today|Slow/.test(problem) ? 429 : 400, error: problem };
    let refused;
    try { refused = await this.filter(text, now); } catch { return { status: 503, error: 'The message board is busy. Try again soon.' }; }
    if (refused) return { status: 400, error: refused };
    const id = postKey(now, newId(now));
    const limits = countPost(await this.limits(who, now), text, now);
    await this.ctx.storage.put({ [id]: { name: who.name, userId: who.id, text, at: now, reports: [], hidden: false }, [`limits:${who.id}`]: limits });
    return { status: 201, post: { id, name: who.name, text, at: new Date(now).toISOString() } };
  }

  // Three reports hide a post. Chris's account hides it at once.
  async report(who, id) {
    const post = id.startsWith('post:') && await this.ctx.storage.get(id);
    if (!post) return { status: 404, error: 'Not found.' };
    if (!post.reports.includes(who.id)) post.reports.push(who.id);
    if (who.admin || post.reports.length >= LIMITS.reportsToHide) post.hidden = true;
    await this.ctx.storage.put(id, post);
    return { status: 200, hidden: post.hidden };
  }

  // Chris's account can block the author of a post from writing or posting.
  async block(who, id) {
    if (!who.admin) return { status: 403, error: 'Not allowed.' };
    const post = id.startsWith('post:') && await this.ctx.storage.get(id);
    if (!post) return { status: 404, error: 'Not found.' };
    const blocked = (await this.ctx.storage.get('blocked')) || [];
    post.hidden = true;
    await this.ctx.storage.put({ [id]: post, blocked: [...new Set([...blocked, post.userId])] });
    return { status: 200, blocked: true };
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

const patchOf = env => env.PATCH_WORLD.get(env.PATCH_WORLD.idFromName('patch'));

// Letters, the message board and who's signed in.
async function visitorApi(request, env, url, path) {
  const patch = patchOf(env);
  if (path === '/api/board' && request.method === 'GET') return json(await patch.board(url.searchParams.get('before')));
  if (request.method === 'POST' && request.headers.get('origin') !== 'https://containedevolution.com') return json({ error: 'Invalid origin.' }, 403);
  let who;
  try { who = await visitor(request, env); } catch { return json({ error: 'Account check is unavailable. Try again soon.' }, 503); }
  if (path === '/api/me' && request.method === 'GET') return json({ user: who && { name: who.name, admin: who.admin }, signIn: SIGN_IN });
  if (!who) return json({ error: 'Sign in to talk to Patch.', signIn: SIGN_IN }, 401);
  const send = ({ status, ...body }) => json(body, status);
  if (path === '/api/letters' && request.method === 'GET') return json({ letters: await patch.letters(who) });
  if (path === '/api/letters' && request.method === 'POST') return send(await patch.sendLetter(who, await readText(request)));
  if (path === '/api/board' && request.method === 'POST') return send(await patch.sendPost(who, await readText(request)));
  const action = path.match(/^\/api\/board\/(post:[0-9a-z-]+)\/(report|block)$/);
  if (action && request.method === 'POST') return send(await (action[2] === 'report' ? patch.report(who, action[1]) : patch.block(who, action[1])));
  return json({ error: 'Not found.' }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/patch') return Response.redirect(new URL('/patch/', url).href, 301);
    if (!url.pathname.startsWith('/patch/')) return json({ error: 'Not found.' }, 404);
    const path = url.pathname.slice('/patch'.length);

    if (path === '/api/state' || path === '/api/journal' || path === '/api/memory') {
      if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
      const patch = patchOf(env);
      return json(path === '/api/state' ? await patch.state() : path === '/api/journal' ? await patch.journal() : await patch.memory());
    }
    if (path === '/api/me' || path === '/api/letters' || path.startsWith('/api/board')) return visitorApi(request, env, url, path);
    if (path.startsWith('/api/')) return json({ error: 'Not found.' }, 404);

    const assetUrl = new URL(path === '/' ? '/index.html' : path, url);
    const asset = await env.ASSETS.fetch(new Request(assetUrl, request));
    if (asset.status === 404 && (path === '/' || path === '/index.html'))
      return new Response(HOLDING, { headers: { ...headers, 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
    const out = new Headers(asset.headers);
    for (const [name, value] of Object.entries(headers)) out.set(name, value);
    return new Response(asset.body, { status: asset.status, headers: out });
  },
};
