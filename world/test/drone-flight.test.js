import assert from 'node:assert/strict';
import test from 'node:test';
import { createDrone } from '../src/drone-flight.js';
import { forest } from '../src/forest.js';
import { groundHeight, places } from '../src/terrain.js';

test('the drone aims from directly down to the horizon and keeps its flight height when aiming', () => {
  const drone = createDrone();
  drone.reset();
  const { camera } = drone;
  const start = camera.position.clone();
  assert.equal(camera.rotation.x, -Math.PI / 2);
  for (let step = 0; step < 20; step++) assert.equal(drone.steer(0, 1, 0, 0, .1), 0);
  assert.equal(camera.rotation.x, 0);
  assert(camera.position.equals(start));
  assert.equal(drone.steer(1, 0, 0, 0, .1), 1);
  assert(camera.rotation.y < 0);
  assert(camera.position.equals(start));
});

test('the drone descends over open grass and stops above a tree crown', () => {
  const drone = createDrone();
  drone.reset();
  const { camera } = drone;
  const [meadowX, meadowZ] = places.meadow;
  const tree = forest.find(item => item.broad && !item.swing && Math.abs(groundHeight(item.x,item.z)-groundHeight(item.x,item.z+9)) < .3);
  for (const [x, z, height] of [
    [meadowX, meadowZ, groundHeight(meadowX, meadowZ) + 1.8],
    [tree.x, tree.z, groundHeight(tree.x, tree.z) + tree.h + 6]
  ]) {
    camera.position.set(x, 100, z);
    for (let step = 0; step < 100; step++) drone.steer(0, 0, 0, -1, .1);
    assert(camera.position.y >= height);
    if (x === meadowX) assert.equal(camera.position.y, height);
    assert.equal(drone.steer(0, 0, 0, -1, .1), 0);
    assert.equal(drone.steer(0, 0, 0, 1, .1), 1);
    assert(camera.position.y > height);
  }
});

test('the drone cannot enter a crown horizontally until it climbs above it', () => {
  const drone = createDrone();
  drone.reset();
  const { camera } = drone;
  const tree = forest.find(item => item.broad && !item.swing &&
    forest.every(other => other === item || Math.hypot(other.x-item.x, other.z-item.z-9) > 9) &&
    groundHeight(item.x,item.z+9) + 2 < groundHeight(item.x,item.z) + item.h);
  camera.position.set(tree.x, groundHeight(tree.x, tree.z + 9) + 2, tree.z + 9);
  assert.equal(drone.steer(0, 0, 1, 0, .1), 0);
  assert.equal(camera.position.z, tree.z + 9);
  camera.position.y = groundHeight(tree.x, tree.z) + tree.h + 25;
  assert.equal(drone.steer(0, 0, 1, 0, .1), 1);
  assert(camera.position.z < tree.z + 9);
});
