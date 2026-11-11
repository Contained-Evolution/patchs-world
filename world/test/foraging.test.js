import test from 'node:test';
import assert from 'node:assert/strict';
import { foragePlan, forageTrees, FOOD_STORE } from '../src/foraging.js';
import { CLIPS } from '../src/patch-clips.js';
import { walkable } from '../src/visitor-controls.js';
import * as THREE from 'three';
import { createFoodProps } from '../src/food-props.js';

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

test('closing the lid retraces the opening animation at the same clip time',()=>{
 const plan=foragePlan(9);let opening,closing;
 for(let t=0;t<300;t+=.1){const pose=plan.at(t);if(pose.opening&&!opening)opening=pose;if(pose.closing){closing=pose;break;}}
 assert.ok(opening&&closing);
 for(const f of [.05,.25,.5,.75,.95]){
  const a=plan.at(opening.t0+CLIPS['open-lid'].duration*f),b=plan.at(closing.t0+CLIPS['open-lid'].duration*(1-f));
  assert.ok(Math.abs(a.time-b.time)<1e-9);assert.ok(Math.abs(a.lid-b.lid)<1e-9);
 }
});

test('the carried basket follows his actual turn and the lid opens above its hinge',()=>{
 const scene=new THREE.Scene(),patch=new THREE.Group(),left=new THREE.Object3D(),right=new THREE.Object3D();
 patch.add(left,right);scene.add(patch);left.position.set(-.25,1,.4);right.position.set(.25,1,.4);patch.rotation.y=.4;
 const props=createFoodProps(scene),basket=scene.getObjectByName('food-basket'),lid=scene.getObjectByName('food-store-lid');
 props.update({basket:'held',heading:2,progress:.5,lid:1,filled:true},patch,left,right);
 assert.equal(basket.rotation.y,patch.rotation.y);
 const middle=left.getWorldPosition(new THREE.Vector3()).lerp(right.getWorldPosition(new THREE.Vector3()),.5);middle.y-=.26;
 assert.ok(basket.position.distanceTo(middle)<1e-9);
 scene.updateMatrixWorld(true);
 assert.ok(lid.localToWorld(new THREE.Vector3(0,0,-.42)).y>lid.getWorldPosition(new THREE.Vector3()).y);
 props.update(null,patch,left,right);assert.equal(basket.visible,false);assert.equal(lid.rotation.x,0);
});

test('invalid or negative elapsed time safely starts foraging at the beginning',()=>{
 for(const seconds of [NaN,Infinity,-Infinity,-1])assert.deepEqual(foragePlan(9).at(seconds),foragePlan(9).at(0));
});
