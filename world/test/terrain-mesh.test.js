import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createValleyGeometry } from '../src/valley/outside-terrain.js';
import { LANDMARKS } from '../src/valley/companion-layout.js';
import { LAKE } from '../src/valley/valley-water-layout.js';
import { groundHeight, places, paths } from '../src/terrain.js';

test('rendered valley and movement height agree at buildings, routes and water', () => {
  const mesh = new THREE.Mesh(createValleyGeometry(), new THREE.MeshBasicMaterial());
  const ray = new THREE.Raycaster();
  const samples = [...Object.values(places), ...LANDMARKS.map(({ x, z }) => [x, z]), [LAKE.x, LAKE.z]];
  for (const route of Object.values(paths)) {
    for (let i = 1; i < route.length; i++) {
      const [x, z] = route[i - 1], [nextX, nextZ] = route[i];
      samples.push([(x + nextX) / 2, (z + nextZ) / 2]);
    }
  }
  for (const [x, z] of samples) {
    ray.set(new THREE.Vector3(x, 350, z), new THREE.Vector3(0, -1, 0));
    const hit = ray.intersectObject(mesh)[0];
    assert.ok(hit, 'missing terrain at ' + [x, z]);
    assert.ok(Math.abs(hit.point.y - groundHeight(x, z)) < .001, 'height mismatch at ' + [x, z]);
  }
});
