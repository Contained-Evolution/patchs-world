// Patch's mind. It wakes when what he chose is done (sooner when he's in a bad way, never while asleep),
// thinks about his day, and decides what he does next. It can also say something, remember something or learn a word.
// In the evening it writes his diary with the higher-quality model.

import { CHILDHOOD, PERSONA, LIFE_STORY } from './persona.mjs';
import { perceive, nextWeather } from './senses.mjs';
import { lightUp, recordRecall, normalTags, strengthOf, tagsIn, conceptGraph } from './memory-graph.mjs';
import { CHOICES, WHERE, PLACES_KNOWN, TIME_ZONE, localMinutes, choose, travelMinutes, carrying, take, leave } from './body.mjs';
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

export async function think(env, messages, tier, maxTokens) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      'content-type': 'application/json',
      'http-referer': 'https://tenari.world/patch/',
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
    }),
  });
  if (!response.ok) throw Error(`OpenRouter ${response.status}: ${(await response.text()).slice(0, 300)}`);
  const result = await response.json();
  const text = result.choices?.[0]?.message?.content || '';
  return { reply: parseJson(text), cost: Number(result.usage?.cost) || 0, model: result.model };
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
  hammock: ['home', 'sleeping', 'island'], shelves: ['food', 'rope', 'home'], pond: ['water', 'swimming', 'fishing', 'river'],
  'banana-grove': ['banana', 'food', 'trees'], 'tall-trees': ['trees', 'swinging', 'climbing', 'canopy'], beach: ['ocean', 'coconut', 'island', 'big world'],
  lookout: ['hills', 'big world', 'sky'], 'tide-pools': ['water', 'exploring', 'fish'], meadow: ['fields', 'clouds', 'sky'], cave: ['cave', 'echo', 'exploring'],
};
const ACTION_TAGS = {
  eat: ['food'], fish: ['fishing'], swim: ['swimming'], swing: ['swinging'], climb: ['climbing'], sleep: ['sleeping'], explore: ['exploring', 'adventure'],
  'watch-sky': ['sky', 'clouds', 'stars'], phone: ['device', 'letters'], think: ['wondering'], look: ['big world'], sit: ['quiet'],
};
export function cuesFor(body, mind, now) {
  const { activity, needs = {} } = body, cues = [...perceive(activity.target || activity.place, now).tags, ...(PLACE_TAGS[activity.target || activity.place] || []), ...(ACTION_TAGS[activity.action] || []), ...(mind.noticed || [])];
  if (needs.hunger < 0.35) cues.push('food', 'banana');
  if (needs.energy < 0.3) cues.push('sleeping');
  if (needs.social < 0.35) cues.push('missing family', 'family', 'friends');
  if (needs.fun < 0.3) cues.push('games', 'fun');
  const minutes = localMinutes(now);
  if (minutes >= 20 * 60 || minutes < 6 * 60) cues.push('stars', 'moon', 'goodnight');
  return cues;
}

// Light up his memory graph and note what came to mind, for the galaxy and for next time.
export function comeToMind(mind, memories, cues, now, limit = 8) {
  const lit = lightUp(allMemories(memories), cues, mind.recalls || {}, now, limit);
  mind.recalls = recordRecall(mind.recalls || {}, lit.memories.map(entry => entry.memory.id), now);
  mind.lit = { at: now, cues: normalTags(cues), tags: lit.tags.slice(0, 24), memories: lit.memories.map(entry => ({ id: entry.memory.id, light: Math.round(entry.light * 100) / 100 })) };
  return lit.memories.map(entry => entry.memory);
}

const PLACE_WORDS = { hammock: 'your hammock', shelves: 'your rope shelves', pond: 'the pond', 'banana-grove': 'the banana grove', 'tall-trees': 'the tall trees', beach: 'the beach', lookout: 'the lookout', 'tide-pools': 'the tide pools', meadow: 'the meadow', cave: 'the cave' };
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
Places, and minutes to get there from here: ${PLACES_KNOWN.map(place => `${place} ${place === here ? '(here)' : travelMinutes(here, place)}`).join(', ')}.`;
}

function dayNotes(body, mind, memories, now, recalled = []) {
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
  "plan": null to keep doing what you're doing, or { "do": "one thing you can do", "where": "a place", "minutes": how long, "how": "walk, run or swing (to the tall trees) to get there, or null", "why": "a few words" },
  "remember": null or { "category": "a memory category", "subcategory": "a smaller group", "title": "a few words", "text": "the memory in your words", "feeling": "one word", "strength": 1 to 5 (5 = you will never forget it), "tags": ["2-8 short words for the things, people, places and feelings in it"] },
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
  const memory = { id: `island-${now}`, category, subcategory, title, text, age: 5, people: [], feeling: clean(raw.feeling, 20) || 'curious', strength: strengthOf(raw.strength), tags: normalTags([...(Array.isArray(raw.tags) ? raw.tags : []), ...place]), source: 'island', at: now };
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
export async function ponder(env, { body, mind, memories, categories }, now) {
  if (overBudget(mind, now)) { body.mindAlive = false; return; }
  const recalled = comeToMind(mind, memories, cuesFor(body, mind, now), now);
  const notes = dayNotes(body, mind, memories, now, recalled);
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
  mind.problem = plan ? choose(body, plan, now) : null;
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
  return { date: today, title, text, model, at: now };
}

const LETTERS_ASK = `You found letters from the audience on your device. Read each one and write back, as Patch.
Reply with only a JSON object:
{
  "replies": [ { "id": "the letter id", "reply": "your reply, 1-6 short sentences, warm and curious, in your own voice", "note": "one short thing to remember about this person, or null" } ],
  "newWords": []
}
Answer every letter listed. Be kind even if a letter is rude or strange. You choose whether to accept a challenge; say why.
Never share private details about anyone. If someone says you're an AI or the show isn't real, treat it as a funny mystery.`;

// Patch reads and answers a few letters. `letters` are { id, from: { id, name }, text }; `people` maps account id
// to what he remembers about them. Returns [{ id, reply, note }].
export async function answerLetters(env, { body, mind, memories }, letters, people, now) {
  if (!letters.length || overBudget(mind, now)) return [];
  const graph = conceptGraph(allMemories(memories)), cues = ['letters', 'friends', ...letters.flatMap(letter => tagsIn(letter.text, graph))];
  const notes = dayNotes(body, mind, memories, now, comeToMind(mind, memories, cues, now, 6));
  const mail = letters.map(letter => {
    const person = people[letter.from.id];
    const known = person?.notes?.length ? `You remember about ${letter.from.name}: ${person.notes.slice(-5).join('; ')}.` : `This is the first time ${letter.from.name} wrote to you.`;
    return `Letter ${letter.id} from ${letter.from.name}. ${known}\n"""\n${letter.text}\n"""`;
  }).join('\n\n');
  const { reply, cost, model } = await think(env, [systemMessage(), { role: 'user', content: `${notes}\n\n${mail}\n\n${LETTERS_ASK}` }], 'everyday', 2500);
  spend(mind, cost, now);
  learnWords(mind, reply.newWords, now);
  const ids = new Set(letters.map(letter => letter.id));
  return (Array.isArray(reply.replies) ? reply.replies : [])
    .filter(entry => ids.has(entry?.id) && clean(entry.reply, 1200))
    .map(entry => ({ id: entry.id, reply: clean(entry.reply, 1200), note: clean(entry.note, 160), model }));
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
