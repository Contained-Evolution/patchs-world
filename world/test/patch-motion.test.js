import test from 'node:test';
import assert from 'node:assert/strict';
import {patchRoute, roamPlan, ROAM, seedFrom} from '../src/patch-motion.js';
import {walkable, clearGroundLine, nearestWalkable} from '../src/island-collision.js';
import {places} from '../src/terrain.js';
import {walkRoute} from '../src/world-state.js';
import {foragePlan} from '../src/foraging.js';
import {CLIPS} from '../src/patch-clips.js';

test('his routes between places go around trunks and stay on dry land',()=>{
 const ids=Object.keys(places);
 for(const from of ids)for(const to of ids){
  if(from===to)continue;
  const route=patchRoute(places[from],places[to],seedFrom(from+to),[places[from],...walkRoute(from,to)]);
  assert.deepEqual(route[0],nearestWalkable(...places[from]));assert.deepEqual(route.at(-1),nearestWalkable(...places[to]));
  for(let i=1;i<route.length;i++)assert.ok(clearGroundLine(route[i-1],route[i]),`${from} to ${to} blocked at ${route[i]}`);
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

test('exploring the lookout alternates movement and pauses without looping look-around',()=>{
 const plan=roamPlan('explore','lookout',seedFrom('explore|lookout|x'));
 const clips=new Set();
 let moved=false;
 for(let seconds=0;seconds<300;seconds+=.25){
  const pose=plan.at(seconds);
  moved ||= pose.moving;
  clips.add(pose.clip);
  if(pose.clip==='look-around')assert.ok(pose.time<CLIPS['look-around'].duration);
 }
 assert.ok(moved);
 assert.ok(clips.has('look-around')&&clips.has('idle'));
});

test('a roam can be joined late without replaying from the start',()=>{
 const seed=seedFrom('explore|cave|x'),early=roamPlan('explore','cave',seed),late=roamPlan('explore','cave',seed);
 for(let s=0;s<1200;s+=5)early.at(s);
 assert.deepEqual(late.at(1195),early.at(1195));
});

test('eating in the grove picks fruit facing a banana tree within reach',()=>{
  const plan=foragePlan(seedFrom('eat|banana-grove|x'));let picks=0;
  for(let t=0;t<900;t+=.5){const pose=plan.at(t);if(pose.clip!=='pick-fruit')continue;picks++;
    const {tree}=pose;
    assert.ok(Math.hypot(tree.x-pose.x,tree.z-pose.z)<1.3);assert.ok(Math.abs(Math.atan2(Math.sin(pose.heading-Math.atan2(tree.x-pose.x,tree.z-pose.z)),Math.cos(pose.heading-Math.atan2(tree.x-pose.x,tree.z-pose.z))))<.05);}
  assert.ok(picks>0);
});
