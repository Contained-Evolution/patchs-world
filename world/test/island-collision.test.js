import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { hammock, hammockSupports } from '../src/hammock.js';
import { createIsland } from '../src/island.js';
import { BANANA_TREE, bananaTrees, clearGroundLine, nearestWalkable, pondAccess, inPond, visitorEyeHeight, walkable, walkStep } from '../src/island-collision.js';
import { COMPUTER_TENT } from '../src/furniture.js';
import { forest } from '../src/forest.js';
import { createFoodProps } from '../src/food-props.js';
import { FOOD_STORE, forageTrees } from '../src/foraging.js';
import { patchRoute } from '../src/patch-motion.js';
import { ISLAND, STREAM, places } from '../src/terrain.js';
import { walkRoute } from '../src/world-state.js';

test('rendered island solids block both walkers and all fruit trees have a reachable picking spot', t => {
  const gradient = { addColorStop() {} };
  const pattern = { setTransform() {} };
  const previousMatrix = globalThis.DOMMatrix;
  globalThis.DOMMatrix = class { scale() { return this; } };
  t.after(() => { globalThis.DOMMatrix = previousMatrix; });
  const canvas = {};
  const context = new Proxy({ canvas }, {
    get: (target, name) => name in target ? target[name]
      : name === 'measureText' ? text => ({ width: text.length * 23 })
      : name === 'getImageData' ? () => ({ data: new Uint8ClampedArray(512*512*4) })
      : name === 'createPattern' ? () => pattern
      : String(name).endsWith('Gradient') ? () => gradient : () => {}
  });
  const previous = globalThis.document;
  canvas.getContext = () => context;
  globalThis.document = {
    baseURI: 'http://localhost/patch/',
    createElement: () => canvas,
    querySelector: () => ({ textContent: 'Patch’s World' }),
    querySelectorAll: () => [{ textContent: 'Swim at the swimming hole.' }],
    fonts: { ready: Promise.resolve(), load: () => Promise.resolve() }
  };
  t.after(() => { globalThis.document = previous; });
  t.mock.method(THREE.TextureLoader.prototype, 'load', () => new THREE.Texture());
  t.mock.method(GLTFLoader.prototype, 'load', () => {});
  const scene = new THREE.Scene();
  const { walkSolids: solids, block } = createIsland(scene);
  createFoodProps(scene, block);
  const sign = scene.getObjectByName('Camp rules sign');
  assert.ok(sign);
  assert.ok(solids.blocks(sign.position.x, sign.position.z));

  for (const [x,z] of [[6,-1], [hammock.x, hammock.z], ...hammockSupports.map(({ x, z }) => [x, z]), [5.2,2], [278,32], [149,-85], [FOOD_STORE[0],FOOD_STORE[1]+1.15]]) {
    assert.ok(solids.blocks(x,z), `missing solid at ${x},${z}`);
  }
  for (const [x,z] of [[ISLAND.pondX,ISLAND.pondZ], STREAM.at(-3)]) {
    assert.equal(walkable(x,z,undefined,undefined,solids),false);
  }
  assert.equal(walkable(ISLAND.pondX,ISLAND.pondZ,undefined,undefined,solids,true),true);
  assert.ok(walkStep(6,-3,0,4,solids)[1] < -1.9);

  assert.ok(clearGroundLine([-4, 1], [-2.1, 1], solids));
  assert.ok(clearGroundLine([2.1, 1], [4, 1], solids));

  const tent = COMPUTER_TENT;
  for (const side of [-1, 1]) {
    const outsideX = tent.x + side * (tent.halfLength + 1);
    const insideX = tent.x + side * (tent.halfLength - 1);
    assert.ok(clearGroundLine([outsideX, tent.z], [insideX, tent.z], solids));
    assert.ok(!clearGroundLine([outsideX, tent.z + 1.1], [insideX, tent.z + 1.1], solids));
    assert.ok(!clearGroundLine([tent.x, tent.z + side * (tent.halfWidth + 1)], [tent.x, tent.z + side * (tent.halfWidth - 1)], solids));
  }
  assert.ok(solids.blocks(places.computer[0], places.computer[1] - .6));
  assert.ok(forest.every(tree => Math.hypot(tree.x - tent.x, tree.z - tent.z) > 11));

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

  // The visitor can swim in and out without changing controls. Patch's ground routes stay dry.
  const swimStart = [ISLAND.pondX + ISLAND.pondRX + 1, ISLAND.pondZ];
  const swimEnd = walkStep(...swimStart,-40,0,solids,true);
  assert.ok(inPond(...swimEnd));
  assert.equal(visitorEyeHeight(...swimEnd),ISLAND.pondY+.55);
  const swimReturn = walkStep(...swimEnd,40,0,solids,true);
  assert.ok(Math.abs(swimReturn[0]-swimStart[0])<.2);
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
