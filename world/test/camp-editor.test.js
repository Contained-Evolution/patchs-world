import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {WorldRegistry} from '../src/editor/registry.js';
import {CAMP_DEFAULTS,applyCampRecords,SEATS,seatFor,insideComputerTent,tentPoint} from '../src/furniture.js';
import {places,groundHeight} from '../src/terrain.js';
import {campRecords,fixtureHeight,fixtureBlocks,worldPoint,TENT_ID,COMPUTER_ID,validateFixture} from '../../shared/editor/camp.mjs';
import {patchRoute} from '../src/patch-motion.js';
import {createWalkSolids,clearGroundLine} from '../src/island-collision.js';
const moved=(base,x,z,yaw=base.rotation[1])=>({...base,position:[x,fixtureHeight(base.id,x,z,yaw,groundHeight),z],rotation:[0,yaw,0]});
function setup(){const scene=new THREE.Scene(),registry=new WorldRegistry(scene);for(const base of CAMP_DEFAULTS){const root=new THREE.Group();root.add(new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial()));registry.object(base,root);}return {scene,registry};}
test('tent and computer are independently selectable and move without changing the other fixture',async()=>{
 const {registry}=setup(),tent=registry.entries.get(TENT_ID),computer=registry.entries.get(COMPUTER_ID),record=moved(computer.base,-24,-18,Math.PI/2);
 await registry.apply({objects:[record]},()=>{});
 assert.equal(tent.root.userData.editorId,TENT_ID);assert.equal(computer.root.userData.editorId,COMPUTER_ID);
 assert.deepEqual(tent.root.position.toArray(),CAMP_DEFAULTS[0].position);assert.deepEqual(computer.root.position.toArray(),record.position);
 const onComputer=registry.fixtureCollision({objects:[record]},groundHeight);assert.equal(onComputer(...worldPoint(record,0,.6)),true);
 assert.equal(onComputer(...worldPoint(CAMP_DEFAULTS[1],0,.6)),false);
 await registry.apply({objects:[]},()=>{});assert.deepEqual(computer.root.position.toArray(),CAMP_DEFAULTS[1].position);
 assert.throws(()=>registry.cloneBuiltin(COMPUTER_ID),/cannot be duplicated/);
});
test('computer sitting position, heading and destination follow the desk and restore on undo',t=>{
 t.after(()=>applyCampRecords(CAMP_DEFAULTS));
 const pc=moved(CAMP_DEFAULTS[1],-24,-18,.7);applyCampRecords(campRecords({objects:[pc]},CAMP_DEFAULTS));
 assert.deepEqual(places.computer,[-24,-18]);assert.deepEqual([seatFor('computer','computer').x,SEATS.computer.z],[-24,-18]);assert.equal(SEATS.computer.heading,.7);
 applyCampRecords(CAMP_DEFAULTS);assert.deepEqual(places.computer,[-7,-6]);assert.equal(SEATS.computer.heading,Math.PI);
});
test('rotated tent retains hollow space, solid walls and reachable doors at its new position',t=>{
 t.after(()=>applyCampRecords(CAMP_DEFAULTS));
 const tent=moved(CAMP_DEFAULTS[0],-24,-18,Math.PI/4);validateFixture(tent,groundHeight);applyCampRecords([tent,CAMP_DEFAULTS[1]]);
 const blocks=fixtureBlocks(tent,CAMP_DEFAULTS[0].colliders,groundHeight),solids=createWalkSolids();solids.blocks=blocks;
 const at=(x,z)=>worldPoint(tent,x,z);
 assert.equal(insideComputerTent(...at(0,0)),true);assert.equal(blocks(...at(0,0)),false);
 assert.equal(blocks(...at(0,3.05)),true);assert.equal(blocks(...at(3.45,0)),false);
 assert.equal(blocks(...worldPoint(CAMP_DEFAULTS[0],0,3.05)),false);
 assert.deepEqual(tentPoint(3.45,0),at(3.45,0));
 const start=at(6,1),goal=at(0,0),route=patchRoute(start,goal,19,[],solids);
 assert.ok(Math.hypot(route.at(-1)[0]-goal[0],route.at(-1)[1]-goal[1])<.1);
 for(let i=1;i<route.length;i++)assert.equal(clearGroundLine(route[i-1],route[i],solids),true);
});
test('working fixtures reject deletion, arbitrary scaling, tipping and floating',()=>{
 const pc=CAMP_DEFAULTS[1];for(const bad of [{...pc,deleted:true},{...pc,scale:[2,1,1]},{...pc,rotation:[.2,0,0]},{...pc,position:[pc.position[0],pc.position[1]+5,pc.position[2]]}])assert.throws(()=>validateFixture(bad,groundHeight));
});
