// Patch's body. While his mind is awake and working, it decides what he does, where and for how long,
// and the body carries it out and keeps his needs. When his mind is unavailable, the needs pick for him.
// Nobody sets his bedtime: he sleeps when he chooses to, or when his needs say he is tired enough.
// The simulation steps from one activity to the next, so it can catch up on any gap without a timer.

import { NEEDS } from '../shared/state.js';
import { weatherAt, SHELTERED, FOOD } from './senses.mjs';

export const TIME_ZONE = 'America/New_York';
const MINUTE = 60000;
const MAX_CATCH_UP = 2 * 24 * 60 * MINUTE;

// Rough island layout for travel times. The world side places things where it likes.
const SPOTS = {
  hammock: [0, 0], shelves: [1, 0], computer: [-0.6, -0.5], 'banana-grove': [-6, 4], 'tall-trees': [4, -7], pond: [7, 5],
  beach: [13, -1], 'tide-pools': [11, -10], lookout: [-8, -11], meadow: [-10, 1], cave: [-3, -15],
};

// Change per minute while awake and asleep. A day of wear fits one night's sleep: about sixteen hours up for eight asleep.
const DECAY = {
  awake: { hunger: -0.0025, energy: -0.0004, fun: -0.002, comfort: -0.001, social: -0.0008 },
  asleep: { hunger: -0.0008, energy: 0, fun: 0, comfort: 0, social: -0.0002 },
};
// Energy back per minute of sleep: a tired monkey needs about eight hours to feel rested.
const SLEEP_GAIN = 0.0015;

// What his needs pick when his mind is unavailable. Effects are per minute, on top of decay.
export const ACTIVITIES = [
  { action: 'eat', place: 'banana-grove', minutes: [5, 10], effects: { hunger: 0.05, comfort: 0.004 }, appeal: 0.2 },
  { action: 'eat', place: 'shelves', minutes: [4, 8], effects: { hunger: 0.045, comfort: 0.006 } },
  { action: 'fish', place: 'pond', minutes: [20, 40], effects: { fun: 0.008, hunger: 0.004, comfort: 0.003 }, appeal: 0.4 },
  { action: 'swim', place: 'pond', minutes: [10, 25], effects: { fun: 0.015, comfort: 0.005, energy: -0.0006 }, appeal: 0.5 },
  { action: 'swing', place: 'tall-trees', minutes: [10, 25], effects: { fun: 0.018, energy: -0.0006 }, appeal: 0.3 },
  { action: 'climb', place: 'tall-trees', minutes: [8, 18], effects: { fun: 0.012, energy: -0.0006 }, appeal: 0.3 },
  { action: 'climb', place: 'lookout', minutes: [8, 16], effects: { fun: 0.012, energy: -0.0008 }, appeal: 0.3 },
  { action: 'sit', place: 'beach', minutes: [10, 25], effects: { comfort: 0.01, fun: 0.003 }, appeal: 0.45 },
  { action: 'explore', place: 'tall-trees', minutes: [15, 35], effects: { fun: 0.016, energy: -0.0008 }, appeal: 0.5 },
  { action: 'explore', place: 'cave', minutes: [10, 25], effects: { fun: 0.018, comfort: -0.003, energy: -0.0008 }, appeal: 0.5 },
  { action: 'explore', place: 'tide-pools', minutes: [15, 30], effects: { fun: 0.016, hunger: 0.003 }, appeal: 0.5 },
  { action: 'watch-sky', place: 'meadow', minutes: [10, 25], effects: { comfort: 0.012, fun: 0.008, social: 0.003 }, appeal: 0.4 },
  { action: 'look', place: 'lookout', minutes: [10, 20], effects: { comfort: 0.006, fun: 0.006, social: 0.003 }, appeal: 0.5 },
  { action: 'computer', place: 'computer', minutes: [10, 30], effects: { social: 0.015, fun: 0.006, comfort: 0.003 }, appeal: 0.4 },
  { action: 'think', place: 'hammock', minutes: [5, 15], effects: { comfort: 0.01, social: 0.002 }, appeal: 0.2 },
  { action: 'archery', place: 'meadow', minutes: [10, 20], effects: { fun: 0.016, energy: -0.0006 }, appeal: 0.35 },
  { action: 'dance', place: 'beach', minutes: [4, 10], effects: { fun: 0.02, energy: -0.0008 }, appeal: 0.3 },
];

// What each choice does per minute, on top of decay, and where it can be done. Missing places = anywhere.
const EFFECTS = {
  idle: { comfort: 0.003 }, sit: { comfort: 0.01, fun: 0.003 }, think: { comfort: 0.01, social: 0.002 },
  eat: { hunger: 0.05, comfort: 0.004 }, fish: { fun: 0.008, hunger: 0.004, comfort: 0.003 },
  swim: { fun: 0.015, comfort: 0.005, energy: -0.0006 }, swing: { fun: 0.018, energy: -0.0006 }, climb: { fun: 0.012, energy: -0.0006 },
  explore: { fun: 0.016, energy: -0.0008 }, 'watch-sky': { comfort: 0.012, fun: 0.008, social: 0.003 }, look: { comfort: 0.006, fun: 0.006, social: 0.003 },
  computer: { social: 0.015, fun: 0.006, comfort: 0.003 }, research: { fun: 0.012, social: 0.002 }, write: { fun: 0.008, social: 0.006 },
  wave: { social: 0.006, fun: 0.004 }, archery: { fun: 0.016, energy: -0.0006 }, dance: { fun: 0.02, energy: -0.0008 },
  sleep: { energy: SLEEP_GAIN, comfort: 0.004 },
};
export const CHOICES = Object.keys(EFFECTS);
export const WHERE = {
  eat: ['banana-grove', 'shelves', 'beach'], computer: ['computer'], fish: ['pond'], swim: ['pond'], swing: ['tall-trees'], climb: ['tall-trees', 'lookout'], archery: ['meadow', 'beach'],
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

// The hour only leans on him: sleep comes easiest around three in the morning (1) and hardest in mid-afternoon (0).
export const sleepiness = time => 0.5 + 0.5 * Math.cos((localMinutes(time) - 180) / 1440 * 2 * Math.PI);
// When his needs pick for him, he sleeps once his energy is below this: sooner in the small hours, later by day.
const dozeBelow = time => 0.15 + 0.3 * sleepiness(time);
// How long a full rest would take him from here, in minutes.
export const restMinutes = needs => Math.max(0, Math.round((1 - needs.energy) / SLEEP_GAIN));
// A night's sleep runs until he is rested; a daytime one is a nap. Hunger wakes him sooner.
function sleepMinutes(needs, time, random) {
  const rested = sleepiness(time) > 0.3 ? 1 : Math.min(1, needs.energy + 0.25);
  const wanted = (rested - needs.energy) / SLEEP_GAIN + random() * 30, untilHungry = (needs.hunger - 0.1) / -DECAY.asleep.hunger;
  return Math.round(Math.max(20, Math.min(600, wanted, untilHungry)));
}

export function travelMinutes(from, to) {
  const [ax, ay] = SPOTS[from], [bx, by] = SPOTS[to];
  return Math.max(1, Math.round(Math.hypot(ax - bx, ay - by) * 0.6));
}

// Rain and storms wear on him whenever he's out in them, asleep or awake.
const WET = { rain: { comfort: -0.006 }, storm: { comfort: -0.012, energy: -0.001 } };
function exposure(activity, minutes) {
  const out = {};
  if (SHELTERED.has(activity.place) && !activity.target || !Number.isFinite(activity.start)) return out;
  for (let done = 0; done < minutes; done += 15) {
    const step = Math.min(15, minutes - done), wet = WET[weatherAt(activity.start + done * MINUTE)];
    for (const [need, rate] of Object.entries(wet || {})) out[need] = (out[need] || 0) + rate * step;
  }
  return out;
}

function applyMinutes(needs, activity, minutes) {
  const decay = activity.action === 'sleep' ? DECAY.asleep : DECAY.awake, wet = exposure(activity, minutes);
  const out = {};
  for (const need of NEEDS) out[need] = clamp(needs[need] + ((decay[need] || 0) + (activity.effects?.[need] || 0)) * minutes + (wet[need] || 0));
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
    return start(queued.action, place, time, queued.minutes, { effects: queued.effects });
  }
  // His mind is deciding: once what he chose is done, he waits and thinks until it wakes and chooses again.
  if (mindLed(state, time)) return start('think', place, time, 5, { effects: EFFECTS.think, waiting: true });
  // He takes a moment to wake up.
  if (activity.action === 'sleep') return start('idle', place, time, 3);
  if (needs.energy < dozeBelow(time) && needs.hunger > 0.15) {
    const sleep = { action: 'sleep', minutes: sleepMinutes(needs, time, random), effects: EFFECTS.sleep };
    if (place !== 'hammock') return travel(state, place, 'hammock', time, random, sleep);
    state.recent = ['sleep', ...(state.recent || [])].slice(0, 3);
    return start('sleep', 'hammock', time, sleep.minutes, { effects: sleep.effects });
  }
  const recent = state.recent || [];
  const best = ACTIVITIES.map(choice => [score(choice, needs, place, recent, random), choice]).sort((a, b) => b[0] - a[0])[0][1];
  const minutes = best.minutes[0] + Math.floor(random() * (best.minutes[1] - best.minutes[0] + 1));
  const queued = { action: best.action, minutes, effects: best.effects };
  if (best.place !== place) return travel(state, place, best.place, time, random, queued);
  state.recent = [best.action, ...recent].slice(0, 3);
  return start(best.action, place, time, minutes, { effects: best.effects });
}

function travel(state, from, to, time, random, queued, how = null) {
  state.queued = queued;
  const minutes = travelMinutes(from, to);
  // Through the forest he sometimes swings; otherwise he walks, or runs when he's very hungry.
  const forest = to === 'tall-trees' || from === 'tall-trees';
  const action = how === 'swing' && forest ? 'swing' : how === 'run' || how === 'walk' ? how : state.needs.hunger < 0.2 ? 'run' : forest && random() < 0.5 ? 'swing' : 'walk';
  const speed = action === 'walk' ? 1 : 0.6;
  return start(action, from, time, Math.max(1, Math.round(minutes * speed)), { target: to, effects: { energy: -0.0008 } });
}

// His mind's choice takes effect now. Returns null when it worked, or the reason it can't be done.
// plan: { do, where, minutes, how }. A choice made while travelling waits until he arrives.
export function choose(state, plan, now) {
  const action = plan?.do, place = plan?.where || state.activity.target || state.activity.place;
  if (!CHOICES.includes(action)) return `"${action}" is not something you can do.`;
  if (!PLACES_KNOWN.includes(place)) return `"${place}" is not a place on your island.`;
  const packed = action === 'eat' && !WHERE.eat.includes(place) ? (state.carrying || []).findIndex(thing => FOOD.includes(thing.item)) : -1;
  if (WHERE[action] && !WHERE[action].includes(place) && packed < 0) return `You can only ${action} at: ${WHERE[action].join(', ')}${action === 'eat' ? ', or anywhere if you carry food' : ''}.`;
  // Food he brought with him is eaten up; it lasts about ten minutes.
  if (packed >= 0) { state.carrying.splice(packed, 1); plan = { ...plan, minutes: Math.min(10, Number(plan.minutes) || 10) }; }
  const [low, high] = action === 'sleep' ? [10, 600] : [3, 120];
  const minutes = Math.max(low, Math.min(high, Math.round(Number(plan.minutes)) || 20));
  const queued = { action, minutes, effects: EFFECTS[action] };
  const { activity } = state;
  if (activity.target) { state.queued = { ...queued, place }; return null; }
  state.needs = applyMinutes(state.needs, activity, Math.max(0, now - activity.start) / MINUTE);
  state.queued = null;
  state.recent = [action, ...(state.recent || [])].slice(0, 3);
  state.activity = place === activity.place
    ? start(action, place, now, minutes, { effects: EFFECTS[action] })
    : travel(state, activity.place, place, now, rng(state.seed + Math.floor(now / MINUTE)), queued, plan.how);
  const { action: a, place: p, target } = state.activity;
  state.log = [...(state.log || []), { action: a, place: p, target, at: now }].slice(-40);
  return null;
}

// What he carries and what he has left around the island. He arrived with Dad's river stone.
const CARRY = 6, LEAVE = 12;
export const DAD_STONE = 'smooth river stone from Dad';
export function carrying(state) { return (state.carrying ||= [{ item: DAD_STONE, from: 'home' }]); }
const placeOf = state => state.activity.target ? null : state.activity.place;
// Pick up things he can find here, including things he left before. Returns what he took.
export function take(state, items, finds, now) {
  const place = placeOf(state), here = state.left?.[place] || [], taken = [];
  if (!place || !Array.isArray(items)) return taken;
  for (const raw of items.slice(0, 3)) {
    const item = String(raw || '').toLowerCase().trim(), left = here.findIndex(thing => thing.item === item);
    if (carrying(state).length >= CARRY || (left < 0 && !finds.includes(item))) continue;
    carrying(state).push(left >= 0 ? here.splice(left, 1)[0] : { item, from: place, at: now });
    taken.push(item);
  }
  return taken;
}
// Put things down where he is; they stay there until he comes back for them.
export function leave(state, items, now) {
  const place = placeOf(state), left = [];
  if (!place || !Array.isArray(items)) return left;
  for (const raw of items.slice(0, 3)) {
    const item = String(raw || '').toLowerCase().trim(), index = carrying(state).findIndex(thing => thing.item === item);
    if (index < 0) continue;
    state.left = state.left || {};
    state.left[place] = [...(state.left[place] || []), { ...carrying(state).splice(index, 1)[0], leftAt: now }].slice(-LEAVE);
    left.push(item);
  }
  return left;
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

// Whether he was somewhere, or doing one of these things, at any point since a moment. Travel doesn't count.
export function didSince(state, since, { place = null, actions = null } = {}) {
  const here = entry => !entry.target && (!place || entry.place === place) && (!actions || actions.includes(entry.action));
  return here(state.activity) || (state.log || []).some(entry => entry.at >= since && here(entry));
}

function mood(needs) {
  const [lowest, value] = Object.entries(needs).sort((a, b) => a[1] - b[1])[0];
  if (value > 0.55) return 'curious';
  return { hunger: 'hungry', energy: 'sleepy', fun: 'bored', comfort: 'restless', social: 'lonely' }[lowest];
}

// How he carries himself through an activity, from how he felt when it began: okay, happy, tired or grumpy.
// It holds until the activity ends, so every visitor sees him move the same way.
function spirit(needs, activity) {
  const lowest = Math.min(...NEEDS.map(need => needs[need])), mean = NEEDS.reduce((sum, need) => sum + needs[need], 0) / NEEDS.length;
  if (needs.energy < 0.3 && needs.energy === lowest) return 'tired';
  const stormy = Number.isFinite(activity.start) && weatherAt(activity.start) === 'storm' && !(SHELTERED.has(activity.place) && !activity.target);
  if (lowest < 0.2 || stormy) return 'grumpy';
  if (needs.energy < 0.3) return 'tired';
  return lowest > 0.45 && mean > 0.7 ? 'happy' : 'okay';
}

const DAY_FRACTION = time => localMinutes(time) / 1440;

// The public view, in the shape of sampleState in shared/state.js. `mail` is how many letters wait at the coconut computer.
export function view(state, now, mail = 0) {
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
      spirit: spirit(state.needs, activity),
      // Spoken words come from the mind, not from canned body activity lines.
      says: activity.says && Number.isFinite(activity.saysAt) && now >= activity.saysAt && now - activity.saysAt < 8000 ? activity.says : null,
      speechUntil: activity.says && Number.isFinite(activity.saysAt) && now >= activity.saysAt && now - activity.saysAt < 8000 ? new Date(activity.saysAt + 8000).toISOString() : null,
      carrying: carrying(state).map(thing => thing.item),
      mail,
      since: new Date(activity.start).toISOString(),
      until: new Date(activity.end).toISOString(),
    },
    clock: {
      now: new Date(now).toISOString(),
      dayFraction: Math.round(DAY_FRACTION(now) * 10000) / 10000,
      weather: weatherAt(now),
    },
  };
}
