import test from 'node:test';
import assert from 'node:assert/strict';
import { SEATS, COMPUTER, seatFor, usesTablet, deskClip } from '../src/furniture.js';
import { places, groundHeight } from '../src/terrain.js';
import { statusText } from '../src/world-state.js';
import { roamPlan, seedFrom } from '../src/patch-motion.js';

const durations = { 'sit-to-type': 29 / 24, 'type-to-sit': 23 / 24, typing: 396 / 24 };

test('he only sits on a seat where one stands; elsewhere he sits on the ground', () => {
  assert.equal(seatFor('sit', 'beach'), SEATS.beach);
  assert.equal(seatFor('fish', 'pond'), SEATS.pond);
  assert.equal(seatFor('sit', 'shelves'), SEATS.hammock);
  assert.equal(seatFor('sit', 'meadow'), null);
  assert.equal(seatFor('watch-sky', 'meadow'), null);
  assert.equal(seatFor('sit', 'lookout'), null);
  for (const action of ['computer', 'research', 'write', 'think']) assert.equal(seatFor(action, 'computer'), SEATS.computer);
  assert.equal(seatFor('walk', 'computer'), null);
});

test('the coconut computer stands at its place, palm beyond the desk, on flat camp ground', () => {
  assert.deepEqual([SEATS.computer.x, SEATS.computer.z], places.computer);
  const dist = ([x, z]) => Math.hypot(x - SEATS.computer.x, z - SEATS.computer.z);
  assert.ok(dist(COMPUTER.desk) < dist(COMPUTER.palm));
  for (const seat of Object.values(SEATS)) assert.ok(Number.isFinite(groundHeight(seat.x, seat.z)));
  assert.ok(Math.abs(groundHeight(...places.computer) - groundHeight(0, 0)) < .3);
});

test('the tablet is for research and writing away from the computer', () => {
  assert.equal(usesTablet('research', 'beach'), true);
  assert.equal(usesTablet('write', 'meadow'), true);
  assert.equal(usesTablet('research', 'computer'), false);
  assert.equal(usesTablet('computer', 'computer'), false);
  assert.equal(usesTablet('sit', 'beach'), false);
});

test('at the desk he reaches for the keys, types, and sits back near the end', () => {
  assert.equal(deskClip('computer', .5, 600, durations).clip, 'sit-to-type');
  const typing = deskClip('computer', 100, 600, durations);
  assert.equal(typing.clip, 'typing');
  assert.ok(typing.time >= 0 && typing.time < durations.typing);
  const back = deskClip('research', 100, .4, durations);
  assert.equal(back.clip, 'type-to-sit');
  assert.ok(back.time > 0 && back.time <= durations['type-to-sit']);
  assert.deepEqual(deskClip('think', 5, 300, durations), { clip: 'type-to-sit', time: durations['type-to-sit'] });
});

test('with his tablet he wanders slowly, reading as he goes', () => {
  const plan = roamPlan('research', 'beach', seedFrom('research|beach|x'));
  const clips = new Set();
  for (let s = 0; s < 600; s += 3) clips.add(plan.at(s).clip);
  assert.ok(clips.has('texting'));
  assert.ok([...clips].every(clip => clip === 'texting' || clip === 'walk-texting'));
});

test('status tells computer, tablet and journal work apart', () => {
  assert.equal(statusText({ action: 'computer', place: 'computer' }), 'Patch is reading and answering letters at his coconut computer.');
  assert.equal(statusText({ action: 'research', place: 'computer' }), 'Patch is searching the web on his coconut computer.');
  assert.equal(statusText({ action: 'research', place: 'beach' }), 'Patch is looking things up on his tablet on the beach.');
  assert.equal(statusText({ action: 'write', place: 'meadow' }), 'Patch is writing in his journal on his tablet in the meadow.');
  assert.equal(statusText({ action: 'walk', place: 'hammock', target: 'computer' }), 'Patch is on his way to his coconut computer.');
});
