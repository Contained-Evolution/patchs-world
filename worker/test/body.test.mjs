import test from 'node:test';
import assert from 'node:assert/strict';
import { advance, newBody, view, sleepiness, restMinutes, localMinutes, choose, take, leave, DAD_STONE } from '../body.mjs';
import { weatherAt } from '../senses.mjs';
import { ACTIONS, PLACES, NEEDS } from '../../shared/state.js';

const HOUR = 3600000;
// 2026-06-01 10:00 in New York (EDT, UTC-4).
const MORNING = Date.UTC(2026, 5, 1, 14, 0);

test('a new body has every need and a valid view', () => {
  const body = newBody(MORNING, 7);
  const { patch, clock } = view(body, MORNING);
  assert.ok(ACTIONS.includes(patch.action));
  assert.ok(PLACES.includes(patch.place));
  for (const need of NEEDS) assert.ok(patch.needs[need] >= 0 && patch.needs[need] <= 1);
  assert.ok(clock.dayFraction > 0.41 && clock.dayFraction < 0.42);
});

test('a full day only uses known actions and places, and needs stay in range', () => {
  const body = newBody(MORNING, 42);
  const seen = new Set();
  for (let t = MORNING; t < MORNING + 24 * HOUR; t += 5 * 60000) {
    advance(body, t);
    const { patch } = view(body, t);
    seen.add(patch.action);
    assert.ok(ACTIONS.includes(patch.action), patch.action);
    assert.ok(PLACES.includes(patch.place), patch.place);
    if (patch.target) assert.ok(PLACES.includes(patch.target), patch.target);
    for (const need of NEEDS) assert.ok(patch.needs[need] >= 0 && patch.needs[need] <= 1);
  }
  for (const action of ['eat', 'sleep']) assert.ok(seen.has(action), `never did ${action}`);
  assert.ok(seen.size >= 6, [...seen].join(','));
});

test('nobody sends him to bed: left to his needs he sleeps when he is tired, at any hour', () => {
  const night = MORNING + 17 * HOUR; // 3:00 the next morning
  assert.ok(sleepiness(night) > 0.99 && sleepiness(night + 12 * HOUR) < 0.01);
  // Rested in the small hours, he stays up.
  const rested = newBody(night, 3);
  rested.needs.energy = 0.95;
  for (let t = night; t <= night + 2 * HOUR; t += 5 * 60000) { advance(rested, t); assert.notEqual(view(rested, t).patch.action, 'sleep'); }
  // Worn out at noon, he goes to his hammock and naps, then gets up again.
  const noon = MORNING + 2 * HOUR, tired = newBody(noon, 4);
  Object.assign(tired.needs, { energy: 0.08, hunger: 0.9 });
  advance(tired, noon + 30 * 60000);
  const nap = view(tired, noon + 30 * 60000).patch;
  assert.deepEqual([nap.action, nap.place], ['sleep', 'hammock']);
  assert.ok(tired.activity.end - tired.activity.start < 4 * HOUR, 'a daytime sleep is a nap');
  advance(tired, noon + 5 * HOUR);
  assert.notEqual(view(tired, noon + 5 * HOUR).patch.action, 'sleep');
  // Worn out at night, he sleeps until he is rested.
  const late = newBody(night, 5);
  Object.assign(late.needs, { energy: 0.2, hunger: 0.9 });
  advance(late, night + 30 * 60000);
  assert.equal(late.activity.action, 'sleep');
  assert.ok(late.activity.end - late.activity.start > 6 * HOUR);
  assert.equal(restMinutes({ energy: 0.25 }), 500);
});

test('over a week of quiet his sleep adds up to a real rest, mostly at night', () => {
  const body = newBody(MORNING, 21);
  let asleep = 0, atNight = 0;
  for (let t = MORNING; t < MORNING + 7 * 24 * HOUR; t += 5 * 60000) {
    advance(body, t);
    if (view(body, t).patch.action !== 'sleep') continue;
    asleep += 5;
    if (sleepiness(t) > 0.5) atNight += 5;
  }
  const hours = asleep / 60 / 7;
  assert.ok(hours > 5 && hours < 12, `${hours} hours of sleep a day`);
  assert.ok(atNight / asleep > 0.6, `${atNight / asleep} of his sleep at night`);
});

test('his spirit comes from how he felt when the activity began', () => {
  const body = newBody(MORNING, 8), spirit = needs => view({ ...body, needs: { ...body.needs, ...needs } }, MORNING).patch.spirit;
  const full = { hunger: 0.9, energy: 0.9, fun: 0.9, comfort: 0.9, social: 0.9 };
  assert.equal(spirit(full), 'happy');
  assert.equal(spirit({ ...full, energy: 0.2 }), 'tired');
  assert.equal(spirit({ ...full, hunger: 0.1 }), 'grumpy');
  assert.equal(spirit({ ...full, fun: 0.4, social: 0.4 }), 'okay');
});

test('he never starves over a week of quiet', () => {
  const body = newBody(MORNING, 9);
  let lowest = 1;
  for (let t = MORNING; t < MORNING + 7 * 24 * HOUR; t += 15 * 60000) {
    advance(body, t);
    lowest = Math.min(lowest, view(body, t).patch.needs.hunger);
  }
  assert.ok(lowest > 0.05, `hunger fell to ${lowest}`);
});

test('a long gap catches up without hanging and gives the same result each time', () => {
  const a = newBody(MORNING, 5), b = newBody(MORNING, 5);
  advance(a, MORNING + 30 * 24 * HOUR);
  advance(b, MORNING + 30 * 24 * HOUR);
  assert.deepEqual(a, b);
});

test('the clock uses New York time', () => {
  assert.equal(localMinutes(MORNING), 10 * 60);
});


test('body never invents speech, and AI speech only lasts eight seconds', () => {
  const body = newBody(MORNING, 7);
  assert.equal(view(body, MORNING).patch.says, null);
  body.activity.says = 'A thought I chose to say.';
  body.activity.saysAt = MORNING;
  assert.equal(view(body, MORNING + 5000).patch.says, 'A thought I chose to say.');
  assert.equal(view(body, MORNING + 8000).patch.says, null);
  delete body.activity.saysAt;
  assert.equal(view(body, MORNING + 1000).patch.says, null);
  for (let t = MORNING; t < MORNING + 24 * HOUR; t += 10 * 60000) {
    advance(body, t);
    assert.equal(view(body, t).patch.says, null);
  }
});


test('activity end and speech expiry are exposed without extending legacy speech', () => {
  const now = Date.parse('2026-11-10T15:00:00Z'), state = newBody(now, 1);
  state.activity.says = 'A thought'; state.activity.saysAt = now;
  const current = view(state, now + 1000);
  assert.equal(current.patch.until, new Date(state.activity.end).toISOString());
  assert.equal(current.patch.speechUntil, new Date(now + 8000).toISOString());
  assert.equal(view(state, now + 8000).patch.speechUntil, null);
  delete state.activity.saysAt;
  assert.equal(view(state, now + 1000).patch.says, null);
  state.activity.saysAt = now + 5000;
  assert.equal(view(state, now + 1000).patch.says, null);
});


test('the public activity exposes its shared start and end times', () => {
  const now=Date.parse('2026-11-11T12:00:00Z');
  const body=newBody(now, 1), patch=view(body,now).patch;
  assert.equal(Date.parse(patch.since),body.activity.start);
  assert.equal(Date.parse(patch.until),body.activity.end);
});

test('his mind can choose to stay in bed or eat all day, and nothing overrides it', () => {
  const body = newBody(MORNING, 11);
  Object.assign(body, { mindAlive: true, mindAt: MORNING });
  body.activity = { ...body.activity, place: 'hammock', target: null };
  assert.equal(choose(body, { do: 'sleep', where: 'hammock', minutes: 600 }, MORNING), null);
  advance(body, MORNING + 9 * HOUR);
  assert.equal(view(body, MORNING + 9 * HOUR).patch.action, 'sleep');
  advance(body, MORNING + 11 * HOUR);
  const after = view(body, MORNING + 11 * HOUR).patch;
  assert.equal(after.action, 'think', 'he waits for his own next choice instead of the needs picking');
  assert.equal(choose(body, { do: 'eat', where: 'banana-grove', minutes: 120 }, MORNING + 11 * HOUR), null);
  assert.equal(body.activity.target, 'banana-grove');
  assert.equal(body.queued.action, 'eat');
});

test('a choice made while travelling waits for him to arrive, then takes him on', () => {
  const body = newBody(MORNING, 12);
  Object.assign(body, { mindAlive: true, mindAt: MORNING });
  body.activity = { ...body.activity, action: 'walk', place: 'hammock', target: 'beach', start: MORNING, end: MORNING + 8 * 60000 };
  assert.equal(choose(body, { do: 'fish', where: 'pond', minutes: 30 }, MORNING + 60000), null);
  advance(body, MORNING + 9 * 60000);
  assert.equal(body.activity.target, 'pond');
  advance(body, body.activity.end + 1000);
  assert.equal(body.activity.action, 'fish');
  assert.equal(body.activity.place, 'pond');
});

test('when his mind stops working, his needs take over again', () => {
  const body = newBody(MORNING, 13);
  Object.assign(body, { mindAlive: false, mindAt: MORNING });
  advance(body, MORNING + 3 * HOUR);
  assert.notEqual(body.activity.waiting, true);
});

test('he arrives with Dad\'s stone, picks things up, leaves them, and finds them again', () => {
  const body = newBody(MORNING, 21);
  body.activity = { ...body.activity, place: 'beach', target: null };
  assert.deepEqual(view(body, MORNING).patch.carrying, [DAD_STONE]);
  assert.deepEqual(take(body, ['shell', 'treasure chest'], ['shell', 'driftwood'], MORNING), ['shell']);
  assert.deepEqual(leave(body, ['shell'], MORNING), ['shell']);
  assert.equal(body.left.beach[0].item, 'shell');
  assert.deepEqual(take(body, ['shell'], [], MORNING + HOUR), ['shell'], 'what he left is still there');
  assert.equal(body.left.beach.length, 0);
});

test('food he carries can be eaten anywhere, once', () => {
  const body = newBody(MORNING, 22);
  Object.assign(body, { mindAlive: true, mindAt: MORNING });
  body.activity = { ...body.activity, place: 'meadow', target: null };
  assert.match(choose(body, { do: 'eat', where: 'meadow', minutes: 30 }, MORNING), /anywhere if you carry food/);
  body.carrying = [{ item: 'banana' }];
  assert.equal(choose(body, { do: 'eat', where: 'meadow', minutes: 30 }, MORNING), null);
  assert.equal(body.activity.action, 'eat');
  assert.equal(body.activity.end - body.activity.start, 10 * 60000);
  assert.deepEqual(body.carrying, []);
  assert.equal(view(body, MORNING).patch.food, 'banana');
  body.carrying = [{ item: 'coconut' }];
  assert.equal(choose(body, { do: 'eat', where: 'cave', minutes: 5 }, MORNING), null);
  const arrived = body.activity.end;
  advance(body, arrived);
  assert.equal(view(body, arrived).patch.food, 'coconut');
});

test('rain makes him uncomfortable outside, but not in the cave', () => {
  let t = MORNING; while (weatherAt(t) !== 'rain') t += 3 * HOUR;
  const start = t - (t % (3 * HOUR));
  const outside = newBody(start, 23), inside = newBody(start, 23);
  for (const [body, place] of [[outside, 'meadow'], [inside, 'cave']]) {
    Object.assign(body, { mindAlive: true, mindAt: start });
    body.activity = { action: 'sit', place, target: null, start, end: start + 2 * HOUR, effects: {} };
  }
  const wet = view(outside, start + 2 * HOUR).patch.needs.comfort, dry = view(inside, start + 2 * HOUR).patch.needs.comfort;
  assert.ok(wet < dry - 0.3, `outside ${wet}, cave ${dry}`);
});
