import test from 'node:test';
import assert from 'node:assert/strict';
import { Bone, Vector3 } from 'three';
import { patchArm } from '../src/patch-hands.js';
import { fishingPose, mealPose } from '../src/patch-interactions.js';

test('the arm reaches the wrist target without stretching and restores the mixer pose', () => {
  const parent = new Bone(), shoulder = new Bone(), elbow = new Bone(), hand = new Bone();
  parent.add(shoulder);
  shoulder.add(elbow);
  elbow.add(hand);
  elbow.position.y = .25;
  hand.position.y = .3;
  parent.rotation.y = .5;
  const original = hand.getWorldPosition(new Vector3());
  const arm = patchArm(hand), target = new Vector3(.19, .27, .2);
  arm.reach(target, new Vector3(-1, 0, 0));
  arm.orient(new Vector3(0, 0, 1));
  assert.ok(hand.getWorldPosition(new Vector3()).distanceTo(target) < 1e-6);
  arm.reset();
  assert.ok(hand.getWorldPosition(new Vector3()).distanceTo(original) < 1e-6);
});

test('fishing casts before waiting and winds in the line before the next cast', () => {
  const pose = seconds => fishingPose(seconds, 'okay', 'clear', 0);
  assert.ok(pose(1.15).angle > pose(1.55).angle);
  assert.ok(pose(1.8).flight > 0 && pose(1.8).flight < 1);
  assert.equal(pose(20).flight, 1);
  assert.equal(pose(20).reel, 0);
  assert.ok(pose(32).reeling && pose(33).turns > pose(32).turns);
  assert.equal(pose(35).reel, 1);
  assert.equal(pose(36).flight, 0);
  assert.equal(fishingPose(32, 'tired', 'storm', 0).reel, 0);
});

test('food rises, is bitten or sipped, and returns before the idle beat ends', () => {
  const pose = seconds => mealPose(seconds, 'okay', 'banana', 10);
  assert.equal(pose(0).weight, 0);
  assert.equal(pose(1.5).lift, 1);
  assert.ok(pose(1.78).portion < pose(1.5).portion);
  assert.equal(pose(3).lift, 0);
  assert.equal(pose(7.6).weight, 0);
  assert.equal(pose(9.8), null);
  assert.equal(mealPose(1.8, 'okay', 'coconut', 10).portion, 1);
});
