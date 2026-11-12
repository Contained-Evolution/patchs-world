import test from 'node:test';
import assert from 'node:assert/strict';
import { navigationSurface, paintWalkway, readWalkways, walkwayFits, walkwayRoute,
  walkwayRouteToLandmark, writeWalkways } from '../src/valley/companion-walkways.js';

const flat = () => 2;
const point = (x, z) => ({ x, z });

test('a fast drag and a mixed-material turn form a connected walkway', () => {
  const tiles = new Map();
  assert.equal(paintWalkway(tiles, point(76, 40), point(92, 40), 'stone', flat, []), true);
  assert.equal(paintWalkway(tiles, point(92, 40), point(96, 48), 'wood', flat, []), true);
  const route = walkwayRoute(tiles, point(76, 40), point(96, 48));
  assert.equal(route.length, 8);
  assert.equal(route[0].material, 'stone');
  assert.equal(route.at(-1).material, 'wood');
  assert.ok(walkwayRouteToLandmark(tiles, point(76, 40), 'mill'));
  assert.equal(walkwayRouteToLandmark(tiles, point(76, 40), 'market'), null);
  assert.equal(navigationSurface(tiles, 76, 40), 'walkway');
  assert.equal(navigationSurface(tiles, 104, 68), 'approach');
  assert.equal(navigationSurface(tiles, 12, 36), 'exploration');
  paintWalkway(tiles, point(84, 40), point(84, 40), 'erase', flat, []);
  assert.equal(walkwayRoute(tiles, point(76, 40), point(96, 48)), null);
});

test('placement protects water, slopes, structures and scenery and stops a drag at an obstruction', () => {
  assert.equal(walkwayFits(point(-60, 84), flat, []), false);
  assert.equal(walkwayFits(point(104, 56), flat, []), false);
  assert.equal(walkwayFits(point(80, 40), x => x / 2, []), false);
  assert.equal(walkwayFits(point(80, 40), flat, [{ x: 83, z: 40, type: 'tree' }]), false);
  const tiles = new Map();
  paintWalkway(tiles, point(76, 40), point(92, 40), 'gravel', flat, [{ x: 84, z: 40, type: 'tree' }]);
  assert.deepEqual([...tiles.values()].map(tile => tile.x), [76, 80]);
});

test('reload preserves valid tiles and skips blocked or unknown records', () => {
  let saved;
  const storage = { getItem: () => saved, setItem: (key, value) => { saved = value; } };
  const tiles = new Map();
  paintWalkway(tiles, point(76, 40), point(92, 40), 'stone', flat, []);
  writeWalkways(storage, tiles);
  assert.deepEqual(readWalkways(storage, flat, []), tiles);
  assert.equal(readWalkways(storage, flat, [{ x: 84, z: 40, type: 'tree' }]).size, 4);
  saved = '[{"x":80,"z":40,"material":"unknown"}]';
  assert.equal(readWalkways(storage, flat, []).size, 0);
});
