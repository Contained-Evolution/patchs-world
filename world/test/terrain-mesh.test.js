import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createTerrainTiles} from '../src/terrain-mesh.js';
import {createPondSteps} from '../src/pond-scenery.js';
import {pondStairs, stairPoint, groundHeight, places, paths, shoreFraction, STREAM, TIDE_POOLS} from '../src/terrain.js';
test('rendered terrain and movement height agree at landmarks, routes and water',()=>{
 const material=new THREE.MeshBasicMaterial(),meshes=createTerrainTiles().map(g=>new THREE.Mesh(g,material)),ray=new THREE.Raycaster(),samples=[...Object.values(places),...STREAM.filter(([x,z])=>shoreFraction(x,z)<1).map(([x,z])=>[x,z]),...TIDE_POOLS.map(([x,z])=>[x,z])];
 meshes.push(...createPondSteps(material));
 for(const stair of pondStairs)for(let i=0;i<stair.count;i++)samples.push(stairPoint(stair,(i+.5)*stair.run));
 for(const route of Object.values(paths))for(let i=1;i<route.length;i++){const a=route[i-1],b=route[i];samples.push([(a[0]+b[0])/2,(a[1]+b[1])/2]);}
 for(const [x,z] of samples){ray.set(new THREE.Vector3(x,150,z),new THREE.Vector3(0,-1,0));const hit=ray.intersectObjects(meshes)[0];assert.ok(hit,`missing terrain at ${x},${z}`);assert.ok(Math.abs(hit.point.y-groundHeight(x,z))<.001,`terrain mismatch at ${x},${z}`);}
 meshes.forEach(m=>m.geometry.dispose());material.dispose();
});
