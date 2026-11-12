import * as THREE from 'three';
import { ISLAND, groundHeight } from './terrain.js';
import { patchArm } from './patch-hands.js';

const { clamp, lerp, smoothstep } = THREE.MathUtils;
const TAU = 2 * Math.PI;

export function fishingPose(seconds, spirit, weather, seed) {
  const wait = spirit === 'tired' ? 35 : spirit === 'happy' ? 21 : 28;
  const cycle = 8 + wait + (weather === 'storm' ? 7 : 0) + seed % 7;
  const elapsed = Math.max(0, seconds);
  const time = elapsed % cycle;
  const wind = smoothstep(time, 0, 1.15);
  const flick = smoothstep(time, 1.15, 1.55);
  const flight = clamp((time - 1.43) / .82, 0, 1);
  const settle = smoothstep(time, 1.55, 2.6);
  const reel = clamp((time - (cycle - 5.8)) / 4.6, 0, 1);
  const reeling = reel > 0 && reel < 1;
  const reset = smoothstep(time, cycle - 1.2, cycle);
  const handle = (elapsed >= cycle ? 1 : smoothstep(time, 0, .7));
  const turns = reel * 5 * TAU;
  const pull = (1 - reset) * smoothstep(reel, 0, .14);
  return {
    angle: (.28 + 1.43 * wind - 1.79 * flick + .18 * settle + .29 * pull) * (1 - reset) + .28 * reset,
    thrust: .19 * (flick - settle) - .14 * (wind - flick),
    flight, reel, turns, reeling, handle,
    reach: pull * (1 - smoothstep(reel, .87, 1)),
    across: Math.sin(Math.floor(elapsed / cycle) * 2.4 + seed % 17) * 1.35,
    bob: Math.sin(elapsed * 3.2) * .032,
  };
}

export function mealPose(seconds, spirit, food, duration) {
  const rate = spirit === 'tired' ? .87 : spirit === 'happy' ? 1.08 : 1;
  const time = Math.max(0, seconds) * rate % 9.1;
  if ((seconds - time / rate) + 7.6 / rate > duration) return null;
  const first = time < 4.25;
  const biteTime = first ? time : time - 4.25;
  const lift = smoothstep(biteTime, .55, 1.45) * (1 - smoothstep(biteTime, 1.95, 2.85));
  const take = first ? smoothstep(biteTime, .05, .55) : 1;
  const putDown = first ? 1 : 1 - smoothstep(biteTime, 2.65, 3.25);
  const bite = smoothstep(biteTime, 1.52, 1.72);
  const chew = smoothstep(biteTime, 1.58, 1.86) * (1 - smoothstep(biteTime, 3.05, 3.7));
  return {
    lift, weight: take * putDown,
    portion: food === 'coconut' ? 1 : first ? lerp(1, .69, bite) : lerp(.69, .32, bite),
    open: food === 'coconut' ? .15 * lift : .44 * lift * (1 - bite) + .22 * chew * (.5 + .5 * Math.sin(biteTime * 15)),
  };
}

export function createPatchInteractions(scene, patch) {
  const bamboo = new THREE.MeshStandardMaterial({ color: 0x83512c });
  const cork = new THREE.MeshStandardMaterial({ color: 0xcb9b61 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x4b5360, metalness: .4, roughness: .4 });
  const yellow = new THREE.MeshStandardMaterial({ color: 0xf0ca38, roughness: .8 });
  const rod = new THREE.Group(), reel = new THREE.Group(), food = new THREE.Group();
  rod.name = 'fishing-rod';
  food.name = 'held-food';
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.018, .035, 2.2, 8), bamboo);
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = .98;
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(.043, .043, .34, 8), cork);
  grip.rotation.x = Math.PI / 2;
  const spool = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, .075, 10), steel);
  spool.rotation.z = Math.PI / 2;
  reel.position.set(.05, -.095, .08);
  const crank = new THREE.Mesh(new THREE.SphereGeometry(.028, 8, 6), cork);
  crank.name = 'fishing-crank';
  reel.add(spool, crank);
  rod.add(shaft, grip, reel);

  const lineGeometry = new THREE.BufferGeometry();
  const linePoints = new THREE.BufferAttribute(new Float32Array(27), 3).setUsage(THREE.DynamicDrawUsage);
  lineGeometry.setAttribute('position', linePoints);
  const line = new THREE.Line(lineGeometry, new THREE.LineBasicMaterial({ color: 0xdcd4b1, transparent: true, opacity: .8 }));
  line.frustumCulled = false;
  const bobber = new THREE.Mesh(new THREE.SphereGeometry(.066, 10, 8), new THREE.MeshStandardMaterial({ color: 0xe85543 }));
  bobber.name = 'fishing-bobber';
  const banana = new THREE.Mesh(new THREE.TorusGeometry(.11, .032, 8, 18, Math.PI * .77), yellow);
  banana.rotation.z = -.42;
  const coconut = new THREE.Mesh(new THREE.SphereGeometry(.089, 12, 9), bamboo);
  coconut.scale.set(1, .85, 1);
  food.add(banana, coconut);
  scene.add(rod, line, bobber, food);

  const target = new THREE.Vector3(), hint = new THREE.Vector3(), tip = new THREE.Vector3();
  const wrist = new THREE.Vector3(), float = new THREE.Vector3(), water = new THREE.Vector3();
  const head = new THREE.Vector3(), near = new THREE.Vector3(), direction = new THREE.Vector3(), orientation = new THREE.Quaternion();
  let right, left, rightHand, headBone;
  rod.visible = line.visible = bobber.visible = food.visible = false;

  return {
    rig(rightBone, leftBone, headJoint) {
      rightHand = rightBone;
      headBone = headJoint;
      right = patchArm(rightBone);
      left = patchArm(leftBone);
    },
    reset() {
      right?.reset();
      left?.reset();
      rod.visible = line.visible = bobber.visible = food.visible = false;
    },
    fish(pose) {
      if (!right || pose.handle <= 0) return;
      target.set(-.29 + .10 * pose.reach, .72 + .25 * Math.sin(pose.angle) + .08 * pose.reach, .35 + pose.thrust);
      right.reach(patch.localToWorld(target), patch.localToWorld(hint.set(-.65, .65, -.07)), pose.handle);
      patch.getWorldQuaternion(orientation);
      right.orient(direction.set(.45, -.8, .38).applyQuaternion(orientation), pose.handle);
      rightHand.localToWorld(rod.position.set(0, .065, 0));
      rod.quaternion.copy(orientation);
      rod.rotateX(-pose.angle);
      rod.rotateY(.05);
      crank.position.set(.10, Math.cos(pose.turns) * .094, Math.sin(pose.turns) * .094);
      if (pose.reeling && left) {
        direction.set(-.85, -.36, .36).applyQuaternion(orientation);
        reel.localToWorld(wrist.copy(crank.position)).addScaledVector(direction, -.072);
        left.reach(wrist, patch.localToWorld(hint.set(.63, .62, .09)), pose.reach);
        left.orient(direction, pose.reach);
      }

      rod.localToWorld(tip.set(0, 0, 2.08));
      patch.localToWorld(water.set(pose.across, 0, 13));
      water.y = ISLAND.pondY + .04 + pose.bob;
      patch.localToWorld(near.set(.16, 0, 7.7));
      float.copy(water).lerp(near, pose.reel);
      float.y = Math.max(water.y, groundHeight(float.x, float.z) + .09);
      float.lerp(tip, smoothstep(pose.reel, .78, 1));
      float.lerp(tip, 1 - pose.flight);
      float.y += Math.sin(Math.PI * pose.flight) * 1.45;
      bobber.position.copy(float);
      for (let i = 0; i < linePoints.count; i++) {
        const f = i / (linePoints.count - 1), sag = Math.sin(f * Math.PI) * .22;
        linePoints.setXYZ(i, lerp(tip.x, float.x, f), Math.max(ISLAND.pondY + .015, lerp(tip.y, float.y, f) - sag), lerp(tip.z, float.z, f));
      }
      linePoints.needsUpdate = true;
      rod.visible = line.visible = bobber.visible = true;
    },
    eat(pose, kind) {
      if (!right || !headBone || pose.weight <= 0) return;
      patch.getWorldQuaternion(orientation);
      headBone.getWorldPosition(head);
      // The mouth sits forward of the head joint. Bring the top of the food there.
      target.set(-.075, -.13, .27).applyQuaternion(orientation).add(head);
      near.set(-.29, .82, .34);
      patch.localToWorld(near);
      target.lerp(near, 1 - pose.lift);
      right.reach(target, patch.localToWorld(hint.set(-.62, .82, .02)), pose.weight);
      right.orient(direction.set(.2, .94, .28).applyQuaternion(orientation), pose.weight);
      rightHand.localToWorld(food.position.set(0, .082, 0));
      food.quaternion.copy(orientation);
      food.rotateZ(lerp(-.55, .35, pose.lift));
      food.translateY(.012);
      coconut.visible = kind === 'coconut';
      banana.visible = !coconut.visible;
      banana.scale.setScalar(pose.portion);
      food.visible = true;
    },
  };
}
