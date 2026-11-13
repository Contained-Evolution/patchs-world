import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {WorldRegistry} from '../src/editor/registry.js';
import {addCampRulesSign} from '../src/camp-rules-sign.js';
import {addCampHammock} from '../src/camp-hammock.js';
import {addPondScenery} from '../src/pond-scenery.js';
import {hammock,hammockPoint,hammockSupports,HAMMOCK_SUPPORT_SOURCE,HAMMOCK_DEFINITION,applyHammockRecord} from '../src/hammock.js';
import {pondSwings,POND_SWING_DEFINITIONS,applyPondRecords} from '../src/pond-swings.js';
import {worldPoint,fixtureHeight} from '../../shared/editor/camp.mjs';
import {groundHeight,places} from '../src/terrain.js';
import {walkRoute} from '../src/world-state.js';
import {createWalkSolids} from '../src/island-collision.js';
import {boundsCollision} from '../../shared/editor/collision.mjs';
const noAssets=async()=>{throw new Error('Unexpected asset load');};
function documentFixture(t){const previous=globalThis.document,canvas={width:100,height:100};canvas.getContext=()=>new Proxy({canvas},{get:(o,k)=>k in o?o[k]:k==='measureText'?text=>({width:text.length*10}):()=>{}});globalThis.document={baseURI:'http://localhost/',createElement:()=>canvas,querySelector:()=>null,querySelectorAll:()=>[],fonts:{load:()=>Promise.resolve()}};t.after(()=>{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;});}
function delayedModels(t){const requests=[];t.mock.method(GLTFLoader.prototype,'load',(url,loaded)=>{requests.push(()=>{const root=new THREE.Group();root.add(new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial()));loaded({scene:root});});});return ()=>requests.forEach(f=>f());}
const close=(actual,expected)=>assert.ok(actual.distanceTo(new THREE.Vector3(...expected))<1e-5,`${actual.toArray()} != ${expected}`);
test('sign moves, duplicates, deletes and restores without leaving its old collision',async t=>{
 documentFixture(t);const scene=new THREE.Scene(),registry=new WorldRegistry(scene),solids=createWalkSolids(),mat=new THREE.MeshBasicMaterial();addCampRulesSign(scene,solids,{bark:mat,wood:mat,rope:mat,foliage:mat},new THREE.PlaneGeometry(1,1),registry);
 const entry=registry.entries.get('base:camp-sign');assert.equal(entry.fixture,false);const size=new THREE.Box3().setFromObject(entry.root).getSize(new THREE.Vector3()),moved={...entry.base,position:[-24,groundHeight(-24,-18)-.32,-18]};
 await registry.apply({objects:[moved]},noAssets);let blocks=boundsCollision(registry.collisionBoxes({objects:[moved]}),groundHeight);assert.equal(blocks(3.9,6),false);assert.equal(blocks(-24,-18),true);
 const copy={...moved,id:'copy-sign',position:[-18,moved.position[1],-18]};await registry.apply({objects:[moved,copy]},noAssets);close(new THREE.Box3().setFromObject(registry.added.get(copy.id)).getSize(new THREE.Vector3()),size.toArray());
 await registry.apply({objects:[{id:entry.id,deleted:true}]},noAssets);assert.equal(entry.root.visible,false);assert.deepEqual(registry.collisionBoxes({objects:[{id:entry.id,deleted:true}]}),[]);
 await registry.apply({objects:[]},noAssets);assert.equal(entry.root.visible,true);close(entry.root.position,entry.base.position);
});
test('hammock palms, lashings and bed move together even when models finish loading after the edit',async t=>{
 documentFixture(t);t.after(()=>applyHammockRecord({objects:[]}));const finish=delayedModels(t),scene=new THREE.Scene(),registry=new WorldRegistry(scene),pending=addCampHammock(scene,new THREE.MeshBasicMaterial(),registry);
 const record={...HAMMOCK_DEFINITION,position:[-24,groundHeight(-24,-18),-18],rotation:[0,.7,0]};await registry.apply({objects:[record]},noAssets);applyHammockRecord({objects:[record]});finish();await pending;
 const root=registry.entries.get(record.id).root,content=root.children[0],bed=content.children[0];close(bed.getWorldPosition(new THREE.Vector3()),[record.position[0],record.position[1]+hammock.modelHeight,record.position[2]]);
 const rope=content.children.find(o=>o.geometry?.type==='TubeGeometry'),end=rope.geometry.parameters.path.points.at(-1).clone();close(rope.localToWorld(end),bed.localToWorld(new THREE.Vector3(...HAMMOCK_SUPPORT_SOURCE[0].corner)).toArray());
 const source=HAMMOCK_SUPPORT_SOURCE[0],support=worldPoint(record,source.x-HAMMOCK_DEFINITION.position[0],source.z-HAMMOCK_DEFINITION.position[2]);assert.deepEqual([hammockSupports[0].x,hammockSupports[0].z],support);assert.deepEqual(hammockPoint(0,hammock.sleepOffsetZ),worldPoint(record,0,hammock.sleepOffsetZ));assert.deepEqual(walkRoute('computer','hammock').at(-1),places.hammock);
 const blocks=registry.fixtureCollision({objects:[record]},groundHeight);assert.equal(blocks(...support),true);assert.equal(blocks(0,1),false);
 await registry.apply({objects:[]},noAssets);applyHammockRecord({objects:[]});close(root.position,HAMMOCK_DEFINITION.position);
});
test('pond palms carry their anchors and ropes, recomputing the hanging grip at the new bank position',async t=>{
 documentFixture(t);t.after(()=>applyPondRecords({objects:[]}));const finish=delayedModels(t),scene=new THREE.Scene(),registry=new WorldRegistry(scene),pond=addPondScenery(scene,new THREE.MeshBasicMaterial(),registry),base=POND_SWING_DEFINITIONS[0];
 const x=base.position[0]+.5,z=base.position[2],record={...base,position:[x,fixtureHeight(base.id,x,z,base.rotation[1],groundHeight),z]};await registry.apply({objects:[record]},noAssets);applyPondRecords({objects:[record]});finish();await Promise.resolve();await Promise.resolve();pond.update(.01);
 const root=registry.entries.get(record.id).root,line=root.children.find(o=>o.geometry?.type==='CylinderGeometry'),tie=root.children.find(o=>o.geometry?.type==='SphereGeometry');close(tie.getWorldPosition(new THREE.Vector3()),pondSwings[0].anchor);close(line.localToWorld(new THREE.Vector3(0,-.5,0)),pondSwings[0].anchor);close(line.localToWorld(new THREE.Vector3(0,.5,0)),pondSwings[0].start);
});
