import * as THREE from 'three';
import { BALL_PLAY_DURATION } from '../../shared/state.js';
import { groundHeight } from './terrain.js';

const RADIUS = .16;
const DROP_X = 3.3;
const DROP_Z = 2.6;

function isPlaying(play, now, place, target) {
  return play && !target && play.place === place && now >= play.at && now - play.at < BALL_PLAY_DURATION;
}

export function activeBallPlay(balls, now, place, target) {
  return balls.find(({ play }) => isPlaying(play, now, place, target))?.play;
}

export function createCampBalls(scene, shelf) {
  const geometry = new THREE.SphereGeometry(RADIUS, 24, 16);
  const objects = [];
  const freshColor = new THREE.Color('#f57939');
  const wornColor = new THREE.Color('#a87952');
  const start = new THREE.Vector3();
  const hand = new THREE.Vector3();
  const ground = new THREE.Vector3();

  function update(balls, now, patch, handBone, place, target, reducedMotion) {
    let onShelf = 0;
    let atDrop = 0;
    balls.forEach(({ place: location, wear, play }, index) => {
      if (!objects[index]) {
        const ball = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
        ball.castShadow = true;
        scene.add(ball);
        objects[index] = ball;
      }
      const ball = objects[index];
      const offered = location === 'drop-off';
      const slot = offered ? atDrop++ : onShelf++;
      const x = offered ? DROP_X + (slot % 5) * .36 : shelf[0] + ((slot % 5) - 2) * .4;
      const z = offered ? DROP_Z + Math.floor(slot / 5) * .36 : shelf[2] + (Math.floor(slot / 5) % 2) * .38 - .18;
      const y = offered ? groundHeight(x, z) : shelf[1] + Math.floor(slot / 10) * 1.15;
      start.set(x, y + RADIUS, z);
      ball.position.copy(start);
      ball.material.color.copy(freshColor).lerp(wornColor, wear);
      ball.material.roughness = .24 + wear * .65;
      ball.visible = true;
      if (reducedMotion || !handBone || !isPlaying(play, now, place, target)) return;
      const elapsed = now - play.at;
      patch.updateMatrixWorld(true);
      handBone.getWorldPosition(hand);
      ground.set(hand.x, groundHeight(hand.x, hand.z) + RADIUS, hand.z);
      if (elapsed < 1200) {
        ball.position.lerp(hand, THREE.MathUtils.smoothstep(elapsed, 0, 1200));
      } else if (elapsed > BALL_PLAY_DURATION - 1200) {
        ball.position.copy(hand).lerp(start, THREE.MathUtils.smoothstep(elapsed, BALL_PLAY_DURATION - 1200, BALL_PLAY_DURATION));
      } else {
        const cycle = ((elapsed - 1200) % 960) / 960;
        ball.position.copy(ground);
        ball.position.y += (1 - wear * .85) * Math.max(.45, hand.y - ground.y) * 4 * cycle * (1 - cycle);
      }
    });
    for (let index = balls.length; index < objects.length; index++) objects[index].visible = false;
  }

  return { update };
}
