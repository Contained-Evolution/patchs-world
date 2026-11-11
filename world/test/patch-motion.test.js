import test from 'node:test';
import assert from 'node:assert/strict';
import {patchRoute, roamPlan, ROAM, trunkClearance, seedFrom} from '../src/patch-motion.js';
import {walkable} from '../src/visitor-controls.js';
import {places} from '../src/terrain.js';
import {walkRoute} from '../src/world-state.js';
import {forest} from '../src/forest.js';

test('his routes between places go around trunks and stay on dry land',()=>{
 const ids=Object.keys(places);
 for(const from of ids)for(const to of ids){
  if(from===to)continue;
  const route=patchRoute(places[from],places[to],seedFrom(from+to),[places[from],...walkRoute(from,to)]);
  assert.deepEqual(route[0],places[from]);assert.deepEqual(route.at(-1),places[to]);
  for(let i=1;i<route.length;i++){assert.ok(walkable(...route[i],...route[i-1]),`${from} to ${to} blocked at ${route[i]}`);if(i<route.length-1)assert.ok(trunkClearance(...route[i])>.85,`${from} to ${to} brushes a trunk at ${route[i]}`);}
 }
});

test('exploring roams widely, pauses, and is the same for every visitor',()=>{
 const seed=seedFrom('explore|tall-trees|2026-11-11T14:00:00Z'),plan=roamPlan('explore','tall-trees',seed),again=roamPlan('explore','tall-trees',seed),[cx,cz]=places['tall-trees'];
 let far=0,moving=0,clips=new Set(),last=null;
 for(let s=0;s<1800;s+=2){
  const pose=plan.at(s);assert.deepEqual(pose,again.at(s));
  far=Math.max(far,Math.hypot(pose.x-cx,pose.z-cz));assert.ok(Math.hypot(pose.x-cx,pose.z-cz)<ROAM.explore.radius['tall-trees']*1.7);
  if(pose.moving)moving++;else clips.add(pose.clip);
  if(last)assert.ok(walkable(pose.x,pose.z,last.x,last.z)||Math.hypot(pose.x-last.x,pose.z-last.z)<.01,`roam blocked at ${pose.x},${pose.z}`);
  last=pose;
 }
 assert.ok(far>20,`only roamed ${far}`);assert.ok(moving>150&&moving<800,`moving ${moving} of 900 samples`);assert.ok(clips.has('look-around'));
});

test('a roam can be joined late without replaying from the start',()=>{
 const seed=seedFrom('explore|cave|x'),early=roamPlan('explore','cave',seed),late=roamPlan('explore','cave',seed);
 for(let s=0;s<1200;s+=5)early.at(s);
 assert.deepEqual(late.at(1195),early.at(1195));
});

test('eating in the grove picks fruit facing a banana tree within reach',()=>{
  const plan=roamPlan('eat','banana-grove',seedFrom('eat|banana-grove|x'));let picks=0;
  for(let t=0;t<900;t+=.5){const pose=plan.at(t);if(pose.clip!=='pick-fruit')continue;picks++;
    const tree=forest.filter(f=>f.grove).reduce((a,b)=>Math.hypot(a.x-pose.x,a.z-pose.z)<Math.hypot(b.x-pose.x,b.z-pose.z)?a:b);
    assert.ok(Math.hypot(tree.x-pose.x,tree.z-pose.z)<1.3);assert.ok(Math.abs(Math.atan2(Math.sin(pose.heading-Math.atan2(tree.x-pose.x,tree.z-pose.z)),Math.cos(pose.heading-Math.atan2(tree.x-pose.x,tree.z-pose.z))))<.05);}
  assert.ok(picks>0);
});
