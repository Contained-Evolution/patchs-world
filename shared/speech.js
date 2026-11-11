// What Patch says out loud, shared by the Worker (which schedules it) and the browser (which voices and animates it).
// A timing is { chars, starts, ends }: each character of the spoken text and when it is said, in milliseconds.

// Speech is announced this long before it starts, so every visitor's next poll can load the recording in time.
export const SPEECH_LEAD = 6000;
const GAP = 900;

const PAUSES = { ',': 3, ';': 3.5, ':': 3.5, '—': 3, '.': 5, '!': 5, '?': 5, '…': 6, '\n': 5 };
const weight = char => PAUSES[char] ?? (char === ' ' ? .55 : /[aeiouy]/i.test(char) ? 1.2 : /[a-z0-9']/i.test(char) ? .9 : .4);

// How long a line takes when there is no recording: about 14 characters a second.
export const estimateMs = text => Math.round(Math.min(90000, Math.max(2200, text.length * 72)));

// Spread the line over its duration by how long each kind of character takes to say.
export function estimateTiming(text, ms = estimateMs(text)) {
  const weights = [...text].map(weight), total = weights.reduce((sum, w) => sum + w, 0) || 1;
  const starts = [], ends = [];
  let at = 0;
  for (const w of weights) { starts.push(Math.round(at)); at += w / total * ms; ends.push(Math.round(at)); }
  return { chars: [...text].join(''), starts, ends };
}

// ElevenLabs alignment, in seconds per character, as a timing.
export function timingFromAlignment(alignment) {
  const chars = alignment?.characters, starts = alignment?.character_start_times_seconds, ends = alignment?.character_end_times_seconds;
  if (!Array.isArray(chars) || !chars.length || chars.length !== starts?.length || chars.length !== ends?.length) return null;
  return { chars: chars.join(''), starts: starts.map(s => Math.round(s * 1000)), ends: ends.map(s => Math.round(s * 1000)) };
}

// Mouth shapes as [open, round, wide]. Lips meet for m, b and p, round for o, u and w, and spread for e and i.
const SHAPES = {
  rest: [0, 0, 0], a: [1, 0, .25], e: [.55, 0, .8], i: [.4, 0, 1], o: [.72, .85, 0], u: [.38, 1, 0],
  w: [.22, .95, 0], r: [.3, .55, 0], f: [.12, 0, .35], s: [.18, 0, .7], l: [.42, 0, .3], h: [.5, 0, .15], other: [.32, 0, .25],
};
const VOWELS = { a: 'a', e: 'e', i: 'i', y: 'i', o: 'o', u: 'u' };
function shapeOf(chars, index) {
  const char = chars[index]?.toLowerCase(), next = chars[index + 1]?.toLowerCase();
  if (!char || !/[a-z0-9']/.test(char)) return SHAPES.rest;
  if (char === 'o' && (next === 'o' || next === 'u' || next === 'w')) return SHAPES.u;
  if (char === 'e' && next === 'e') return SHAPES.i;
  if (VOWELS[char]) return SHAPES[VOWELS[char]];
  if ('mbp'.includes(char)) return SHAPES.rest;
  if ('fv'.includes(char)) return SHAPES.f;
  if ('szcxjtdg'.includes(char) || (char === 'h' && /[sct]/.test(chars[index - 1] || ''))) return SHAPES.s;
  if (char === 'w' || char === 'q') return SHAPES.w;
  return SHAPES[char] || SHAPES.other;
}

function indexAt(timing, ms) {
  let low = 0, high = timing.starts.length - 1;
  if (high < 0 || ms < timing.starts[0] || ms >= timing.ends[high]) return -1;
  while (low < high) { const mid = (low + high + 1) >> 1; if (timing.starts[mid] <= ms) low = mid; else high = mid - 1; }
  return low;
}

// The mouth at a moment of the line. Each sound leans into the next one, the way speech runs sounds together.
export function mouthAt(timing, ms) {
  const index = timing ? indexAt(timing, ms) : -1;
  if (index < 0) return { open: 0, round: 0, wide: 0 };
  const start = timing.starts[index], end = Math.max(start + 1, timing.ends[index]);
  const here = shapeOf(timing.chars, index), next = shapeOf(timing.chars, index + 1);
  const blend = Math.max(0, Math.min(1, ((ms - start) / (end - start) - .55) / .45));
  const mix = n => here[n] + (next[n] - here[n]) * blend * blend * (3 - 2 * blend);
  return { open: mix(0), round: mix(1), wide: mix(2) };
}

// The sentence being said at a moment, for the speech bubble. Short lines show whole.
export function captionAt(text, timing, ms) {
  if (text.length <= 140) return text;
  const index = timing ? Math.max(0, indexAt(timing, ms)) : 0;
  const sentences = text.match(/[^.!?…]+[.!?…]*["')]*\s*/g) || [text];
  let at = 0;
  for (const sentence of sentences) { at += sentence.length; if (index < at) return sentence.trim(); }
  return sentences.at(-1).trim();
}

// Lines are said one after another. Each item is { text, ms, voice, kind }; returns the queue with them added.
export function schedule(queue, items, now) {
  const kept = (queue || []).filter(item => item.at + item.ms > now);
  let at = Math.max(now + SPEECH_LEAD, ...kept.map(item => item.at + item.ms + GAP));
  for (const item of items) { kept.push({ ...item, at }); at += item.ms + GAP; }
  return kept;
}

// The line being said now, or about to start, in the API's shape.
export function speechView(queue, now) {
  const item = (queue || []).find(entry => entry.at + entry.ms > now && entry.at - SPEECH_LEAD - 2000 <= now);
  return item ? { text: item.text, at: new Date(item.at).toISOString(), until: new Date(item.at + item.ms).toISOString(), voice: item.voice || null } : null;
}
