import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {validateLayout,emptyLayout,transformedBounds,migrateScenery} from '../../shared/editor/model.mjs';
import {EditorStore} from '../../shared/editor/store.mjs';
import {WorldRegistry} from '../src/editor/registry.js';
const item=(id='new')=>({id,asset:'primitive:block',name:'Block',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]});
function storage(){const data=new Map();return {get:async k=>structuredClone(data.get(k)),async put(k,v){if(typeof k==='object')for(const [a,b]of Object.entries(k))data.set(a,structuredClone(b));else data.set(k,structuredClone(v));},transaction(fn){return fn(this);}};}
test('draft revisions never change public layout until atomic publish; rollback restores the complete previous revision',async()=>{
 const store=new EditorStore(storage());const layout={...emptyLayout(),objects:[item()]};
 assert.equal((await store.save({revision:0,layout})).revision,1);
 assert.deepEqual((await store.published()).layout.objects,[]);
 assert.equal((await store.save({revision:0,layout})).status,409);
 assert.equal((await store.publish({revision:0})).status,409);
 assert.equal((await store.publish({revision:1})).revision,1);
 assert.deepEqual((await store.published()).layout,layout);
 assert.equal((await store.draft()).baseRevision,1);
 assert.equal((await store.rollback({revision:0})).status,409);
 assert.equal((await store.rollback({revision:1})).revision,2);
 assert.deepEqual((await store.published()).layout.objects,[]);
});
test('rejected publish keeps draft and public revision intact',async()=>{const store=new EditorStore(storage(),async()=>emptyLayout(),async()=>{throw new Error('Protected fixture');});await store.save({revision:0,layout:emptyLayout()});await assert.rejects(()=>store.publish({revision:1}),/Protected fixture/);assert.equal((await store.published()).revision,0);assert.equal((await store.draft()).revision,1);});
test('invalid asset paths, duplicate IDs, and nonfinite transforms fail rather than dropping objects',()=>{for(const objects of [[item(),item()],[{...item(),asset:'catalog:../secret.glb'}],[{...item(),position:[NaN,0,0]}],[{...item(),scale:[0,1,1]}]])assert.throws(()=>validateLayout({...emptyLayout(),objects}));});
test('rotated and scaled bounds match Three.js transforms',()=>{const o={...item(),position:[11,3,-7],rotation:[.3,.7,.4],scale:[2,.5,3]},b=[[-2,-1,-3],[4,5,6]],actual=transformedBounds(b,o),matrix=new THREE.Matrix4().compose(new THREE.Vector3(...o.position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...o.rotation)),new THREE.Vector3(...o.scale)),expected=new THREE.Box3(new THREE.Vector3(...b[0]),new THREE.Vector3(...b[1])).applyMatrix4(matrix);for(let i=0;i<3;i++){assert.ok(Math.abs(actual[0][i]-expected.min.getComponent(i))<1e-8);assert.ok(Math.abs(actual[1][i]-expected.max.getComponent(i))<1e-8);}});
test('legacy scenery migration keeps position, seeded yaw, scale and walkways',()=>{const old={scenery:[{id:'a',type:'tree',x:32,z:48}],walkways:[{x:2,z:2,material:'wood'}]},m=migrateScenery(old,()=>17,{tree:{name:'Tree',path:'tree.glb'}});assert.deepEqual(m.objects[0].position,[32,17,48]);assert.deepEqual(m.objects[0].scale,[1,1,1]);assert.deepEqual(m.walkways,old.walkways);assert.equal(m.objects[0].rotation[1],(32*.21+48*.35)%(Math.PI*2));});
test('instance edits move all parts and collision together; delete and restoration do not leave ghost obstacles',async()=>{const scene=new THREE.Scene(),registry=new WorldRegistry(scene),mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial(),2);scene.add(mesh);mesh.setMatrixAt(0,new THREE.Matrix4().makeTranslation(5,1,6));mesh.setMatrixAt(1,new THREE.Matrix4().makeTranslation(5,3,6));registry.instance('base:tree:1','Tree',mesh,0,[5,0,6],[[-.5,0,-.5],[.5,4,.5]]);registry.instance('base:tree:1','Tree',mesh,1,[5,0,6],[[-.5,0,-.5],[.5,4,.5]]);const moved={...item('base:tree:1'),asset:'base:tree:1',position:[15,2,16]};await registry.apply({...emptyLayout(),objects:[moved]},()=>{});const matrix=new THREE.Matrix4();mesh.getMatrixAt(1,matrix);assert.deepEqual(new THREE.Vector3().setFromMatrixPosition(matrix).toArray(),[15,5,16]);assert.deepEqual(registry.collisionBoxes({objects:[moved]})[0],[[14.5,2,15.5],[15.5,6,16.5]]);await registry.apply({...emptyLayout(),objects:[{id:moved.id,deleted:true}]},()=>{});assert.deepEqual(registry.collisionBoxes({objects:[{id:moved.id,deleted:true}]}),[]);await registry.apply(emptyLayout(),()=>{});mesh.getMatrixAt(0,matrix);assert.deepEqual(new THREE.Vector3().setFromMatrixPosition(matrix).toArray(),[5,1,6]);});
test('asset load failure leaves the entire last published scene unchanged',async()=>{const scene=new THREE.Scene(),registry=new WorldRegistry(scene);await registry.apply({...emptyLayout(),objects:[item()]},async()=>new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial()));const root=registry.added.get('new');await assert.rejects(()=>registry.apply({...emptyLayout(),objects:[{...item(),position:[40,0,0]},item('bad')]},async id=>{throw new Error('Missing asset');}),/Missing asset/);assert.equal(registry.added.get('new'),root);assert.equal(root.position.x,0);});
test('published layout polling resumes when returning from the editor through browser history',async t=>{
 const {watchPublished}=await import('../src/editor/published.js'),listeners=new Map();let revision=0,applied=0,intervals=0,cleared=0;const previous=globalThis.document;globalThis.document={hidden:false};t.after(()=>{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;});
 t.mock.method(globalThis,'setInterval',()=>++intervals);t.mock.method(globalThis,'clearInterval',()=>cleared++);t.mock.method(globalThis,'fetch',async()=>Response.json({revision,layout:emptyLayout()}));
 const oldListener=globalThis.addEventListener;globalThis.addEventListener=(name,fn)=>listeners.set(name,fn);t.after(()=>{if(oldListener===undefined)delete globalThis.addEventListener;else globalThis.addEventListener=oldListener;});
 watchPublished('/api/editor',async()=>applied++);await new Promise(setImmediate);assert.equal(applied,1);listeners.get('pagehide')();assert.equal(cleared,1);revision=1;listeners.get('pageshow')();await new Promise(setImmediate);assert.equal(intervals,2);assert.equal(applied,2);
});
