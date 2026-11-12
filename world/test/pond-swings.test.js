import test from 'node:test';
import assert from 'node:assert/strict';
import { createIslandCollision, inPond, pondAccess, walkable } from '../src/island-collision.js';
import { patchRoute } from '../src/patch-motion.js';
import { pondSwings, pondSwingPose, nextPondSwing } from '../src/pond-swings.js';
import { groundHeight, ISLAND, places } from '../src/terrain.js';

test('all five ropes have a dry approach, a clear swing and an exit from the pool',()=>{
 assert.deepEqual(pondSwings.map(swing=>swing.model),['palm','palm','fig','palm','palm']);
 const solids=createIslandCollision();
 for(const swing of pondSwings){
  const route=patchRoute(places.pond,swing.mount,0,[],solids);
  assert.deepEqual(route.at(-1),swing.mount);
  for(let t=0;t<4;t+=.025){
   const pose=pondSwingPose(swing,t),[x,y,z]=pose.position;
   assert.ok(y>=groundHeight(x,z)-.2,`swing meets ground at ${x},${z}`);
   assert.ok(!solids.blocks(x,z),`swing intersects a solid at ${x},${z}`);
   if(pose.grip)assert.ok(Math.abs(Math.hypot(...pose.grip.map((v,i)=>v-swing.anchor[i]))-swing.length)<1e-6);
  }
  const splash=pondSwingPose(swing,4),[x,y,z]=splash.position;
  assert.ok(splash.landed);
  assert.equal(y,ISLAND.pondY-.35);
  assert.ok(inPond(x,z));
  const exit=pondAccess([x,z],solids);
  assert.ok(exit&&walkable(...exit.bank,undefined,undefined,solids));
  for(const direction of [-1,1]){
   const next=pondSwings[nextPondSwing({index:pondSwings.indexOf(swing),direction}).index];
   assert.deepEqual(patchRoute(exit.bank,next.mount,0,[],solids).at(-1),next.mount);
  }
 }
});
