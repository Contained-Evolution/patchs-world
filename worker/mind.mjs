// Patch's mind. It wakes every 30–60 minutes while he's awake, thinks about his day,
// and can say something, ask his body for an activity, remember something or learn a word.
// In the evening it writes his diary with the higher-quality model.

import { CHILDHOOD, PERSONA, childhoodText } from './persona.mjs';
import { WANTS, TIME_ZONE, localMinutes } from './body.mjs';
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
  return { role: 'system', content: `${PERSONA}\n\nYour memories from before the island:\n${childhoodText()}` };
}

function dayNotes(body, mind, memories, now) {
  const since = mind.lastWake || now - 60 * MINUTE;
  const log = (body.log || []).filter(entry => entry.at >= since && !entry.target)
    .map(entry => `${clockWords(entry.at)}: ${entry.action} at the ${entry.place}`);
  const recentMemories = memories.slice(-12).map(memory => `- ${memory.title}: ${memory.text}`);
  const thoughts = (mind.thoughts || []).slice(-6).map(entry => `- ${clockWords(entry.at)}: ${entry.thought}`);
  const words = (mind.words || []).slice(-15).map(entry => `${entry.word} (${entry.meaning})`);
  return [
    `It is ${clockWords(now)}.`,
    `Right now you are: ${body.activity.action} at the ${body.activity.target || body.activity.place}.`,
    `How you feel (0 empty, 1 full): ${Object.entries(body.needs).map(([need, value]) => `${need} ${value.toFixed(2)}`).join(', ')}.`,
    log.length ? `What you did since you last stopped to think:\n${log.join('\n')}` : 'Nothing new since you last stopped to think.',
    recentMemories.length ? `Things you remember from the island:\n${recentMemories.join('\n')}` : 'You have no island memories yet. Everything is new.',
    thoughts.length ? `Your recent thoughts:\n${thoughts.join('\n')}` : '',
    words.length ? `Words you learned on the island: ${words.join(', ')}.` : '',
  ].filter(Boolean).join('\n\n');
}

const THINK_ASK = `Stop and think for a moment, as Patch. Reply with only a JSON object:
{
  "thought": "what you're thinking right now, 1-3 short sentences, in your own voice",
  "says": "something short you say out loud, or null",
  "want": "what you want to do next, one of: ${WANTS.join(', ')}; or null to let your body decide",
  "remember": null or { "category": "a memory category", "subcategory": "a smaller group", "title": "a few words", "text": "the memory in your words", "feeling": "one word" },
  "newWords": []
}
Only remember something if it really mattered today. Existing categories: ${Object.keys(STARTING_CATEGORIES).join(', ')}, island. You may make a new category when nothing fits.
newWords: only words you truly just learned, as { "word": "", "meaning": "in your words", "from": "who or what taught you" }.`;

const DIARY_ASK = `It's evening. Write in your diary about today, as Patch. Reply with only a JSON object:
{ "title": "a short title for today", "text": "your diary entry, 80-200 words, in your own voice", "newWords": [] }
Write only about things that really happened today (they're in your notes), and what you felt and wondered about.`;

function rememberMemory(memories, categories, raw, now) {
  if (!raw || typeof raw !== 'object') return null;
  const title = clean(raw.title, 80), text = clean(raw.text, 600);
  if (!title || !text) return null;
  const category = slug(raw.category) || 'island';
  const subcategory = clean(raw.subcategory, 40)?.toLowerCase() || 'everyday';
  if (!STARTING_CATEGORIES[category]) {
    const custom = categories[category] ||= { title: clean(raw.category, 40) || 'Island', subcategories: [] };
    if (!custom.subcategories.includes(subcategory)) custom.subcategories.push(subcategory);
  }
  const memory = { id: `island-${now}`, category, subcategory, title, text, age: 5, people: [], feeling: clean(raw.feeling, 20) || 'curious', source: 'island', at: now };
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

function spend(mind, cost, now) {
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
  if (overBudget(mind, now)) return;
  const notes = dayNotes(body, mind, memories, now);
  const { reply, cost, model } = await think(env, [systemMessage(), { role: 'user', content: `${notes}

${THINK_ASK}` }], 'everyday', 1500);
  spend(mind, cost, now);
  const thought = clean(reply.thought, 400), says = clean(reply.says, 160);
  if (thought) mind.thoughts = [...(mind.thoughts || []), { at: now, thought, says, model }].slice(-40);
  if (says) body.activity.says = says;
  if (WANTS.includes(reply.want)) body.want = reply.want;
  rememberMemory(memories, categories, reply.remember, now);
  learnWords(mind, reply.newWords, now);
  mind.lastWake = now;
}

// The evening diary, once a day, written before bed. Returns the entry or null.
export async function writeDiary(env, { body, mind, memories }, now) {
  const today = localDate(now);
  if (localMinutes(now) < DIARY_FROM || mind.diaryDate === today || overBudget(mind, now)) return null;
  const notes = dayNotes(body, { ...mind, lastWake: now - 14 * 60 * MINUTE }, memories, now);
  const { reply, cost, model } = await think(env, [systemMessage(), { role: 'user', content: `${notes}

${DIARY_ASK}` }], 'quality', 3000);
  spend(mind, cost, now);
  const title = clean(reply.title, 80), text = clean(reply.text, 2000);
  if (!title || !text) return null;
  mind.diaryDate = today;
  learnWords(mind, reply.newWords, now);
  return { date: today, title, text, model, at: now };
}

// When the mind should next wake, given the body.
export function nextWake(body, now, random = Math.random) {
  const { activity } = body;
  if (activity.action === 'sleep') return Math.max(activity.end + 2 * MINUTE, now + MINUTE);
  return now + (30 + Math.floor(random() * 31)) * MINUTE;
}

export function allMemories(island) {
  return [...CHILDHOOD, ...island];
}
