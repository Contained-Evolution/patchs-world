import test from 'node:test';
import assert from 'node:assert/strict';
import {createWalkSolids} from '../src/island-collision.js';
import {walkable,walkStep} from '../src/visitor-controls.js';
import {places} from '../src/terrain.js';
test('the valley boundary and winter route stop a visitor', () => {
  for (const [x, z] of [[-318, 0], [318, 0], [0, 239], [0, -276], [190, -22]]) {
    assert.equal(walkable(x, z), false);
  }
});
test('cave entry is open and its back blocks a visitor',()=>{
 const [x,z]=places.cave;assert.equal(walkable(x,z-6,x,z-5),true);assert.equal(walkable(x,z-16,x,z-14),false);assert.equal(walkable(x+5.5,z-8,x+4,z-8),false);
});
test('Walk stops at solids even during a fast step, slides along them and can back out', () => {
  const solids = createWalkSolids();
  solids.box(2, -2, 3, 3);
  const [x, z] = walkStep(0, 0, 6, 2, solids);
  assert.ok(x >= 1.5 && x <= 1.7, x);
  assert.ok(z > 1.9, z);
  assert.ok(walkStep(1.8, 0, -1, 0, solids)[0] < 1);
  solids.ellipse(-2, 0, .4, .4);
  assert.ok(walkStep(0, 0, -4, 0, solids)[0] > -1.31);
  solids.log(-1, 4, 1, 4, .1);
  assert.ok(walkStep(0, 2, 0, 4, solids)[1] <= 3.61);
});
