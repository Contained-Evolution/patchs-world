import test from 'node:test';
import assert from 'node:assert/strict';
import { LAKE, RIVER, waterEdgeDistance, valleyWaterDepth } from '../src/valley/valley-water-layout.js';

test('lake is deeper than the river and water fades at its banks', () => {
  assert.ok(valleyWaterDepth(LAKE.x, LAKE.z) > 3);
  const p = RIVER[1];
  assert.ok(valleyWaterDepth(p.x, p.z) > 0);
  assert.ok(valleyWaterDepth(p.x, p.z) < 1.05);
  assert.equal(valleyWaterDepth(200, 100), 0);
  assert.ok(waterEdgeDistance(LAKE.x, LAKE.z) < 0);
});
