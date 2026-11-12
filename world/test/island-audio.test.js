import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTIONS } from '../../shared/state.js';
import { actionSound, ambienceAt, giftSoundAt } from '../src/island-audio.js';
import { ISLAND, places, STREAM } from '../src/terrain.js';

test('every visible Patch activity has a sound cue', () => {
  for (const action of ACTIONS) assert.ok(actionSound(action), action);
});

test('weather, shelter, daylight and water proximity set the sound mix', () => {
  const camp = ambienceAt(0, 0, 1, 'clear');
  assert.equal(camp.rain, 0);
  assert.equal(camp.water, 0);
  assert.equal(camp.birds, true);
  assert.equal(ambienceAt(0, 0, 0, 'clear').birds, false);
  assert.ok(ambienceAt(0, 0, 1, 'storm').wind > camp.wind);
  const [cx, cz] = places.cave;
  assert.ok(ambienceAt(cx, cz - 8, 1, 'rain').rain < ambienceAt(0, 0, 1, 'rain').rain);
  assert.equal(ambienceAt(ISLAND.pondX, ISLAND.pondZ, 1, 'clear').water, 1);
  assert.equal(ambienceAt(...STREAM.at(-1).slice(0, 2), 1, 'clear').surface, 'wet');
  assert.equal(ambienceAt(ISLAND.pondX, ISLAND.pondZ, 1, 'clear').surface, 'wet');
});

test('a gift plays its own cue only while the event is fresh', () => {
  const gift = { action: 'play', place: 'hammock', at: 1000 };
  assert.equal(giftSoundAt(gift, 5000), 'bounce');
  assert.equal(giftSoundAt({ ...gift, action: 'eat' }, 5000), 'bite');
  assert.equal(giftSoundAt(gift, 9000), null);
  assert.equal(giftSoundAt({ ...gift, place: 'constructor' }, 5000), null);
});
