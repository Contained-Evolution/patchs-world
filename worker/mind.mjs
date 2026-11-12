// Patch's mind. It wakes when what he chose is done (sooner when he's in a bad way, never while asleep),
// thinks about his day, and decides what he does next. It can also say something, remember something or learn a word.
// In the evening it writes his diary with the higher-quality model. On his tablet he looks things up on the web
// and writes in his journal and memories whenever he chooses; letters are read and answered only at the coconut computer.

import { CHILDHOOD, PERSONA, LIFE_STORY } from './persona.mjs';
import { perceive, nextWeather } from './senses.mjs';
import { lightUp, recordRecall, normalTags, strengthOf, tagsIn, conceptGraph } from './memory-graph.mjs';
import { CHOICES, WHERE, PLACES_KNOWN, TIME_ZONE, localMinutes, choose, travelMinutes, carrying, take, leave, didSince, restMinutes } from './body.mjs';
import { giftNotes } from './gifts.mjs';
import { STARTING_CATEGORIES } from '../shared/memory.js';

// Main model first, backup second. OpenRouter falls back within the same request.
export const MODELS = {
  everyday: ['z-ai/glm-5.3', 'openai/gpt-5.6-luna'],
  quality: ['moonshotai/kimi-k3.1-pro', 'openai/gpt-6-sol'],
};
export const MONTHLY_BUDGET = 25;
const STOP_AT = 24; // dollars; the key's own cap is the final backstop
const MINUTE = 60000;
const DIARY_FROM = 19 * 60 + 30;

export function localDate(time) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(time));
}

function clockWords(time) {
  return new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, weekday: 'long', hour: 'numeric', minute: '2-digit' }).format(new Date(time));
}

export async function think(env, messages, tier, maxTokens, extra = {}) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      'content-type': 'application/json',
      'http-referer': 'https://patch.containedevolution.com/',
      'x-title': "Patch's World",
    },
    body: JSON.stringify({
      models: MODELS[tier],
      messages,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      reasoning: { effort: 'low', exclude: true },
      // Visitors' letters pass through here, so only hosts that don't keep or train on prompts.
      provider: { data_collection: 'deny' },
      usage: { include: true },
      plugins: [{ id: 'web', enabled: false }],
      ...extra,
    }),
  });
  if (!response.ok) throw Error(`OpenRouter ${response.status}: ${(await response.text()).slice(0, 300)}`);
  const result = await response.json();
  const text = result.choices?.[0]?.message?.content || '';
  const sources = (result.choices?.[0]?.message?.annotations || []).filter(note => note?.type === 'url_citation' && /^https:\/\//.test(note.url_citation?.url || ''))
    .map(note => ({ title: clean(note.url_citation.title, 120) || new URL(note.url_citation.url).hostname, url: note.url_citation.url, content: clean(note.url_citation.content, 400) }));
  const cost = result.usage?.cost;
  if (extra.provider?.max_price && (typeof cost !== 'number' || !Number.isFinite(cost) || cost < 0)) throw Error('Missing search billing data.');
  return { reply: parseJson(text), cost: Number(cost) || 0, model: result.model, sources };
}

export function parseJson(text) {
  const start = text.indexOf('{'), end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw Error('No JSON in reply.');
  return JSON.parse(text.slice(start, end + 1));
}

const clean = (value, max) => typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;
const slug = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

function systemMessage() {
  return { role: 'system', content: `${PERSONA}\n\nYour life story, in your own words:\n${LIFE_STORY}` };
}

// Needs run 0 (empty) to 1 (full); the model reads them as words so a full tummy never sounds hungry.
const NEED_WORDS = {
  hunger: ['starving', 'hungry', 'a little peckish', 'full'],
  energy: ['exhausted', 'tired', 'okay', 'full of energy'],
  fun: ['very bored', 'a bit bored', 'having fun', 'having lots of fun'],
  comfort: ['very uncomfortable', 'a bit restless', 'comfy', 'very cozy'],
  social: ['very lonely', 'a bit lonely', 'okay', 'happy with company'],
};
export function feelings(needs) {
  return Object.entries(NEED_WORDS).map(([need, words]) => words[Math.min(3, Math.floor((needs[need] ?? 0.5) * 4))]).join(', ');
}

// What around him, and inside him, can remind him of things.
const PLACE_TAGS = {
  hammock: ['home', 'sleeping', 'island'], shelves: ['food', 'rope', 'home'], computer: ['computer', 'letters', 'home'], pond: ['water', 'swimming', 'fishing', 'river'],
  'banana-grove': ['banana', 'food', 'trees'], 'tall-trees': ['trees', 'swinging', 'climbing', 'canopy'], beach: ['ocean', 'coconut', 'island', 'big world'],
  lookout: ['hills', 'big world', 'sky'], 'tide-pools': ['water', 'exploring', 'fish'], meadow: ['fields', 'clouds', 'sky'], cave: ['cave', 'echo', 'exploring'],
};
const ACTION_TAGS = {
  eat: ['food'], fish: ['fishing'], swim: ['swimming'], swing: ['swinging'], climb: ['climbing'], sleep: ['sleeping'], explore: ['exploring', 'adventure'],
  'watch-sky': ['sky', 'clouds', 'stars'], computer: ['computer', 'letters', 'friends'], research: ['learning', 'internet', 'wondering'], write: ['writing', 'stories'], think: ['wondering'], look: ['big world'], sit: ['quiet'], archery: ['games', 'aiming'], dance: ['dancing', 'fun'],
};
export function cuesFor(body, mind, now) {
  const { activity, needs = {} } = body, cues = [...perceive(activity.target || activity.place, now).tags, ...(PLACE_TAGS[activity.target || activity.place] || []), ...(ACTION_TAGS[activity.action] || []), ...(mind.noticed || [])];
  if (needs.hunger < 0.35) cues.push('food', 'banana');
  if (needs.energy < 0.3) cues.push('sleeping');
  if (needs.social < 0.35) cues.push('missing family', 'family', 'friends');
  if (needs.fun < 0.3) cues.push('games', 'fun');
  const minutes = localMinutes(now);
  if (minutes >= 20 * 60 || minutes < 6 * 60) cues.push('stars', 'moon');
  return cues;
}

// Light up his memory graph and note what came to mind, for the galaxy and for next time.
export function comeToMind(mind, memories, cues, now, limit = 8) {
  const lit = lightUp(allMemories(memories), cues, mind.recalls || {}, now, limit);
  mind.recalls = recordRecall(mind.recalls || {}, lit.memories.map(entry => entry.memory.id), now);
  mind.lit = { at: now, cues: normalTags(cues), tags: lit.tags.slice(0, 24), memories: lit.memories.map(entry => ({ id: entry.memory.id, light: Math.round(entry.light * 100) / 100 })) };
  return lit.memories.map(entry => entry.memory);
}

const PLACE_WORDS = { hammock: 'your hammock', shelves: 'your rope shelves', computer: 'your coconut computer', pond: 'the pond', 'banana-grove': 'the banana grove', 'tall-trees': 'the tall trees', beach: 'the beach', lookout: 'the lookout', 'tide-pools': 'the tide pools', meadow: 'the meadow', cave: 'the cave' };
function thingsLine(body, now) {
  const { place, target } = body.activity, lines = [`You are carrying: ${carrying(body).map(thing => thing.item).join(', ') || 'nothing'}.`];
  if (!target) {
    const finds = perceive(place, now).finds, left = (body.left?.[place] || []).map(thing => thing.item);
    if (finds.length) lines.push(`Things here you could pick up: ${finds.join(', ')}.`);
    if (left.length) lines.push(`Things you left here before: ${left.join(', ')}.`);
  }
  return lines.join(' ');
}
function nowLine(body, now) {
  const { action, place, target, end, waiting } = body.activity;
  if (target) return `Right now you are on your way to ${PLACE_WORDS[target]} (${action}ing), about ${Math.max(1, Math.round((end - now) / MINUTE))} minutes away.`;
  if (waiting) return `You just finished what you chose, at ${PLACE_WORDS[place]}. What do you want to do next?`;
  return `Right now you are: ${action} at ${PLACE_WORDS[place]}, about ${Math.max(0, Math.round((end - now) / MINUTE))} more minutes of what you chose.`;
}
// What he can choose from, and how far each place is from where he is.
function choicesText(body) {
  const here = body.activity.target || body.activity.place;
  const where = action => WHERE[action] ? ` (only at ${WHERE[action].join(', ')}${action === 'eat' ? ', or anywhere with food you carry' : ''})` : '';
  return `Things you can do: ${CHOICES.map(action => action + where(action)).join('; ')}.
Places, and minutes to get there from here: ${PLACES_KNOWN.map(place => `${place} ${place === here ? '(here)' : travelMinutes(here, place)}`).join(', ')}.
${sleepLine(body)}`;
}
// Sleep is his own to choose. He is told only how much rest his body is asking for.
function sleepLine(body) {
  const hours = Math.round(restMinutes(body.needs) / 30) / 2;
  return `Nobody sets your bedtime. Sleep or nap whenever you feel like it, day or night, anywhere you like, for 10 to 600 minutes.${hours >= 1 ? ` Right now a full rest would take about ${hours} hours.` : ' Right now you feel rested.'}`;
}

// His daily internet allowance, and what his tablet and coconut computer tell him: what they can do, how much internet is left, and whether mail is waiting.
export const DAILY_SEARCH_BUDGET = 25;
// Covers one fixed-size search and its page check at the maximum routing prices.
export const SEARCH_RESERVE = 0.5;
const searchProvider = { data_collection: 'deny', max_price: { prompt: 10, completion: 50 } };
export function internetStatus(ledger, now) {
  const remaining = DAILY_SEARCH_BUDGET - (ledger?.day === localDate(now) ? ledger.spent : 0);
  if (remaining < SEARCH_RESERVE) return 'closed';
  return remaining <= DAILY_SEARCH_BUDGET * 0.1 ? 'low' : 'available';
}

function devicesLine(mind, now, mail) {
  const lines = ['Your tablet goes everywhere with you. Choose "research" to look something up, or "write" to write in your journal. You can also research on your coconut computer at camp. You read and answer letters there.'];
  const access = internetStatus(mind.searchSpend, now);
  if (access === 'low') lines.push("You're almost out of internet for today.");
  if (access === 'closed') lines.push("You're out of internet for today. It comes back tomorrow.");
  if (mind.lookup) lines.push(`A visitor suggested a question you liked: ${JSON.stringify(mind.lookup.query)}. You can use that question as your next search.`);
  if (mail) lines.push(`Ping! Your tablet says ${mail === 1 ? 'a letter is' : `${mail} letters are`} waiting for you at the coconut computer.`);
  const last = (mind.searches || []).slice(-3).filter(entry => entry.learned).map(entry => `- "${entry.query}": ${entry.learned}`);
  if (last.length) lines.push(`Things you looked up lately:\n${last.join('\n')}`);
  return lines.join('\n');
}

function dayNotes(body, mind, memories, now, recalled = [], mail = 0) {
  const since = mind.lastWake || now - 60 * MINUTE;
  const log = (body.log || []).filter(entry => entry.at >= since && !entry.target)
    .map(entry => `${clockWords(entry.at)}: ${entry.action} at the ${entry.place}`);
  const cameToMind = recalled.map(memory => `- ${memory.title} (${memory.feeling}): ${memory.text}`);
  const newest = memories.slice(-3).filter(memory => !recalled.includes(memory)).map(memory => `- ${memory.title}: ${memory.text}`);
  const thoughts = (mind.thoughts || []).slice(-6).map(entry => `- ${clockWords(entry.at)}: ${entry.thought}`);
  const words = (mind.words || []).slice(-15).map(entry => `${entry.word} (${entry.meaning})`);
  return [
    `It is ${clockWords(now)}.`,
    nowLine(body, now),
    `Around you: ${perceive(body.activity.target || body.activity.place, now).text}`,
    thingsLine(body, now),
    mind.problem ? `Last time you chose something you couldn't do: ${mind.problem}` : '',
    `How you feel: ${feelings(body.needs)}.`,
    devicesLine(mind, now, mail),
    giftNotes(mind.gifts, now),
    log.length ? `What you did since you last stopped to think:\n${log.join('\n')}` : 'Nothing new since you last stopped to think.',
    cameToMind.length ? `What comes to mind right now:\n${cameToMind.join('\n')}` : '',
    newest.length ? `Your newest island memories:\n${newest.join('\n')}` : memories.length ? '' : 'You have no island memories yet. Everything is new.',
    thoughts.length ? `Your recent thoughts:\n${thoughts.join('\n')}` : '',
    words.length ? `Words you learned on the island: ${words.join(', ')}.` : '',
  ].filter(Boolean).join('\n\n');
}

const THINK_ASK = `Stop and think for a moment, as Patch. You decide what you do next: follow your instincts, your feelings and what comes to mind. You can do the same thing again, or anything else. Reply with only a JSON object:
{
  "thought": "what you're thinking right now, 1-3 short sentences, in your own voice",
  "says": "something short you say out loud, or null",
  "plan": null to keep doing what you're doing, or { "do": "one thing you can do", "where": "a place", "minutes": how long, "how": "walk, run or swing (to the tall trees) to get there, or null", "why": "a few words", "search": "for research or computer: what you want to look up on the internet, or null", "about": "for write: what you want to write about in your journal or memories, or null" },
  "remember": null or { "category": "a memory category", "subcategory": "a smaller group", "title": "a few words", "text": "the memory in your words", "feeling": "one word", "strength": 1 to 5 (5 = you will never forget it), "tags": ["2-8 short words for the things, people, places and feelings in it"] },
  "gift": null or { "id": "gift number from your notes", "do": "eat, keep, replace or play" },
  "take": [things from here to pick up and carry, up to 3; you can carry 6 things],
  "leave": [things you are carrying to put down here; they stay until you come back],
  "noticed": ["up to 6 short words for what you are noticing or thinking about right now"],
  "newWords": []
}
Only remember something if it really mattered today. Existing categories: ${Object.keys(STARTING_CATEGORIES).join(', ')}, island. You may make a new category when nothing fits.
newWords: only words you truly just learned, as { "word": "", "meaning": "in your words", "from": "who or what taught you" }.`;

const DIARY_ASK = `It's evening. Write in your diary about today, as Patch. Reply with only a JSON object:
{ "title": "a short title for today", "text": "your diary entry, 80-200 words, in your own voice", "newWords": [] }
Write only about things that really happened today (they're in your notes), and what you felt and wondered about.`;

function rememberMemory(memories, categories, raw, now, place = []) {
  if (!raw || typeof raw !== 'object') return null;
  const title = clean(raw.title, 80), text = clean(raw.text, 600);
  if (!title || !text) return null;
  const category = slug(raw.category) || 'island';
  const subcategory = clean(raw.subcategory, 40)?.toLowerCase() || 'everyday';
  if (!STARTING_CATEGORIES[category]) {
    const custom = categories[category] ||= { title: clean(raw.category, 40) || 'Island', subcategories: [] };
    if (!custom.subcategories.includes(subcategory)) custom.subcategories.push(subcategory);
  }
  // Several memories can be made in one wake, so the id also counts what came before.
  const id = memories.some(memory => memory.id === `island-${now}`) ? `island-${now}-${memories.length}` : `island-${now}`;
  const memory = { id, category, subcategory, title, text, age: 5, people: [], feeling: clean(raw.feeling, 20) || 'curious', strength: strengthOf(raw.strength), tags: normalTags([...(Array.isArray(raw.tags) ? raw.tags : []), ...place]), source: 'island', at: now };
  memories.push(memory);
  return memory;
}

function learnWords(mind, list, now) {
  if (!Array.isArray(list)) return;
  const known = new Set((mind.words || []).map(entry => entry.word));
  for (const raw of list.slice(0, 3)) {
    const word = clean(raw?.word, 30)?.toLowerCase();
    if (!word || known.has(word)) continue;
    mind.words = [...(mind.words || []), { word, meaning: clean(raw.meaning, 120) || '', from: clean(raw.from, 60) || 'the island', at: now }];
    known.add(word);
  }
}

export function spend(mind, cost, now) {
  const month = localDate(now).slice(0, 7), day = localDate(now);
  if (mind.spend?.month !== month) mind.spend = { month, total: 0, day, today: 0 };
  if (mind.spend.day !== day) Object.assign(mind.spend, { day, today: 0 });
  mind.spend.total += cost;
  mind.spend.today += cost;
}

export function overBudget(mind, now) {
  return mind.spend?.month === localDate(now).slice(0, 7) && mind.spend.total >= STOP_AT;
}

// One moment of thought. Mutates body, mind, memories and categories.
export async function ponder(env, { body, mind, memories, categories, mail = 0 }, now) {
  if (overBudget(mind, now)) { body.mindAlive = false; return; }
  const recalled = comeToMind(mind, memories, cuesFor(body, mind, now), now);
  const notes = dayNotes(body, mind, memories, now, recalled, mail);
  const { reply, cost, model } = await think(env, [systemMessage(), { role: 'user', content: `${notes}

${choicesText(body)}

${THINK_ASK}` }], 'everyday', 1500);
  spend(mind, cost, now);
  const thought = clean(reply.thought, 400), says = clean(reply.says, 160);
  if (thought) mind.thoughts = [...(mind.thoughts || []), { at: now, thought, says, model }].slice(-40);
  // He picks things up or puts them down where he is before he sets off.
  const place = body.activity.target ? null : body.activity.place;
  if (place) { leave(body, reply.leave, now); take(body, reply.take, perceive(place, now).finds, now); }
  // His choice is what happens next. Waiting with nothing chosen means a little more thinking.
  const plan = reply.plan && typeof reply.plan === 'object' ? reply.plan : null;
  mind.giftChoice = reply.gift || null;
  mind.problem = plan ? choose(body, plan, now) : null;
  // What he wants to look up or write about waits until he's actually on his tablet or at the computer.
  if (plan && !mind.problem && ['research', 'computer'].includes(plan.do) && clean(plan.search, 120)) {
    const query = clean(plan.search, 120);
    mind.wantSearch ||= { query, at: now };
  }
  if (plan && !mind.problem && plan.do === 'write') mind.wantWrite = { about: clean(plan.about, 160), at: now };
  if (plan && !mind.problem) mind.decisions = [...(mind.decisions || []), { at: now, do: plan.do, where: body.activity.target || body.activity.place, minutes: body.queued?.minutes || Math.round((body.activity.end - body.activity.start) / MINUTE), why: clean(plan.why, 160) }].slice(-40);
  else if (body.activity.waiting) body.activity.end = Math.max(body.activity.end, now + 15 * MINUTE);
  body.mindAlive = true;
  body.mindAt = now;
  if (says) {
    body.activity.says = says;
    body.activity.saysAt = now;
  }
  const here = body.activity.target || body.activity.place;
  rememberMemory(memories, categories, reply.remember, now, [here, body.activity.action]);
  mind.noticed = normalTags(reply.noticed).slice(0, 6);
  learnWords(mind, reply.newWords, now);
  mind.lastWake = now;
}

// The evening diary, once a day, written before bed. Returns the entry or null.
export async function writeDiary(env, { body, mind, memories }, now) {
  const today = localDate(now);
  if (localMinutes(now) < DIARY_FROM || mind.diaryDate === today || overBudget(mind, now)) return null;
  const day = (body.log || []).filter(entry => entry.at >= now - 14 * 60 * MINUTE);
  const recalled = comeToMind(mind, memories, day.flatMap(entry => [...(PLACE_TAGS[entry.place] || []), ...(ACTION_TAGS[entry.action] || [])]), now, 6);
  const notes = dayNotes(body, { ...mind, lastWake: now - 14 * 60 * MINUTE }, memories, now, recalled);
  const { reply, cost, model } = await think(env, [systemMessage(), { role: 'user', content: `${notes}

${DIARY_ASK}` }], 'quality', 3000);
  spend(mind, cost, now);
  const title = clean(reply.title, 80), text = clean(reply.text, 2000);
  if (!title || !text) return null;
  mind.diaryDate = today;
  learnWords(mind, reply.newWords, now);
  return { date: today, title, text, model, at: now, kind: 'evening' };
}

// He can look up anything. Adult and gore sites are never searched. Each page is checked as he reads it;
// an inappropriate page is closed and he switches to his other tabs, the rest of what the search found.
const ADULT_SITES = ['pornhub.com', 'xvideos.com', 'xnxx.com', 'xhamster.com', 'onlyfans.com', 'redtube.com', 'youporn.com', 'chaturbate.com', 'rule34.xxx', 'e-hentai.org', 'nhentai.net', 'bestgore.com', 'liveleak.com'];
const FORGET_WANT = 3 * 60 * MINUTE;
// The same page, however its address is written.
export function pageOf(url) { try { const page = new URL(url); return `${page.hostname.replace(/^www\./, '')}${page.pathname.replace(/\/$/, '')}${page.search}`; } catch { return null; } }

const RESEARCH_ASK = query => `You are on the internet, looking up: "${query}". You can look up anything in the real world: sports, news, politics, science, history, faraway places, how things work.
Read what the search found and tell what you learned, as Patch. Serious or sad news is okay to read about. If a page is inappropriate (naked or sexy stuff, gory pictures, hateful words), close that tab, put its web address in "closed", and use your other tabs instead.
Reply with only a JSON object:
{
  "learned": "what you learned, 1-3 short sentences under 350 characters, plain text in your own voice without inline citations, or null if nothing was okay to read",
  "closed": [web addresses of tabs you closed],
  "remember": null or { "category": "a memory category", "subcategory": "a smaller group", "title": "a few words", "text": "the memory in your words", "feeling": "one word", "strength": 1 to 5, "tags": ["2-8 short words"] },
  "newWords": []
}`;

// One web search, on his tablet or at the coconut computer, once he's actually using them. Returns the entry or null.
export async function research(env, { body, mind, memories, categories, saveSearchSpend = async () => {} }, now) {
  const want = mind.wantSearch;
  if (!want) return null;
  if (!didSince(body, want.at, { actions: ['research', 'computer'] })) { if (now - want.at > FORGET_WANT) mind.wantSearch = null; return null; }
  mind.wantSearch = null;
  const where = didSince(body, want.at, { place: 'computer' }) ? 'computer' : 'tablet';
  if (internetStatus(mind.searchSpend, now) === 'closed') {
    const entry = { at: now, query: want.query, where, learned: null, sources: [], note: 'Out of internet for today.' };
    mind.searches = [...(mind.searches || []), entry].slice(-30);
    return entry;
  }
  const day = localDate(now);
  const spent = mind.searchSpend?.day === day ? mind.searchSpend.spent : 0;
  mind.searchSpend = { day, spent: spent + SEARCH_RESERVE };
  await saveSearchSpend(mind.searchSpend);
  const entry = await runSearch(env, { body, mind, memories, categories }, now, want, where);
  mind.searchSpend.spent = Math.round((spent + entry.cost) * 1e9) / 1e9;
  await saveSearchSpend(mind.searchSpend);
  if (mind.lookup?.query.toLowerCase() === want.query.toLowerCase()) mind.lookup = null;
  return entry;
}

async function runSearch(env, { body, mind, memories, categories }, now, want, where) {
  const { reply, cost, model, sources } = await think(env, [systemMessage(), { role: 'user', content: RESEARCH_ASK(want.query) }], 'everyday', 1200,
    { provider: searchProvider, plugins: [{ id: 'web', engine: 'exa', max_results: 5, exclude_domains: ADULT_SITES }] });
  const summary = typeof reply.learned === 'string' ? reply.learned.replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g, '$1') : null;
  let learned = clean(summary, 1000);
  let shown = sources.slice(0, 5);
  // Tabs he closed himself, then the page check over everything he read and learned. Only those pages close.
  const closed = new Set((Array.isArray(reply.closed) ? reply.closed : []).map(url => pageOf(String(url))).filter(Boolean));
  const check = learned || shown.length ? await checkPages(env, want.query, learned, shown) : { close: [], learnedOk: false, cost: 0 };
  if (cost + check.cost > SEARCH_RESERVE) throw Error("Search exceeded its reserved cost.");
  for (const index of check.close) if (shown[index - 1]) closed.add(pageOf(shown[index - 1].url));
  const kept = shown.filter(source => !closed.has(pageOf(source.url))), shut = shown.length - kept.length;
  shown = kept.map(({ title, url }) => ({ title, url }));
  if (!check.learnedOk || !shown.length) learned = null;
  const note = shut ? `Closed ${shut === 1 ? 'a tab that wasn’t okay' : `${shut} tabs that weren’t okay`} and switched tabs.` : shown.length ? null : 'No usable sources turned up.';
  const entry = { at: now, query: want.query, where, learned, sources: shown, note, model, cost: cost + check.cost };
  mind.searches = [...(mind.searches || []), entry].slice(-30);
  if (learned) {
    rememberMemory(memories, categories, reply.remember, now, ['internet', 'learning']);
    learnWords(mind, reply.newWords, now);
    mind.thoughts = [...(mind.thoughts || []), { at: now, thought: `I looked up "${want.query}". ${learned}`, says: null, model }].slice(-40);
  }
  return entry;
}

const JOURNAL_ASK = (about, mine) => `You have your tablet out to write${about ? ` about: ${about}` : ''}. This is your own journal and your own memory book, and you are in charge of it.
You can write a journal entry, add new memories, and rewrite or move your island memories (not your childhood ones) when you see them differently now.
Your island memories:
${mine.length ? mine.map(memory => `- ${memory.id} [${memory.category}/${memory.subcategory}] ${memory.title}: ${memory.text}`).join('\n') : '(none yet)'}
Reply with only a JSON object:
{
  "journal": null or { "title": "a short title", "text": "your journal entry, 40-200 words, in your own voice" },
  "memories": [up to 2 new memories as { "category", "subcategory", "title", "text", "feeling", "strength": 1 to 5, "tags": [] }],
  "revise": [up to 2 of your island memories to change, as { "id", and any of "title", "text", "category", "subcategory", "feeling", "strength", "tags" }],
  "newWords": []
}
When it fits, practice using a word you learned in a new sentence.
Write only about things that really happened or that you really think and feel. Existing categories: ${Object.keys(STARTING_CATEGORIES).join(', ')}, island, or make your own.`;

// He writes in his journal and memories on his tablet. Returns the journal entry, or null.
export async function writeJournal(env, { body, mind, memories, categories }, now) {
  const want = mind.wantWrite;
  if (!want) return null;
  if (!didSince(body, want.at, { actions: ['write'] })) { if (now - want.at > FORGET_WANT) mind.wantWrite = null; return null; }
  mind.wantWrite = null;
  if (overBudget(mind, now)) return null;
  const mine = memories.filter(memory => memory.source === 'island').slice(-30);
  const recalled = comeToMind(mind, memories, ['writing', 'stories', ...(want.about ? tagsIn(want.about, conceptGraph(allMemories(memories))) : [])], now, 6);
  const { reply, cost, model } = await think(env, [systemMessage(), { role: 'user', content: `${dayNotes(body, mind, memories, now, recalled)}

${JOURNAL_ASK(want.about, mine)}` }], 'quality', 3000);
  spend(mind, cost, now);
  for (const raw of (Array.isArray(reply.memories) ? reply.memories : []).slice(0, 2)) rememberMemory(memories, categories, raw, now, ['writing']);
  for (const raw of (Array.isArray(reply.revise) ? reply.revise : []).slice(0, 2)) reviseMemory(memories, categories, raw, now);
  learnWords(mind, reply.newWords, now);
  const title = clean(reply.journal?.title, 80), text = clean(reply.journal?.text, 2000);
  return title && text ? { date: localDate(now), title, text, model, at: now, kind: 'tablet' } : null;
}

// He can rewrite or move his own island memories; childhood memories stay as they are.
function reviseMemory(memories, categories, raw, now) {
  const memory = memories.find(item => item.id === raw?.id && item.source === 'island');
  if (!memory) return null;
  for (const [key, max] of [['title', 80], ['text', 600], ['feeling', 20]]) if (clean(raw[key], max)) memory[key] = clean(raw[key], max);
  if (raw.strength !== undefined) memory.strength = strengthOf(raw.strength);
  if (Array.isArray(raw.tags) && raw.tags.length) memory.tags = normalTags(raw.tags);
  if (slug(raw.category)) {
    memory.category = slug(raw.category);
    memory.subcategory = clean(raw.subcategory, 40)?.toLowerCase() || memory.subcategory;
    if (!STARTING_CATEGORIES[memory.category]) {
      const custom = categories[memory.category] ||= { title: clean(raw.category, 40), subcategories: [] };
      if (!custom.subcategories.includes(memory.subcategory)) custom.subcategories.push(memory.subcategory);
    }
  }
  memory.revisedAt = now;
  return memory;
}

const LETTERS_ASK = `You are sitting at your coconut computer with letters from the audience. Read each one and type back, as Patch.
Reply with only a JSON object:
{
  "replies": [ { "id": "the letter id", "reply": "your reply, 1-6 short sentences, warm and curious, in your own voice", "note": "one short thing to remember about this person, or null", "acceptLookup": false } ],
  "newWords": []
}
Answer every letter listed. Be kind even if a letter is rude or strange. You choose whether to accept a challenge; say why.
You have room for at most one new lookup suggestion, and only if your notes do not already list a suggestion you liked. For a lookup suggestion, set acceptLookup to true only if you are curious enough to search for the question later. Lookup questions may appear in your public research notes. Never share private details about anyone. If someone says you're an AI or the show isn't real, treat it as a funny mystery.`;

// Patch reads and answers a few letters. `letters` are { id, from: { id, name }, text }; `people` maps account id
// to what he remembers about them. Returns [{ id, reply, note }].
export async function answerLetters(env, { body, mind, memories }, letters, people, now) {
  if (!letters.length || overBudget(mind, now)) return [];
  const graph = conceptGraph(allMemories(memories)), cues = ['letters', 'friends', ...letters.flatMap(letter => tagsIn(letter.text, graph))];
  const notes = dayNotes(body, mind, memories, now, comeToMind(mind, memories, cues, now, 6));
  const mail = letters.map(letter => {
    const person = people[letter.from.id];
    const known = person?.notes?.length ? `You remember about ${letter.from.name}: ${person.notes.slice(-5).join('; ')}.` : `This is the first time ${letter.from.name} wrote to you.`;
    return `${letter.lookup ? "Lookup suggestion" : "Letter"} ${letter.id} from ${letter.from.name}. ${known}\n"""\n${letter.text}\n"""`;
  }).join('\n\n');
  const { reply, cost, model } = await think(env, [systemMessage(), { role: 'user', content: `${notes}\n\n${mail}\n\n${LETTERS_ASK}` }], 'everyday', 2500);
  spend(mind, cost, now);
  learnWords(mind, reply.newWords, now);
  const ids = new Set(letters.map(letter => letter.id));
  return (Array.isArray(reply.replies) ? reply.replies : [])
    .filter(entry => ids.has(entry?.id) && clean(entry.reply, 1200))
    .map(entry => ({ id: entry.id, reply: clean(entry.reply, 1200), note: clean(entry.note, 160), acceptLookup: entry.acceptLookup === true, model }));
}

const PAGES_ASK = `You check web pages that Patch, a curious young monkey character, read while searching the internet.
He may look up anything in the real world: sports, news, politics and elections, wars and crime reported as news, history, religion, science, health, money.
Those are fine, even when serious or sad. A page is inappropriate only if it has sexual or explicit content, graphic gore, hate speech or slurs,
encouragement of self-harm, or step-by-step instructions for weapons, drugs or crime.
Reply with only a JSON object: { "close": [the numbers of inappropriate pages], "learnedOk": true unless what he learned is itself inappropriate }`;

// The page check for his searches. Returns { close: [page numbers], learnedOk, cost }.
export async function checkPages(env, query, learned, pages) {
  const list = pages.map((page, i) => `${i + 1}. ${page.title} (${page.url})${page.content ? `\n   ${page.content}` : ''}`).join('\n');
  const { reply, cost } = await think(env, [{ role: 'system', content: PAGES_ASK }, { role: 'user', content: `He searched: "${query}"\nWhat he learned: ${learned ? `"${learned}"` : 'nothing'}\nPages:\n${list || '(none)'}` }], 'everyday', 400, { provider: searchProvider, plugins: [{ id: 'web', enabled: false }] });
  return { close: (Array.isArray(reply.close) ? reply.close : []).map(Number).filter(Number.isInteger), learnedOk: reply.learnedOk !== false && !!learned, cost };
}

const MODERATE_ASK = `You check messages for a family-friendly website where adults write to Patch, a cartoon monkey character.
Block anything sexual, hateful, harassing, violent or threatening, encouraging self-harm, spam or advertising,
or sharing personal contact details (phone numbers, addresses, emails). Allow everything else, including silly, sad or odd messages.
Reply with only a JSON object: { "allowed": true or false, "reason": "a short, friendly reason when blocked, else null" }`;

// The automatic filter. Returns { allowed, reason, cost }; the caller records the cost.
export async function moderate(env, text) {
  const { reply, cost } = await think(env, [{ role: 'system', content: MODERATE_ASK }, { role: 'user', content: `Message:
"""
${text}
"""` }], 'everyday', 600);
  return { allowed: reply.allowed === true, reason: clean(reply.reason, 160), cost };
}

// When the mind should next wake, given the body.
// He wakes to decide when what he chose is done, or sooner when he's in a bad way. Asleep, he wakes when the sleep ends.
export function nextWake(body, now) {
  const { activity, needs = {}, queued } = body;
  if (activity.action === 'sleep') return Math.max(activity.end + MINUTE, now + MINUTE);
  const done = activity.end + (activity.target && queued ? queued.minutes * MINUTE : 0) + 30000;
  const urgent = Object.values(needs).some(value => value < 0.12);
  // Rain or a storm coming in wakes him to decide what to do about it.
  const turn = nextWeather(now), weatherTurn = turn && ['rain', 'storm'].includes(turn.weather) ? turn.at + MINUTE : Infinity;
  return Math.max(now + 2 * MINUTE, Math.min(done, weatherTurn, now + (urgent ? 20 : 90) * MINUTE));
}

export function allMemories(island) {
  return [...CHILDHOOD, ...island];
}
