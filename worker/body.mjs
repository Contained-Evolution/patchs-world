// Patch's body: needs drive what he does next. No AI runs here.
// The simulation steps from one activity to the next, so it can catch up on any gap without a timer.

import { NEEDS } from '../shared/state.js';

export const TIME_ZONE = 'America/New_York';
const MINUTE = 60000;
const MAX_CATCH_UP = 2 * 24 * 60 * MINUTE;

// Rough island layout for travel times. The world side places things where it likes.
const SPOTS = {
  hammock: [0, 0], shelves: [1, 0], pond: [4, 3], 'banana-grove': [-3, 2],
  'tall-trees': [2, -4], beach: [6, -1], lookout: [-2, -5],
};

// Change per minute while awake and asleep.
const DECAY = {
  awake: { hunger: -0.0025, energy: -0.0008, fun: -0.002, comfort: -0.001, social: -0.0008 },
  asleep: { hunger: -0.0008, energy: 0, fun: 0, comfort: 0, social: -0.0002 },
};

// What he can choose to do. Effects are per minute, on top of decay.
export const ACTIVITIES = [
  { action: 'eat', place: 'banana-grove', minutes: [5, 10], effects: { hunger: 0.05, comfort: 0.004 }, appeal: 0.2 },
  { action: 'eat', place: 'shelves', minutes: [4, 8], effects: { hunger: 0.045, comfort: 0.006 } },
  { action: 'fish', place: 'pond', minutes: [20, 40], effects: { fun: 0.008, hunger: 0.004, comfort: 0.003 }, appeal: 0.4 },
  { action: 'swim', place: 'pond', minutes: [10, 25], effects: { fun: 0.015, comfort: 0.005, energy: -0.0015 }, appeal: 0.5 },
  { action: 'swing', place: 'tall-trees', minutes: [10, 30], effects: { fun: 0.018, energy: -0.0015 }, appeal: 0.6 },
  { action: 'climb', place: 'tall-trees', minutes: [8, 18], effects: { fun: 0.012, energy: -0.0015 }, appeal: 0.3 },
  { action: 'sit', place: 'beach', minutes: [10, 25], effects: { comfort: 0.01, fun: 0.003 }, appeal: 0.3 },
  { action: 'look', place: 'lookout', minutes: [10, 20], effects: { comfort: 0.006, fun: 0.006, social: 0.003 }, appeal: 0.4 },
  { action: 'phone', place: 'hammock', minutes: [10, 30], effects: { social: 0.015, fun: 0.006, comfort: 0.003 }, appeal: 0.4 },
  { action: 'think', place: 'hammock', minutes: [5, 15], effects: { comfort: 0.01, social: 0.002 }, appeal: 0.2 },
  { action: 'sleep', place: 'hammock', minutes: [20, 45], effects: { energy: 0.012, comfort: 0.006 }, nap: true },
];

const SAYS = {
  eat: ['Banana number... I lost count!', 'Mom would put cinnamon on this.', 'Mmm. Crunchy ones are the best.'],
  fish: ['Come on, fishy fishy.', 'Dad says fishing is mostly waiting. Dad was right.'],
  swim: ['Splash!', 'The water is warm today!'],
  swing: ['Wheee!', 'Branch to branch to branch!', 'Sam would never catch me now!'],
  climb: ['Higher! Higher!'],
  sit: ['The waves sound like they are whispering.'],
  look: ['I wonder what Sam is doing over there.', 'One day I will go see what is on that land.', 'That cloud looks like a turtle.'],
  phone: ['Let me check my messages!', 'What should I learn about today?'],
  think: ['Hmm...', 'I have a question about that.'],
  sleep: ['Goodnight, Mom. Goodnight, Dad. Goodnight, Sam.'],
  nap: ['*yawn* Just a little rest.'],
  wake: ['Good morning, island!'],
};

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

function travelMinutes(from, to) {
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

function maybeSay(action, random) {
  return SAYS[action] && random() < 0.35 ? pick(SAYS[action], random) : null;
}

// Needs he's low on matter most. A full need adds nothing, and he likes variety.
function score(choice, needs, place, recent, random) {
  let value = choice.appeal || 0;
  for (const [need, gain] of Object.entries(choice.effects)) {
    if (gain > 0) value += Math.max(0, 0.9 - needs[need]) ** 2 * gain * 400;
  }
  if (choice.place !== place) value -= travelMinutes(place, choice.place) * 0.03;
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
    state.recent = [queued.action, ...(state.recent || [])].slice(0, 3);
    if (queued.nap) return start('sleep', place, time, queued.minutes, { effects: queued.effects, says: SAYS.nap[0], nap: true });
    return start(queued.action, place, time, queued.minutes, { effects: queued.effects, says: maybeSay(queued.action, random) });
  }
  if (isNight(time) && needs.hunger > 0.15) {
    if (place !== 'hammock') return travel(state, place, 'hammock', time, random, { action: 'sleep', minutes: 0, effects: {} });
    const m = localMinutes(time);
    const untilWake = ((WAKE - m + 1440) % 1440) + Math.floor(random() * 20);
    return start('sleep', 'hammock', time, Math.max(5, untilWake), { effects: { energy: 0.004, comfort: 0.002 }, says: activity.action === 'sleep' && !activity.nap ? null : SAYS.sleep[0] });
  }
  if (activity.action === 'sleep' && !activity.nap) {
    return start('idle', place, time, 3, { says: SAYS.wake[0] });
  }
  const recent = state.recent || [];
  const best = ACTIVITIES.map(choice => [score(choice, needs, place, recent, random), choice]).sort((a, b) => b[0] - a[0])[0][1];
  const minutes = best.minutes[0] + Math.floor(random() * (best.minutes[1] - best.minutes[0] + 1));
  const queued = { action: best.action, minutes, effects: best.effects, nap: !!best.nap };
  if (best.place !== place) return travel(state, place, best.place, time, random, queued);
  state.recent = [best.action, ...recent].slice(0, 3);
  if (best.nap) return start('sleep', place, time, minutes, { effects: best.effects, says: SAYS.nap[0], nap: true });
  return start(best.action, place, time, minutes, { effects: best.effects, says: maybeSay(best.action, random) });
}

function travel(state, from, to, time, random, queued) {
  // Bedtime travel queues nothing; the night rule takes over once he arrives.
  state.queued = queued.minutes ? queued : null;
  const minutes = travelMinutes(from, to);
  const action = to === 'tall-trees' || from === 'tall-trees' ? 'swing' : state.needs.hunger < 0.2 ? 'run' : 'walk';
  const speed = action === 'walk' ? 1 : 0.6;
  return start(action, from, time, Math.max(1, Math.round(minutes * speed)), { target: to, effects: { energy: -0.002 } });
}

export function newBody(now, seed = 1) {
  return {
    seed,
    needs: { hunger: 0.7, energy: 0.9, fun: 0.6, comfort: 0.7, social: 0.5 },
    activity: start('look', 'beach', now, 5, { says: 'Wow. My very own island.' }),
    queued: null,
    recent: [],
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
      says: activity.says || null,
      since: new Date(activity.start).toISOString(),
    },
    clock: {
      now: new Date(now).toISOString(),
      dayFraction: Math.round(DAY_FRACTION(now) * 10000) / 10000,
      weather: 'clear',
    },
  };
}
