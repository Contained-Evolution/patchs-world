import test from 'node:test';
import assert from 'node:assert/strict';
import { advance, newBody, view, isNight, localMinutes } from '../body.mjs';
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

test('he is asleep in his hammock in the middle of the night', () => {
  const body = newBody(MORNING, 3);
  const night = MORNING + 17 * HOUR; // 3:00 the next morning
  for (let t = MORNING; t <= night; t += 10 * 60000) advance(body, t);
  assert.ok(isNight(night));
  const { patch } = view(body, night);
  assert.equal(patch.action, 'sleep');
  assert.equal(patch.place, 'hammock');
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
