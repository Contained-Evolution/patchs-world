import test from 'node:test';
import assert from 'node:assert/strict';
import { MAP_BOUNDS, LANDMARKS, STARTER_SCENERY, WINTER_LIMIT, placeScenery, readScenery, writeScenery } from '../src/valley/companion-layout.js';

test('starter scenery can be edited and placements snap without taking over an occupied cell', () => {
  for (const item of STARTER_SCENERY) {
    assert.deepEqual(placeScenery(STARTER_SCENERY, item.type, item.x, item.z, item.id), { x: item.x, z: item.z });
  }
  const first = STARTER_SCENERY[0];
  assert.equal(placeScenery(STARTER_SCENERY, 'rock', first.x + 1, first.z - 1), null);
  assert.deepEqual(placeScenery([], 'rock', first.x + 1, first.z - 1), { x: first.x, z: first.z });
});

test('scenery leaves town entrances, winter terrain and the outer edges free', () => {
  for (const { x, z } of LANDMARKS) assert.equal(placeScenery([], 'tree', x, z), null);
  assert.equal(placeScenery([], 'rock', 56, 88), null);
  assert.equal(placeScenery([], 'tree', 190, WINTER_LIMIT - 4), null);
  assert.equal(placeScenery([], 'tree', MAP_BOUNDS.x0, 48), null);
  assert.equal(placeScenery([], 'tree', -62, 83), null);
  assert.equal(placeScenery([], 'rock', -171, 201), null);
  assert.deepEqual(placeScenery([], 'tree', 220, 100), { x: 220, z: 100 });
  assert.deepEqual(placeScenery([], 'rock', -220, -40), { x: -220, z: -40 });
  assert.equal(placeScenery([], 'unknown', 32, 48), null);
});

test('an empty saved layout stays empty and invalid scenery is rejected on reload', () => {
  const saved = new Map();
  const storage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) };
  const starter = readScenery(storage);
  assert.deepEqual(starter, STARTER_SCENERY);
  assert.notStrictEqual(starter[0], STARTER_SCENERY[0]);
  writeScenery(storage, []);
  assert.deepEqual(readScenery(storage), []);
  writeScenery(storage, [starter[0], { ...starter[0], x: 100 }, { id: 'invalid', type: 'rock', x: -500, z: 0 }]);
  assert.deepEqual(readScenery(storage), [starter[0]]);
});
