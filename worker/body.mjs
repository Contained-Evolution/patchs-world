// Patch's body. While his mind is awake and working, it decides what he does, where and for how long,
// and the body carries it out and keeps his needs. When his mind is unavailable, the needs pick for him.
// The simulation steps from one activity to the next, so it can catch up on any gap without a timer.

import { NEEDS } from '../shared/state.js';

export const TIME_ZONE = 'America/New_York';
const MINUTE = 60000;
const MAX_CATCH_UP = 2 * 24 * 60 * MINUTE;

// Rough island layout for travel times. The world side places things where it likes.
const SPOTS = {
  hammock: [0, 0], shelves: [1, 0], 'banana-grove': [-6, 4], 'tall-trees': [4, -7], pond: [7, 5],
  beach: [13, -1], 'tide-pools': [11, -10], lookout: [-8, -11], meadow: [-10, 1], cave: [-3, -15],
};

// Change per minute while awake and asleep.
const DECAY = {
  awake: { hunger: -0.0025, energy: -0.0008, fun: -0.002, comfort: -0.001, social: -0.0008 },
  asleep: { hunger: -0.0008, energy: 0, fun: 0, comfort: 0, social: -0.0002 },
};

// What his needs pick when his mind is unavailable. Effects are per minute, on top of decay.
export const ACTIVITIES = [
  { action: 'eat', place: 'banana-grove', minutes: [5, 10], effects: { hunger: 0.05, comfort: 0.004 }, appeal: 0.2 },
  { action: 'eat', place: 'shelves', minutes: [4, 8], effects: { hunger: 0.045, comfort: 0.006 } },
  { action: 'fish', place: 'pond', minutes: [20, 40], effects: { fun: 0.008, hunger: 0.004, comfort: 0.003 }, appeal: 0.4 },
  { action: 'swim', place: 'pond', minutes: [10, 25], effects: { fun: 0.015, comfort: 0.005, energy: -0.0015 }, appeal: 0.5 },
  { action: 'swing', place: 'tall-trees', minutes: [10, 25], effects: { fun: 0.018, energy: -0.0015 }, appeal: 0.3 },
  { action: 'climb', place: 'tall-trees', minutes: [8, 18], effects: { fun: 0.012, energy: -0.0015 }, appeal: 0.3 },
  { action: 'sit', place: 'beach', minutes: [10, 25], effects: { comfort: 0.01, fun: 0.003 }, appeal: 0.45 },
  { action: 'explore', place: 'tall-trees', minutes: [15, 35], effects: { fun: 0.016, energy: -0.002 }, appeal: 0.5 },
  { action: 'explore', place: 'cave', minutes: [10, 25], effects: { fun: 0.018, comfort: -0.003, energy: -0.002 }, appeal: 0.5 },
  { action: 'explore', place: 'tide-pools', minutes: [15, 30], effects: { fun: 0.016, hunger: 0.003 }, appeal: 0.5 },
  { action: 'watch-sky', place: 'meadow', minutes: [10, 25], effects: { comfort: 0.012, fun: 0.008, social: 0.003 }, appeal: 0.4 },
  { action: 'look', place: 'lookout', minutes: [10, 20], effects: { comfort: 0.006, fun: 0.006, social: 0.003 }, appeal: 0.5 },
  { action: 'phone', place: 'hammock', minutes: [10, 30], effects: { social: 0.015, fun: 0.006, comfort: 0.003 }, appeal: 0.4 },
  { action: 'think', place: 'hammock', minutes: [5, 15], effects: { comfort: 0.01, social: 0.002 }, appeal: 0.2 },
  { action: 'sleep', place: 'hammock', minutes: [20, 45], effects: { energy: 0.012, comfort: 0.006 }, nap: true },
];

// What each choice does per minute, on top of decay, and where it can be done. Missing places = anywhere.
const EFFECTS = {
  idle: { comfort: 0.003 }, sit: { comfort: 0.01, fun: 0.003 }, think: { comfort: 0.01, social: 0.002 },
  eat: { hunger: 0.05, comfort: 0.004 }, fish: { fun: 0.008, hunger: 0.004, comfort: 0.003 },
  swim: { fun: 0.015, comfort: 0.005, energy: -0.0015 }, swing: { fun: 0.018, energy: -0.0015 }, climb: { fun: 0.012, energy: -0.0015 },
  explore: { fun: 0.016, energy: -0.002 }, 'watch-sky': { comfort: 0.012, fun: 0.008, social: 0.003 }, look: { comfort: 0.006, fun: 0.006, social: 0.003 },
  phone: { social: 0.015, fun: 0.006, comfort: 0.003 }, write: { fun: 0.008, social: 0.006 }, wave: { social: 0.006, fun: 0.004 },
  sleep: { energy: 0.008, comfort: 0.004 },
};
export const CHOICES = Object.keys(EFFECTS);
export const WHERE = {
  eat: ['banana-grove', 'shelves', 'beach'], fish: ['pond'], swim: ['pond'], swing: ['tall-trees'], climb: ['tall-trees'],
  explore: ['tall-trees', 'cave', 'tide-pools', 'beach', 'meadow', 'lookout', 'banana-grove', 'pond'],
};
export const PLACES_KNOWN = Object.keys(SPOTS);
const MIND_TRUST = 12 * 60 * MINUTE;
const mindLed = (state, time) => state.mindAlive === true && Number.isFinite(state.mindAt) && time - state.mindAt < MIND_TRUST;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = value => Math.min(1, Math.max(0, value));

export function localMinutes(time) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })
    .formatToParts(new Date(time));
  const get = type => Number(parts.find(part => part.type === type).value);
  return get('hour') * 60 + get('minute');
}

const BEDTIME = 21 * 60, WAKE = 6 * 60 + 30;
export const isNight = time => { const m = localMinutes(time); return m >= BEDTIME || m < WAKE; };

export function travelMinutes(from, to) {
  const [ax, ay] = SPOTS[from], [bx, by] = SPOTS[to];
  return Math.max(1, Math.round(Math.hypot(ax - bx, ay - by) * 0.6));
}

function applyMinutes(needs, activity, minutes) {
  const decay = activity.action === 'sleep' ? DECAY.asleep : DECAY.awake;
  const out = {};
  for (const need of NEEDS) out[need] = clamp(needs[need] + ((decay[need] || 0) + (activity.effects?.[need] || 0)) * minutes);
  return out;
}

function pick(list, random) { return list[Math.floor(random() * list.length)]; }

// Needs he's low on matter most. A full need adds nothing, and he likes variety.
function score(choice, needs, place, recent, random) {
  let value = choice.appeal || 0;
  for (const [need, gain] of Object.entries(choice.effects)) {
    if (gain > 0) value += Math.max(0, 0.9 - needs[need]) ** 2 * gain * 400;
  }
  if (choice.place !== place) value -= travelMinutes(place, choice.place) * 0.012;
  if (choice.nap && needs.energy > 0.25) value -= 5;
  if (recent.includes(choice.action)) value -= 0.5;
  return value + random() * 0.5;
}

function start(action, place, startTime, minutes, extra = {}) {
  return { action, place, target: null, start: startTime, end: startTime + minutes * MINUTE, effects: {}, ...extra };
}

// Pick what comes after the current activity ends.
function next(state, time) {
  const random = rng(state.seed + Math.floor(time / MINUTE));
  const { needs, activity } = state;
  const place = activity.target || activity.place;
  if (state.queued) {
    const queued = state.queued;
    state.queued = null;
    if (queued.place && queued.place !== place) return travel(state, place, queued.place, time, random, { ...queued, place: null });
    state.recent = [queued.action, ...(state.recent || [])].slice(0, 3);
    if (queued.nap) return start('sleep', place, time, queued.minutes, { effects: queued.effects, nap: true });
    return start(queued.action, place, time, queued.minutes, { effects: queued.effects });
  }
  // His mind is deciding: once what he chose is done, he waits and thinks until it wakes and chooses again.
  if (mindLed(state, time)) return start('think', place, time, 5, { effects: EFFECTS.think, waiting: true });
  if (isNight(time) && needs.hunger > 0.15) {
    if (place !== 'hammock') return travel(state, place, 'hammock', time, random, { action: 'sleep', minutes: 0, effects: {} });
    const m = localMinutes(time);
    const untilWake = ((WAKE - m + 1440) % 1440) + Math.floor(random() * 20);
    return start('sleep', 'hammock', time, Math.max(5, untilWake), { effects: { energy: 0.004, comfort: 0.002 } });
  }
  if (activity.action === 'sleep' && !activity.nap) {
    return start('idle', place, time, 3);
  }
  const recent = state.recent || [];
  const best = ACTIVITIES.map(choice => [score(choice, needs, place, recent, random), choice]).sort((a, b) => b[0] - a[0])[0][1];
  const minutes = best.minutes[0] + Math.floor(random() * (best.minutes[1] - best.minutes[0] + 1));
  const queued = { action: best.action, minutes, effects: best.effects, nap: !!best.nap };
  if (best.place !== place) return travel(state, place, best.place, time, random, queued);
  state.recent = [best.action, ...recent].slice(0, 3);
  if (best.nap) return start('sleep', place, time, minutes, { effects: best.effects, nap: true });
  return start(best.action, place, time, minutes, { effects: best.effects });
}

function travel(state, from, to, time, random, queued, how = null) {
  // Bedtime travel queues nothing; the night rule takes over once he arrives.
  state.queued = queued.minutes ? queued : null;
  const minutes = travelMinutes(from, to);
  // Through the forest he sometimes swings; otherwise he walks, or runs when he's very hungry.
  const forest = to === 'tall-trees' || from === 'tall-trees';
  const action = how === 'swing' && forest ? 'swing' : how === 'run' || how === 'walk' ? how : state.needs.hunger < 0.2 ? 'run' : forest && random() < 0.5 ? 'swing' : 'walk';
  const speed = action === 'walk' ? 1 : 0.6;
  return start(action, from, time, Math.max(1, Math.round(minutes * speed)), { target: to, effects: { energy: -0.002 } });
}

// His mind's choice takes effect now. Returns null when it worked, or the reason it can't be done.
// plan: { do, where, minutes, how }. A choice made while travelling waits until he arrives.
export function choose(state, plan, now) {
  const action = plan?.do, place = plan?.where || state.activity.target || state.activity.place;
  if (!CHOICES.includes(action)) return `"${action}" is not something you can do.`;
  if (!PLACES_KNOWN.includes(place)) return `"${place}" is not a place on your island.`;
  if (WHERE[action] && !WHERE[action].includes(place)) return `You can only ${action} at: ${WHERE[action].join(', ')}.`;
  const [low, high] = action === 'sleep' ? [10, 600] : [3, 120];
  const minutes = Math.max(low, Math.min(high, Math.round(Number(plan.minutes)) || 20));
  const queued = { action, minutes, effects: EFFECTS[action], nap: action === 'sleep' };
  const { activity } = state;
  if (activity.target) { state.queued = { ...queued, place }; return null; }
  state.needs = applyMinutes(state.needs, activity, Math.max(0, now - activity.start) / MINUTE);
  state.queued = null;
  state.recent = [action, ...(state.recent || [])].slice(0, 3);
  state.activity = place === activity.place
    ? start(action, place, now, minutes, { effects: EFFECTS[action], nap: action === 'sleep' })
    : travel(state, activity.place, place, now, rng(state.seed + Math.floor(now / MINUTE)), queued, plan.how);
  const { action: a, place: p, target } = state.activity;
  state.log = [...(state.log || []), { action: a, place: p, target, at: now }].slice(-40);
  return null;
}

export function newBody(now, seed = 1) {
  return {
    seed,
    needs: { hunger: 0.7, energy: 0.9, fun: 0.6, comfort: 0.7, social: 0.5 },
    activity: start('look', 'beach', now, 5),
    queued: null,
    recent: [],
    log: [],
  };
}

// Move the body forward to `now`. Returns true if the stored state changed.
export function advance(state, now) {
  let changed = false;
  if (now - state.activity.end > MAX_CATCH_UP) {
    state.activity.end = now - MAX_CATCH_UP;
    changed = true;
  }
  for (let steps = 0; state.activity.end <= now && steps < 5000; steps++) {
    const done = state.activity;
    state.needs = applyMinutes(state.needs, done, (done.end - done.start) / MINUTE);
    state.activity = next(state, done.end);
    const { action, place, target, start: at } = state.activity;
    state.log = [...(state.log || []), { action, place, target, at }].slice(-40);
    changed = true;
  }
  return changed;
}

function mood(needs) {
  const [lowest, value] = Object.entries(needs).sort((a, b) => a[1] - b[1])[0];
  if (value > 0.55) return 'curious';
  return { hunger: 'hungry', energy: 'sleepy', fun: 'bored', comfort: 'restless', social: 'lonely' }[lowest];
}

const DAY_FRACTION = time => localMinutes(time) / 1440;

// The public view, in the shape of sampleState in shared/state.js.
export function view(state, now) {
  const { activity } = state;
  const elapsed = Math.max(0, (now - activity.start) / MINUTE);
  const needs = applyMinutes(state.needs, activity, elapsed);
  for (const need of NEEDS) needs[need] = Math.round(needs[need] * 100) / 100;
  return {
    patch: {
      action: activity.action,
      place: activity.place,
      target: activity.target,
      needs,
      mood: activity.action === 'sleep' ? 'asleep' : mood(needs),
      // Spoken words come from the mind, not from canned body activity lines.
      says: activity.says && Number.isFinite(activity.saysAt) && now >= activity.saysAt && now - activity.saysAt < 8000 ? activity.says : null,
      speechUntil: activity.says && Number.isFinite(activity.saysAt) && now >= activity.saysAt && now - activity.saysAt < 8000 ? new Date(activity.saysAt + 8000).toISOString() : null,
      since: new Date(activity.start).toISOString(),
      until: new Date(activity.end).toISOString(),
    },
    clock: {
      now: new Date(now).toISOString(),
      dayFraction: Math.round(DAY_FRACTION(now) * 10000) / 10000,
      weather: 'clear',
    },
  };
}
