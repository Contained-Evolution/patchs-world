import * as THREE from 'three';
import { groundHeight } from './world-state.js';
import { VISITOR_RADIUS } from './walk-solids.js';
import { forestCollision } from './forest.js';
import { insideRock } from './climbing.js';
import { shoreFraction, walkShoreLimit, places, pondFraction, TIDE_POOLS } from './terrain.js';

const [caveX,caveZ]=places.cave;
function caveSolid(x,z){const dx=Math.abs(x-caveX),depth=caveZ-z;return depth>3&&depth<20&&((dx>5&&dx<7.3)||(depth>14.9&&dx<8));}
export function walkable(x,z,fromX=x,fromZ=z,solids) {
  if ((caveSolid(x,z)&&!caveSolid(fromX,fromZ))||(insideRock(x,z)&&!insideRock(fromX,fromZ))) return false;
  if (shoreFraction(x,z) > walkShoreLimit || pondFraction(x,z)<.94 || TIDE_POOLS.some(([px,pz,rx,rz])=>Math.hypot((x-px)/rx,(z-pz)/rz)<.72) || forestCollision(x,z,fromX,fromZ,solids ? VISITOR_RADIUS : 0)) return false;
  const d=Math.hypot(x-fromX,z-fromZ);
  if (d && Math.abs(groundHeight(x,z)-groundHeight(fromX,fromZ))/d > 1.1) return false;
  return !solids?.blocks(x, z, fromX, fromZ);
}
export function walkStep(x, z, dx, dz, solids) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (VISITOR_RADIUS / 2)));
  dx /= steps;
  dz /= steps;
  for (let i = 0; i < steps; i++) {
    if (dx && walkable(x + dx, z, x, z, solids)) x += dx;
    if (dz && walkable(x, z + dz, x, z, solids)) z += dz;
  }
  return [x, z];
}

export function createVisitorControls(camera, canvas, isModalOpen, scene, walkSolids) {
  const walk = document.querySelector('#walk');
  const follow = document.querySelector('#follow-patch');
  const mouseLock = document.querySelector('#mouse-lock');
  const hint = document.querySelector('#explore-hint');
  const patchView = camera.clone();
  const target = new THREE.Vector3();
  const destination = new THREE.Vector3();
  const sightRay = new THREE.Raycaster();
  const rayDirection = new THREE.Vector3(), sightPoint = new THREE.Vector3();
  const smoothedView = new THREE.Vector3();
  const sightHits = [];
  let solids;
  const viewOffsets = [[7, 2], [7, -.6], [4.5, .7], [4.5, -1.7]];
  let viewOffset = viewOffsets[0];
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const keys = new Set(), touch = new Set();
  let mode = 'walk', yaw = 0, pitch = 0, touchLook = null, lastTouch = 0;
  let viewAngle = 0, nextSightCheck = 0, lockedLook = false;
  try { lockedLook = localStorage.getItem('patch-mouse-look') === 'locked'; } catch {}
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', 'Explore Patch’s island');

  function pause() {
    keys.clear();
    touch.clear();
    touchLook = null;
    if (document.pointerLockElement === canvas) document.exitPointerLock();
  }

  function updateLook() {
    const walking = mode === 'walk';
    walk.setAttribute('aria-pressed', String(walking));
    document.body.classList.toggle('walking', walking);
    mouseLock.hidden = !walking;
    mouseLock.setAttribute('aria-pressed', String(lockedLook));
    const label = lockedLook ? 'Mouse look on: click the island to look; Escape releases the mouse' : 'Mouse look off: drag to look';
    mouseLock.setAttribute('aria-label', label);
    mouseLock.title = label;
    hint.textContent = walking
      ? (lockedLook ? 'Click the island to look · Esc releases mouse' : 'Drag the island to look') + ' · WASD or arrows to move · Shift faster'
      : mode === 'follow' ? 'Following Patch' : 'Viewing Patch';
  }

  function setMode(value) {
    pause();
    mode = value;
    follow.checked = value === 'follow';
    updateLook();
  }

  walk.onclick = () => {
    setMode('walk');
    canvas.focus({ preventScroll: true });
  };
  mouseLock.onclick = () => {
    lockedLook = !lockedLook;
    try { localStorage.setItem('patch-mouse-look', lockedLook ? 'locked' : 'drag'); } catch {}
    if (!lockedLook) pause();
    updateLook();
  };

  function look(dx, dy) {
    yaw -= dx * .0025;
    pitch = THREE.MathUtils.clamp(pitch - dy * .0025, -1.45, 1.45);
    camera.quaternion.setFromEuler(euler.set(pitch, yaw, 0));
  }

  function pointAt(x, y, z) {
    camera.lookAt(x, y, z);
    euler.setFromQuaternion(camera.quaternion, 'YXZ');
    yaw = euler.y;
    pitch = euler.x;
  }

  function safeLanding(x, z) {
    const scale = shoreFraction(x, z) / walkShoreLimit;
    if (scale > 1) { x /= scale; z /= scale; }
    for (let radius = 0; radius <= 60; radius += 1.5) {
      for (let i = 0; i < (radius ? 24 : 1); i++) {
        const a = i * Math.PI / 12, px = x + Math.cos(a) * radius, pz = z + Math.sin(a) * radius;
        if (walkable(px, pz, px + 10000, pz + 10000, walkSolids)) return [px, pz];
      }
    }
    return [0, 12];
  }

  function visibility(from) {
    let visible = 0;
    for (const height of [.65, 1.55]) {
      sightPoint.copy(target);
      sightPoint.y += height - 1;
      rayDirection.subVectors(sightPoint, from);
      sightRay.far = Math.max(0, rayDirection.length() - .15);
      sightRay.set(from, rayDirection.normalize());
      sightHits.length = 0;
      sightRay.intersectObjects(solids, false, sightHits);
      if (!sightHits.some(({ object }) => mode !== 'follow' || !object.material.userData.trackingCutaway)) visible++;
    }
    return visible;
  }

  function positionPatchView(position, dt, snap = false) {
    target.copy(position);
    target.y += 1;
    const positionAt = (angle, [radius, height]) => {
      const x = position.x + Math.cos(angle) * radius;
      const z = position.z + Math.sin(angle) * radius;
      destination.set(x, Math.max(position.y + height, groundHeight(x, z) + 1.6), z);
    };

    positionAt(viewAngle, viewOffset);
    smoothedView.copy(patchView.position).lerp(destination, 1 - Math.exp(-8 * dt));
    nextSightCheck -= dt;
    if (snap || nextSightCheck <= 0) {
      nextSightCheck = .15;
      solids ??= scene.children.filter(object => object.isMesh && !object.material.transparent);
      let best = visibility(destination);
      const current = snap ? best : visibility(smoothedView);
      if (best < 2 || current < 2) {
        const startAngle = viewAngle;
        for (const offset of [viewOffset, ...viewOffsets.filter(offset => offset !== viewOffset)]) {
          for (const step of [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6, 7, -7, 8]) {
            const angle = startAngle + step * Math.PI / 8;
            positionAt(angle, offset);
            const score = visibility(destination);
            if (score > best) {
              best = score;
              viewAngle = angle % (2 * Math.PI);
              viewOffset = offset;
            }
            if (best === 2) break;
          }
          if (best === 2) break;
        }
        positionAt(viewAngle, viewOffset);
        // A camera path can cross a canopy even when its endpoint has a clear view.
        if (best > current) snap = true;
      }
    }
    if (snap || patchView.position.distanceToSquared(destination) > 400) patchView.position.copy(destination);
    else patchView.position.lerp(destination, 1 - Math.exp(-8 * dt));
    patchView.lookAt(target);
  }

  const canWalk = () => mode === 'walk' && !isModalOpen();
  canvas.addEventListener('click', () => {
    if (!canWalk() || !lockedLook || Date.now() - lastTouch < 800 || matchMedia('(pointer: coarse)').matches) return;
    canvas.requestPointerLock?.();
  });
  document.addEventListener('mousemove', e => {
    if (canWalk() && document.pointerLockElement === canvas) look(e.movementX, e.movementY);
  });
  const allowed = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight']);
  addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.pointerLockElement === canvas) { document.exitPointerLock(); return; }
    if (!canWalk() || !allowed.has(e.code) || e.altKey || e.metaKey || e.ctrlKey ||
        ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(document.activeElement?.tagName)) return;
    e.preventDefault();
    keys.add(e.code);
  });
  addEventListener('keyup', e => keys.delete(e.code));
  document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement !== canvas) keys.clear(); });
  addEventListener('blur', pause);
  canvas.addEventListener('pointerdown', e => {
    if (!canWalk() || !(e.pointerType === 'touch' || (e.pointerType === 'mouse' && !lockedLook && e.button === 0))) return;
    if (e.pointerType === 'touch') lastTouch = Date.now();
    touchLook = { id: e.pointerId, x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (touchLook?.id !== e.pointerId) return;
    look(e.clientX - touchLook.x, e.clientY - touchLook.y);
    touchLook.x = e.clientX;
    touchLook.y = e.clientY;
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(event, e => { if (touchLook?.id === e.pointerId) touchLook = null; });
  }
  document.querySelectorAll('[data-move]').forEach(button => {
    const name = button.dataset.move;
    button.addEventListener('contextmenu', e => e.preventDefault());
    button.addEventListener('pointerdown', e => {
      e.preventDefault();
      window.getSelection()?.removeAllRanges();
      button.setPointerCapture(e.pointerId);
      touch.add(name);
    });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      button.addEventListener(event, () => touch.delete(name));
    }
  });
  camera.position.set(9, groundHeight(9, 14) + 1.6, 14);
  pointAt(0, 5, 0);
  updateLook();

  return {
    pause,
    get camera() { return mode === 'walk' ? camera : patchView; },
    resize(aspect) {
      for (const view of [camera, patchView]) {
        view.aspect = aspect;
        view.updateProjectionMatrix();
      }
    },
    findPatch(position) {
      if (follow.checked || position.y > groundHeight(position.x, position.z) + 3) {
        setMode(follow.checked ? 'follow' : 'watch');
        viewAngle = Math.PI / 4;
        viewOffset = viewOffsets[0];
        positionPatchView(position, 0, true);
        return;
      }
      setMode('walk');
      const [x, z] = safeLanding(position.x + 3, position.z + 4);
      camera.position.set(x, groundHeight(x, z) + 1.6, z);
      pointAt(position.x, position.y + 1, position.z);
      canvas.focus({ preventScroll: true });
    },
    stopFollowing() {
      setMode('walk');
    },
    track(position, dt) {
      if (mode === 'follow') positionPatchView(position, dt);
    },
    update(dt) {
      if (!canWalk()) return;
      const has = (...codes) => codes.some(code => keys.has(code));
      const forward = Number(has('KeyW', 'ArrowUp') || touch.has('forward')) - Number(has('KeyS', 'ArrowDown') || touch.has('back'));
      const side = Number(has('KeyD', 'ArrowRight') || touch.has('right')) - Number(has('KeyA', 'ArrowLeft') || touch.has('left'));
      const length = Math.hypot(forward, side);
      if (!length) return;
      const speed = 3.5 * (has('ShiftLeft', 'ShiftRight') ? 2 : 1) * dt / length;
      const dx = (-Math.sin(yaw) * forward + Math.cos(yaw) * side) * speed;
      const dz = (-Math.cos(yaw) * forward - Math.sin(yaw) * side) * speed;
      const { x, z } = camera.position;
      const [nextX, nextZ] = walkStep(x, z, dx, dz, walkSolids);
      camera.position.set(nextX, groundHeight(nextX, nextZ) + 1.6, nextZ);
      return Math.hypot(nextX - x, nextZ - z);
    }
  };
}
