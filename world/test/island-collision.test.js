import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createIsland } from '../src/island.js';
import { BANANA_TREE, bananaTrees, clearGroundLine, nearestWalkable, pondAccess, walkable, walkStep } from '../src/island-collision.js';
import { createFoodProps } from '../src/food-props.js';
import { FOOD_STORE, forageTrees } from '../src/foraging.js';
import { patchRoute } from '../src/patch-motion.js';
import { ISLAND, STREAM, TIDE_POOLS, places } from '../src/terrain.js';
import { walkRoute } from '../src/world-state.js';

test('rendered island solids block both walkers and all fruit trees have a reachable picking spot', t => {
  const gradient = { addColorStop() {} };
  const context = new Proxy({}, {
    get: (_, name) => name === 'getImageData' ? () => ({ data: new Uint8ClampedArray(512*512*4) })
      : String(name).endsWith('Gradient') ? () => gradient : () => {}
  });
  const previous = globalThis.document;
  globalThis.document = { baseURI: 'http://localhost/patch/', createElement: () => ({ getContext: () => context }) };
  t.after(() => { globalThis.document = previous; });
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  const scene = new THREE.Scene();
  const { walkSolids: solids, block } = createIsland(scene);
  createFoodProps(scene, block);

  for (const [x,z] of [[6,-1], [-3.4,1], [5.2,2], [278,32], [-145,-205], [FOOD_STORE[0],FOOD_STORE[1]+1.15]]) {
    assert.ok(solids.blocks(x,z), `missing solid at ${x},${z}`);
  }
  for (const [x,z] of [[ISLAND.pondX,ISLAND.pondZ], STREAM[2], ...TIDE_POOLS]) {
    assert.equal(walkable(x,z,undefined,undefined,solids),false);
  }
  assert.equal(walkable(ISLAND.pondX,ISLAND.pondZ,undefined,undefined,solids,true),true);
  assert.ok(walkStep(6,-3,0,4,solids)[1] < -1.9);

  const access=pondAccess(places.pond,solids);
  assert.ok(access);
  assert.ok(clearGroundLine(access.bank,access.water,solids,true));
  assert.ok(!clearGroundLine(access.bank,access.water,solids));
  for(let i=0;i<32;i++){
    const angle=i*Math.PI/16;
    const lap=[ISLAND.pondX+Math.cos(angle)*8,ISLAND.pondZ+Math.sin(angle)*5.6];
    const exit=pondAccess(lap,solids);
    assert.ok(exit);
    assert.ok(walkable(...exit.bank,undefined,undefined,solids));
    assert.ok(clearGroundLine(lap,exit.bank,solids,true));
  }

  for (const [from,start] of Object.entries(places)) {
    for (const [to,end] of Object.entries(places)) {
      if (from===to)continue;
      const route=patchRoute(start,end,42,[start,...walkRoute(from,to)],solids);
      assert.deepEqual(route.at(-1),nearestWalkable(...end,solids),`${from} to ${to}`);
      for(let i=1;i<route.length;i++)assert.ok(clearGroundLine(route[i-1],route[i],solids));
    }
  }

  const targets=forageTrees(solids);
  assert.deepEqual(bananaTrees.filter(tree=>!targets.some(target=>target.tree===tree)),[]);
  for (const { tree, candidates } of targets) {
    assert.ok(solids.blocks(tree.x,tree.z));
    assert.ok(candidates.some(end=>{
      assert.ok(Math.abs(Math.hypot(end[0]-tree.x,end[1]-tree.z)-BANANA_TREE.pickDistance)<1e-9);
      const path=patchRoute(FOOD_STORE,end,0,[],solids);
      return path.at(-1)[0]===end[0]&&path.at(-1)[1]===end[1];
    }),`unreachable banana tree at ${tree.x},${tree.z}`);
  }
});
