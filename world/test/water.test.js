import test from 'node:test';
import assert from 'node:assert/strict';
import { ISLAND, RIVER, groundHeight, riverPoint, riverSpeed } from '../src/terrain.js';
import { clearGroundLine, inPond, pondAccess, walkable } from '../src/island-collision.js';

test('the river bed stays below the water and feeds the lake', () => {
  const entry = riverPoint(RIVER.entry);
  const bank = riverPoint(RIVER.entry, -1.42);
  assert.ok(walkable(bank.x, bank.z));
  assert.ok(clearGroundLine([bank.x, bank.z], [entry.x, entry.z], undefined, true));
  for (let station = RIVER.entry; station < RIVER.length; station += .25) {
    const { x, y, z } = riverPoint(station);
    assert.equal(y, ISLAND.pondY);
    assert.ok(groundHeight(x, z) < y, 'dry at river station ' + station);
    assert.ok(riverSpeed(station) > 0);
  }
  const end = riverPoint(RIVER.length);
  assert.ok(inPond(end.x, end.z));
  assert.ok(pondAccess([end.x, end.z]));
});
