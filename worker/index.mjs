// Patch's World Worker, reached through the company website service binding.

import { DurableObject } from 'cloudflare:workers';
import { GIFT_SOUND_DURATION } from '../shared/state.js';
import { advance, newBody, view, didSince, localMinutes } from './body.mjs';
import { ponder, writeDiary, answerLetters, research, writeJournal, moderate, spend, overBudget, localDate, nextWake, allMemories, internetStatus } from './mind.mjs';
import { giftView, useGift } from './gifts.mjs';
import { visitor, SIGN_IN } from './accounts.mjs';
import { LIMITS, cleanText, freshLimits, checkLetter, checkPost, countLetter, countPost, pickLetters, postKey } from './letters.mjs';
import { STARTING_CATEGORIES } from '../shared/memory.js';
import { concepts } from './memory-graph.mjs';
import { cleanSubscription, addDevice, sendPush, gone, deliveries } from './push.mjs';
import { canSpeak, voiceRoom, countVoice, record } from './voice.mjs';
import { estimateMs, schedule, speechView } from '../shared/speech.js';
import { feedFrom } from '../shared/feed.js';

const headers = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'strict-transport-security': 'max-age=31536000',
};

const json = (body, status = 200) => Response.json(body, { status, headers: { ...headers, 'cache-control': 'no-store' } });

const publicLetter = ({ id, text, at, reply, repliedAt, lookup, acceptedLookup, voice }) => ({
  id, text, lookup: Boolean(lookup), acceptedLookup: Boolean(acceptedLookup), at: new Date(at).toISOString(), reply, repliedAt: repliedAt ? new Date(repliedAt).toISOString() : null, voice: voice || null,
});

async function readJson(request) {
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > 8192) return null;
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { return null; }
}
const readText = async request => (await readJson(request))?.text;

const MINUTE = 60000;
// Journal entries sort by when he wrote them, in his own time: his tablet entries through the day and the evening diary.
const diaryKey = entry => { const m = localMinutes(entry.at); return `diary:${entry.date}T${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:${entry.at}`; };

const newId = now => `${now.toString(36)}${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`;

// The one Patch. Every visitor reads the same body; one alarm runs his mind.
export class PatchWorld extends DurableObject {
  // Once, when his mind took charge of his day: delete every letter, board post and record of who wrote.
  async freshStart(now) {
    if (this.started || await this.ctx.storage.get('freshStart')) { this.started = true; return; }
    for (const prefix of ['letter:', 'inbox:', 'post:', 'limits:']) {
      for (let keys; (keys = [...(await this.ctx.storage.list({ prefix, limit: 128 })).keys()]).length;) await this.ctx.storage.delete(keys);
    }
    await this.ctx.storage.delete(['unread', 'people']);
    await this.ctx.storage.put('freshStart', now);
    if (this.env.OPENROUTER_API_KEY) await this.ctx.storage.setAlarm(now + 30000);
    this.started = true;
  }

  // Once: only Patch has a name, so older thoughts, memories and diary entries lose the family's old names.
  async forgetNames() {
    if (this.renamed || await this.ctx.storage.get('familyNamesForgotten')) { this.renamed = true; return; }
    const rename = text => typeof text === 'string' ? text.replace(/\bSam's\b/g, "my sister's").replace(/\bSam\b/g, 'my sister').replace(/\bGeorge\b/g, 'Dad').replace(/\bSally\b/g, 'Mom').replace(/\bTiko\b/g, 'my friend') : text;
    const fix = (item, keys) => { for (const key of keys) item[key] = rename(item[key]); return item; };
    const stored = await this.ctx.storage.get(['mind', 'memories']), mind = stored.get('mind') || {};
    for (const entry of mind.thoughts || []) fix(entry, ['thought', 'says']);
    for (const entry of mind.decisions || []) fix(entry, ['why']);
    const memories = (stored.get('memories') || []).map(memory => fix({ ...memory, people: (memory.people || []).map(rename) }, ['title', 'text']));
    const diary = await this.ctx.storage.list({ prefix: 'diary:' });
    for (const entry of diary.values()) fix(entry, ['title', 'text']);
    await this.ctx.storage.put({ mind, memories, familyNamesForgotten: true, ...Object.fromEntries(diary) });
    this.renamed = true;
  }

  async body(now) {
    await this.freshStart(now);
    await this.forgetNames();
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
    const stored = await this.ctx.storage.get(['unread', 'giftSound', 'speech', 'mind', 'outfit']);
    const result = view(body, now, (stored.get('unread') || []).length);
    result.patch.outfit = stored.get('outfit') || null;
    const sound = stored.get('giftSound');
    if (sound && now - sound.at < GIFT_SOUND_DURATION) result.patch.giftSound = sound;
    const speech = speechView(stored.get('speech'), now);
    result.patch.speech = speech;
    result.feed = feedFrom(stored.get('mind')?.thoughts);
    if (speech && Date.parse(speech.at) <= now) Object.assign(result.patch, { says: speech.text, speechUntil: speech.until });
    return result;
  }

  async alarm() {
    const now = Date.now();
    const body = await this.body(now);
    const stored = await this.ctx.storage.get(['mind', 'memories', 'categories', 'unread', 'people']);
    const world = { body, mind: stored.get('mind') || {}, memories: stored.get('memories') || [], categories: stored.get('categories') || {} };
    if (now - world.mind.lookup?.at > 7 * 86_400_000) world.mind.lookup = null;
    world.mind.searchSpend = await this.ctx.storage.get('searchSpend');
    world.saveSearchSpend = ledger => this.ctx.storage.put('searchSpend', ledger);
    const selectedGifts = await this.ctx.storage.transaction(async txn => {
      const queue = await txn.get('campGifts') || [];
      const selected = queue.slice(0, 12);
      if (queue.length > 12) await txn.put('campGifts', [...queue.slice(12), ...selected]);
      return selected;
    });
    world.mind.gifts = selectedGifts.length ? [...(await this.ctx.storage.get(selectedGifts.map(id => `gift:${id}`))).values()] : [];
    const startSpend = world.mind.spend?.total || 0;
    const people = stored.get('people') || {};
    const answered = [], replies = [], entries = [], spoken = [];
    const since = world.mind.lastWake || now - 60 * MINUTE;
    try {
      if (body.activity.action !== 'sleep') {
        const previousSearch = world.mind.wantSearch && await research(this.env, world, now);
        const giftBody = { activity: { ...body.activity }, needs: body.needs };
        await ponder(this.env, { ...world, mail: (stored.get('unread') || []).length }, now);
        // What he says is queued with his voice instead of shown on the spot.
        if (body.activity.saysAt === now && body.activity.says) spoken.push({ text: body.activity.says, kind: 'says' });
        delete body.activity.says;
        delete body.activity.saysAt;
        const gift = world.mind.gifts.find(item => item.id === world.mind.giftChoice?.id);
        if (gift) {
          const result = await this.applyGift(gift.id, world.mind.giftChoice.do, giftBody, now);
          if (result) world.mind.thoughts = [...(world.mind.thoughts || []), { at: now, thought: result, says: null }].slice(-40);
        }
        if (!previousSearch) await research(this.env, world, now);
        const entry = await writeJournal(this.env, world, now);
        if (entry) { await this.ctx.storage.put(diaryKey(entry), entry); entries.push(entry); }
        // Letters are read and answered only at the coconut computer.
        const atComputer = didSince(world.body, since, { place: 'computer' });
        const ids = atComputer ? (stored.get('unread') || []).slice(0, 50) : [];
        const letters = ids.length ? [...(await this.ctx.storage.get(ids.map(id => `letter:${id}`))).values()] : [];
        for (const reply of await answerLetters(this.env, world, pickLetters(letters, people), people, now)) {
          const letter = letters.find(item => item.id === reply.id);
          const acceptedLookup = Boolean(letter.lookup && reply.acceptLookup && !world.mind.lookup);
          if (acceptedLookup) world.mind.lookup = { query: letter.text, at: now };
          Object.assign(letter, { reply: reply.reply, repliedAt: now, acceptedLookup });
          await this.ctx.storage.put(`letter:${letter.id}`, letter);
          const person = people[letter.from.id] ||= { name: letter.from.name, firstAt: now, notes: [] };
          person.name = letter.from.name;
          person.answered = (person.answered || 0) + 1;
          if (reply.note) person.notes = [...person.notes, reply.note].slice(-10);
          world.body.needs.social = Math.min(1, world.body.needs.social + 0.08);
          answered.push(letter.id);
          replies.push({ userId: letter.from.id, reply: reply.reply });
          spoken.push({ text: reply.reply, kind: 'reply', letter });
        }
      }
      const diary = await writeDiary(this.env, world, now);
      if (diary) { await this.ctx.storage.put(diaryKey(diary), diary); entries.push(diary); }
    } catch (error) {
      world.mind.lastError = { at: now, message: String(error.message || error).slice(0, 300) };
      // Until his mind works again, his needs decide for him.
      world.body.mindAlive = false;
      console.error('Patch could not think:', error);
    }
    // New letters and filter costs may have arrived while he was thinking; keep them.
    delete world.mind.gifts;
    delete world.mind.giftChoice;
    delete world.mind.searchSpend;
    const latest = await this.ctx.storage.get(['mind', 'unread']);
    const latestMind = latest.get('mind');
    const extra = latestMind?.spend && latestMind.spend.month === world.mind.spend?.month ? latestMind.spend.total - startSpend : 0;
    if (extra > 0) spend(world.mind, extra, now);
    const unread = (latest.get('unread') || []).filter(id => !answered.includes(id));
    await this.ctx.storage.put({ body: world.body, mind: world.mind, memories: world.memories, categories: world.categories, unread, people });
    await this.ctx.storage.setAlarm(nextWake(world.body, now));
    try { await this.speak(spoken, now); } catch (error) { console.error('Patch could not speak:', error); }
    try { await this.notify(replies, entries); } catch (error) { console.error('Patch could not send notifications:', error); }
  }

  // Records what he says and his letter replies once, then queues them to be said in turn, out loud for everyone watching.
  async speak(lines, now) {
    if (!lines.length) return;
    const stored = await this.ctx.storage.get(['speech', 'voiceSpend', 'spokenLines']);
    let ledger = stored.get('voiceSpend') || countVoice(null, now, ''), recent = stored.get('spokenLines') || [];
    const items = [];
    for (const line of lines) {
      const item = { text: line.text, kind: line.kind, ms: estimateMs(line.text), voice: null };
      if (canSpeak(this.env) && voiceRoom(ledger, this.env, now, line.text, line.kind)) {
        try {
          const { audio, timing, ms } = await record(this.env, line.text);
          const id = newId(Date.now());
          await this.ctx.storage.put(`voice:${id}`, { audio, timing, ms, at: Date.now() });
          ledger = countVoice(ledger, now, line.text);
          Object.assign(item, { voice: id, ms });
          if (line.letter) await this.ctx.storage.put(`letter:${line.letter.id}`, { ...line.letter, voice: id });
          else recent.push(id);
        } catch (error) { console.error('Patch could not record his voice:', error); }
      }
      items.push(item);
    }
    // Letter replies keep their recordings; only his latest spoken thoughts keep theirs.
    const old = recent.slice(0, -30);
    recent = recent.slice(-30);
    if (old.length) await this.ctx.storage.delete(old.map(id => `voice:${id}`));
    await this.ctx.storage.put({ speech: schedule(stored.get('speech'), items, Date.now()), voiceSpend: ledger, spokenLines: recent });
  }

  // A recording: its timing, or with `audio` its mp3 bytes.
  async voice(id, audio = false) {
    const clip = await this.ctx.storage.get(`voice:${id}`);
    if (!clip) return null;
    return audio ? { audio: clip.audio } : { timing: clip.timing, ms: clip.ms };
  }

  // This account's notification devices: { publicKey, devices: [{ endpoint, letters, journal }] }.
  async devices(who) {
    const devices = (await this.ctx.storage.get(`push:${who.id}`)) || [];
    return { publicKey: this.env.VAPID_PUBLIC_KEY || null, devices: devices.map(({ endpoint, letters, journal }) => ({ endpoint, letters, journal })) };
  }

  async savePush(who, body) {
    if (!this.env.VAPID_PUBLIC_KEY) return { status: 503, error: 'Notifications are not set up yet.' };
    const subscription = cleanSubscription(body?.subscription);
    if (!subscription) return { status: 400, error: "This browser's notifications can't be used here." };
    const key = `push:${who.id}`;
    await this.ctx.storage.put(key, addDevice(await this.ctx.storage.get(key), subscription, body, Date.now()));
    return { status: 200, ...(await this.devices(who)) };
  }

  async removePush(who, endpoint) {
    const key = `push:${who.id}`, devices = ((await this.ctx.storage.get(key)) || []).filter(device => device.endpoint !== endpoint);
    if (devices.length) await this.ctx.storage.put(key, devices); else await this.ctx.storage.delete(key);
    return { status: 200, ...(await this.devices(who)) };
  }

  async notify(replies, entries) {
    if (!this.env.VAPID_PUBLIC_KEY || !this.env.VAPID_PRIVATE_KEY || !(replies.length || entries.length)) return;
    const owners = entries.length ? await this.ctx.storage.list({ prefix: 'push:' }) : await this.ctx.storage.get(replies.map(({ userId }) => `push:${userId}`));
    const sends = deliveries(owners, replies, entries).map(({ key, device, note }) => sendPush(this.env, device, note).then(status => ({ key, endpoint: device.endpoint, status })));
    const stale = new Map();
    for (const result of await Promise.allSettled(sends)) {
      if (result.status === 'fulfilled' && gone(result.value.status)) stale.set(result.value.key, [...(stale.get(result.value.key) || []), result.value.endpoint]);
    }
    for (const [key, endpoints] of stale) {
      const devices = ((await this.ctx.storage.get(key)) || []).filter(device => !endpoints.includes(device.endpoint));
      if (devices.length) await this.ctx.storage.put(key, devices); else await this.ctx.storage.delete(key);
    }
  }

  async journal() {
    const mind = (await this.ctx.storage.get('mind')) || {};
    const diary = [...(await this.ctx.storage.list({ prefix: 'diary:', reverse: true, limit: 14 })).values()];
    return {
      diary: diary.map(({ date, title, text, at, kind }) => ({ date, title, text, at: at ? new Date(at).toISOString() : null, kind: kind || 'evening' })),
      searches: (mind.searches || []).slice(-20).reverse().map(({ at, query, where, learned, sources, note }) => ({ at: new Date(at).toISOString(), query, where, learned, sources, note })),
      internet: { status: internetStatus(await this.ctx.storage.get('searchSpend'), Date.now()) },
      words: (mind.words || []).map(({ word, meaning, from, at }) => ({ word, meaning, from, at: new Date(at).toISOString() })),
    };
  }

  async memory() {
    const stored = await this.ctx.storage.get(['memories', 'categories', 'mind']);
    const memories = allMemories(stored.get('memories') || []), lit = stored.get('mind')?.lit;
    return {
      categories: { ...STARTING_CATEGORIES, ...(stored.get('categories') || {}) }, memories, concepts: concepts(memories),
      lit: lit ? { ...lit, at: new Date(lit.at).toISOString() } : null,
    };
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

  async gifts(who) {
    const now = Date.now();
    const id = await this.ctx.storage.get(`gift-owner:${who.id}`);
    return { ...giftView(id && await this.ctx.storage.get(`gift:${id}`) || {}, localDate(now), now), canOfferHoodie: who.admin };
  }

  async sendGift(who, kind) {
    const now = Date.now(), day = localDate(now);
    if (await this.isBlocked(who)) return { status: 403, error: "You can't send gifts to Patch." };
    if (kind === 'hoodie' && !who.admin) return { status: 403, error: 'Only Chris can leave this hoodie.' };
    if (!['meal', 'ball', 'hoodie'].includes(kind)) return { status: 400, error: 'Choose a banana or ball.' };
    const result = await this.ctx.storage.transaction(async txn => {
      const owner = `gift-owner:${who.id}`;
      const id = await txn.get(owner) || newId(now);
      const key = `gift:${id}`, gifts = await txn.get(key) || { id };
      const queue = await txn.get('campGifts') || [];
      if (kind === 'hoodie') {
        if (gifts.hoodie) return { status: 429, error: 'You already left the hoodie for Patch.' };
        gifts.hoodie = { status: 'waiting' };
      } else if (kind === 'meal') {
        if (!giftView(gifts, day, now).canSendMeal) return { status: 429, error: 'You can leave one banana a day, after Patch eats the last one.' };
        gifts.meal = { day, status: 'waiting' };
      } else {
        if (gifts.offer?.status === 'waiting') return { status: 429, error: 'Your ball is already waiting for Patch.' };
        if (!giftView(gifts, day, now).canSendBall) return { status: 429, error: 'You can offer a replacement when your ball is worn.' };
        gifts.offer = { status: 'waiting' };
      }
      await txn.put({ [owner]: id, [key]: gifts, campGifts: [id, ...queue.filter(other => other !== id)] });
      return { status: 201, ...giftView(gifts, day, now), canOfferHoodie: who.admin };
    });
    if (result.status === 201) await this.ping(now);
    return result;
  }

  async applyGift(id, action, body, now) {
    const key = `gift:${id}`;
    const sound = { action, place: body.activity.place, at: Date.now() };
    // Apply to a copy so storage transaction retries cannot increase needs twice.
    const result = await this.ctx.storage.transaction(async txn => {
      const gifts = await txn.get(key);
      if (!gifts) return null;
      const copy = { activity: body.activity, needs: { ...body.needs } };
      const thought = useGift(gifts, action, copy, now);
      if (!thought) return null;
      if (action === 'wear') await txn.put('outfit', 'hoodie');
      await txn.put({ [key]: gifts, giftSound: sound });
      return { thought, needs: copy.needs };
    });
    if (result) Object.assign(body.needs, result.needs);
    return result?.thought;
  }

  async sendLetter(who, raw) {
    const now = Date.now(), text = cleanText(raw?.text), lookup = raw?.lookup === true;
    if (lookup && (text.length > 120 || /https?:|www\.|[\r\n]/i.test(text))) return { status: 400, error: 'Write a lookup question of up to 120 characters without links.' };
    if (await this.isBlocked(who)) return { status: 403, error: "You can't write to Patch." };
    const unreadCount = ((await this.ctx.storage.get('unread')) || []).length;
    const problem = checkLetter(text, await this.limits(who, now), unreadCount, { exemptFromDailyLimit: who.admin });
    if (problem) return { status: /a day|full/.test(problem) ? 429 : 400, error: problem };
    let refused;
    try { refused = await this.filter(text, now); } catch { return { status: 503, error: "Patch can't get mail right now. Try again soon." }; }
    if (refused) return { status: 400, error: refused };
    const id = newId(now);
    const letter = { id, from: { id: who.id, name: who.name }, text, lookup, at: now, reply: null, repliedAt: null };
    const inbox = (await this.ctx.storage.get(`inbox:${who.id}`)) || [];
    const unread = (await this.ctx.storage.get('unread')) || [];
    const limits = countLetter(await this.limits(who, now), text);
    await this.ctx.storage.put({ [`letter:${id}`]: letter, [`inbox:${who.id}`]: [...inbox, id].slice(-30), unread: [...unread, id], [`limits:${who.id}`]: limits });
    await this.ping(now);
    return { status: 201, letter: publicLetter(letter) };
  }

  // A new letter pings his tablet: his mind wakes soon to decide whether to go to the coconut computer.
  // At most once every 20 minutes, and never while he sleeps.
  async ping(now) {
    if (!this.env.OPENROUTER_API_KEY) return;
    const body = await this.ctx.storage.get('body'), last = (await this.ctx.storage.get('pingedAt')) || 0, alarm = await this.ctx.storage.getAlarm();
    if (!body || body.activity.action === 'sleep' || now - last < 20 * MINUTE || (alarm && alarm <= now + 2 * MINUTE)) return;
    await this.ctx.storage.put('pingedAt', now);
    await this.ctx.storage.setAlarm(now + 2 * MINUTE);
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
@font-face{font-family:Pangolin;src:url(/assets/Pangolin-Regular.ttf)}
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0f2a24;color:#f6f2e8;font:18px/1.5 Pangolin,system-ui,sans-serif;text-align:center}
main{max-width:520px;padding:24px}h1{font-weight:normal;font-size:34px;margin:0 0 8px}#now{font-size:22px;margin:18px 0}small{opacity:.7}
</style></head><body><main>
<h1>Patch's World</h1>
<p>Patch is a five-year-old monkey living on his own island. He's Contained Evolution's living AI.</p>
<p id="now">Checking on Patch…</p>
<small>His island is still being drawn. He's already living there.</small>
</main><script>
const words={eat:'eating',fish:'fishing',swim:'swimming',swing:'swinging through the trees',climb:'climbing',sit:'sitting',look:'looking out over the water',computer:'at his coconut computer',research:'looking something up',write:'writing in his journal',think:'thinking',sleep:'asleep',walk:'walking',run:'running',idle:'looking around',explore:'exploring','watch-sky':'watching the sky',archery:'practising with his bow',dance:'dancing'};
const places={hammock:'by his hammock',shelves:'by his rope shelves',computer:'at camp',pond:'at the pond','banana-grove':'in the banana grove','tall-trees':'in the tall trees',beach:'on the beach',lookout:'at the lookout','tide-pools':'at the tide pools',meadow:'in the meadow',cave:'at the cave'};
async function tick(){try{const s=await (await fetch('/api/state',{cache:'no-store'})).json();const p=s.patch;
const targets={hammock:'to his hammock',shelves:'to his rope shelves',computer:'to his coconut computer',pond:'to the pond','banana-grove':'to the banana grove','tall-trees':'to the tall trees',beach:'to the beach',lookout:'to the lookout','tide-pools':'to the tide pools',meadow:'to the meadow',cave:'to the cave'};
const where=p.target?'on his way '+targets[p.target]:p.place==='hammock'&&p.action==='sleep'?'in his hammock':places[p.place];
document.getElementById('now').textContent='Patch is '+(words[p.action]||p.action)+' '+where+'.'+(p.says?' "'+p.says+'"':'');}catch{}}
tick();setInterval(tick,10000);
</script></body></html>`;

const SITE = 'https://patch.containedevolution.com';

// Replaces the service worker saved at containedevolution.com/patch/: drops its island copy and opens the new address.
const RETIRE = `self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const name of await caches.keys()) if (name.startsWith('patch-')) await caches.delete(name);
  await self.registration.unregister();
  await Promise.allSettled((await self.clients.matchAll({ type: 'window' })).map(client => client.navigate('${SITE}/')));
})()));`;

// Safari's audio player asks for byte ranges.
function audioResponse(request, audio, base) {
  const out = { ...base, 'content-type': 'audio/mpeg', 'accept-ranges': 'bytes' };
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') || '');
  if (!range || (!range[1] && !range[2])) return new Response(audio, { headers: out });
  const size = audio.byteLength;
  const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
  const end = range[1] && range[2] ? Math.min(size - 1, Number(range[2])) : size - 1;
  if (start >= size || start > end) return new Response(null, { status: 416, headers: { ...out, 'content-range': `bytes */${size}` } });
  return new Response(audio.slice(start, end + 1), { status: 206, headers: { ...out, 'content-range': `bytes ${start}-${end}/${size}` } });
}

const patchOf = env => env.PATCH_WORLD.get(env.PATCH_WORLD.idFromName('patch'));

// Letters, the message board and who's signed in.
async function visitorApi(request, env, url, path) {
  const patch = patchOf(env);
  if (path === '/api/board' && request.method === 'GET') return json(await patch.board(url.searchParams.get('before')));
  if (request.method === 'POST' && request.headers.get('origin') !== SITE) return json({ error: 'Invalid origin.' }, 403);
  let who;
  try { who = await visitor(request, env); } catch { return json({ error: 'Account check is unavailable. Try again soon.' }, 503); }
  if (path === '/api/me' && request.method === 'GET') return json({ user: who && { name: who.name, admin: who.admin }, signIn: SIGN_IN });
  if (!who) return json({ error: 'Sign in to talk to Patch.', signIn: SIGN_IN }, 401);
  const send = ({ status, ...body }) => json(body, status);
  if (path === '/api/letters' && request.method === 'GET') return json({ letters: await patch.letters(who) });
  if (path === '/api/letters' && request.method === 'POST') return send(await patch.sendLetter(who, await readJson(request)));
  if (path === '/api/gifts' && request.method === 'GET') return json(await patch.gifts(who));
  if (path === '/api/gifts' && request.method === 'POST') return send(await patch.sendGift(who, (await readJson(request))?.kind));
  if (path === '/api/board' && request.method === 'POST') return send(await patch.sendPost(who, await readText(request)));
  if (path === '/api/push' && request.method === 'GET') return json(await patch.devices(who));
  if (path === '/api/push' && request.method === 'POST') return send(await patch.savePush(who, await readJson(request)));
  if (path === '/api/push/remove' && request.method === 'POST') return send(await patch.removePush(who, (await readJson(request))?.endpoint));
  const action = path.match(/^\/api\/board\/(post:[0-9a-z-]+)\/(report|block)$/);
  if (action && request.method === 'POST') return send(await (action[2] === 'report' ? patch.report(who, action[1]) : patch.block(who, action[1])));
  return json({ error: 'Not found.' }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // Patch's World used to be containedevolution.com/patch/. A copy saved there gets a service worker that clears it; everything else moves here.
    if (url.pathname === '/patch' || url.pathname.startsWith('/patch/')) {
      if (url.pathname === '/patch/sw.js') return new Response(RETIRE, { headers: { ...headers, 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-cache' } });
      return Response.redirect(`${SITE}${url.pathname.slice('/patch'.length) || '/'}${url.search}`, 301);
    }
    const path = url.pathname;

    if (path === '/api/state' || path === '/api/journal' || path === '/api/memory') {
      if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
      const patch = patchOf(env);
      return json(path === '/api/state' ? await patch.state() : path === '/api/journal' ? await patch.journal() : await patch.memory());
    }
    const voice = path.match(/^\/api\/voice\/([0-9a-z]{4,24})(\.mp3)?$/);
    if (voice) {
      if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
      const clip = await patchOf(env).voice(voice[1], Boolean(voice[2]));
      if (!clip) return json({ error: 'Not found.' }, 404);
      // A recording never changes, so browsers may keep it.
      const kept = { ...headers, 'cache-control': 'public, max-age=31536000, immutable' };
      return voice[2] ? audioResponse(request, clip.audio, kept) : Response.json(clip, { headers: kept });
    }
    if (path === '/api/me' || path === '/api/letters' || path === '/api/gifts' || path.startsWith('/api/board') || path.startsWith('/api/push')) return visitorApi(request, env, url, path);
    if (path.startsWith('/api/')) return json({ error: 'Not found.' }, 404);

    const assetUrl = new URL(path === '/' ? '/index.html' : path, url);
    const asset = await env.ASSETS.fetch(new Request(assetUrl, request));
    if (asset.status === 404 && (path === '/' || path === '/index.html'))
      return new Response(HOLDING, { headers: { ...headers, 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
    const out = new Headers(asset.headers);
    for (const [name, value] of Object.entries(headers)) out.set(name, value);
    // The service worker checks for a new island on every visit.
    if (path === '/sw.js') out.set('cache-control', 'no-cache');
    return new Response(asset.body, { status: asset.status, headers: out });
  },
};
