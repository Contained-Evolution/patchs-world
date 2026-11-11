import test from 'node:test';
import assert from 'node:assert/strict';
import { foragePlan, forageTrees, FOOD_STORE } from '../src/foraging.js';
import { CLIPS } from '../src/patch-clips.js';
import { walkable } from '../src/visitor-controls.js';

test('foraging collects fruit before carrying it home and opening storage',()=>{
 assert.ok(forageTrees().length>0);
 const plan=foragePlan(42),other=foragePlan(42),used=new Set();let previous=null,picked=false,returned=false,opened=false;
 for(let t=0;t<900;t+=.1){
  const pose=plan.at(t);assert.deepEqual(pose,other.at(t));used.add(pose.clip);
  assert.ok(CLIPS[pose.clip]);assert.ok(pose.lid>=0&&pose.lid<=1);
  if(previous)assert.ok(walkable(pose.x,pose.z,previous.x,previous.z));
  if(pose.picking&&pose.filled)picked=true;
  if(pose.moving&&pose.filled){assert.ok(picked);returned=true;}
  if(pose.opening){assert.ok(returned);assert.equal(pose.x,FOOD_STORE[0]);assert.equal(pose.z,FOOD_STORE[1]);opened=true;}
  if(pose.deposit){assert.ok(opened);assert.equal(pose.lid,1);}
  previous=pose;
 }
 for(const clip of ['pick-fruit','pick-up','carry-walk','carry-jog','carry-run','carry-stop','open-lid'])assert.ok(used.has(clip),clip);
 assert.deepEqual(foragePlan(42).at(899),plan.at(899));
});

test('one-shot basket interactions stay within the source clip and preserve position',()=>{
 const plan=foragePlan(9);
 for(let t=0;t<500;t+=.07){const pose=plan.at(t);if(!pose.moving){assert.ok(pose.time>=0&&pose.time<=CLIPS[pose.clip].duration);assert.deepEqual(pose.from,pose.to);}}
});
