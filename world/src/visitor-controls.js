import * as THREE from 'three';
import { groundHeight } from './world-state.js';
import { inPond, nearestWalkable, visitorEyeHeight, walkStep } from './island-collision.js';
import { COMPUTER_TENT, insideComputerTent, tentPoint } from './furniture.js';
import { shoreFraction, walkShoreLimit, vinePoint } from './terrain.js';

export { walkable, walkStep } from './island-collision.js';

export function createVisitorControls(camera, canvas, isModalOpen, scene, walkSolids) {
  const vineButton = document.querySelector('#climb-vines');
  const vineEnds = [vinePoint(0), vinePoint(1)];
  let climb = null;
  const moveStick = document.querySelector('#move-stick');
  const returnToWalk = document.querySelector('#return-to-walk');
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
  let solids, wasInTent = false;
  const viewOffsets = [[7, 2], [7, -.6], [4.5, .7], [4.5, -1.7]];
  let viewOffset = viewOffsets[0];
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const keys = new Set();
  let stickPointer = null, stickSide = 0, stickForward = 0;
  let mode = 'walk', yaw = 0, pitch = 0, touchLook = null, lastTouch = 0;
  const touchScreen = matchMedia('(any-pointer: coarse)');
  let viewAngle = 0, nextSightCheck = 0, lockedLook = false;
  try { lockedLook = localStorage.getItem('patch-mouse-look') === 'locked'; } catch {}
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', 'Explore Patch’s island');

  function resetStick() {
    const pointer = stickPointer;
    stickPointer = null;
    stickSide = stickForward = 0;
    moveStick.removeAttribute('data-active');
    moveStick.style.removeProperty('--stick-x');
    moveStick.style.removeProperty('--stick-y');
    if (pointer !== null && moveStick.hasPointerCapture(pointer)) moveStick.releasePointerCapture(pointer);
  }

  function aimStick(event) {
    const bounds = moveStick.getBoundingClientRect();
    const dx = event.clientX - (bounds.left + bounds.width / 2);
    const dy = event.clientY - (bounds.top + bounds.height / 2);
    const radius = bounds.width * .28;
    const distance = Math.hypot(dx, dy);
    const scale = Math.min(1, radius / (distance || 1));
    const strength = THREE.MathUtils.clamp((distance / radius - .15) / .85, 0, 1);
    stickSide = strength * dx / (distance || 1);
    stickForward = -strength * dy / (distance || 1);
    moveStick.style.setProperty('--stick-x', `${dx * scale}px`);
    moveStick.style.setProperty('--stick-y', `${dy * scale}px`);
  }

  function pause() {
    keys.clear();
    resetStick();
    touchLook = null;
    if (document.pointerLockElement === canvas) document.exitPointerLock();
  }

  function updateLook() {
    const walking = mode === 'walk';
    returnToWalk.hidden = walking;
    mouseLock.hidden = !walking;
    mouseLock.setAttribute('aria-pressed', String(lockedLook));
    const label = lockedLook ? 'Mouse look on: click the island to look; Escape releases the mouse' : 'Mouse look off: drag to look';
    mouseLock.setAttribute('aria-label', label);
    mouseLock.title = label;
    if (!walking) hint.textContent = mode === 'follow' ? 'Following Patch' : 'Viewing Patch';
    else if (touchScreen.matches) hint.textContent = 'Drag above to look';
    else {
      const lookHint = lockedLook ? 'Click the island to look · Esc releases mouse' : 'Drag the island to look';
      hint.textContent = lookHint + ' · WASD or arrows to move · Shift faster';
    }
  }

  function setMode(value) {
    pause();
    mode = value;
    vineButton.hidden = true;
    follow.checked = value === 'follow';
    updateLook();
  }

  returnToWalk.onclick = () => {
    setMode('walk');
    canvas.focus({ preventScroll: true });
  };
  touchScreen.addEventListener('change', updateLook);
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
    return nearestWalkable(x, z, walkSolids, 60) || [9, 14];
  }

  function landNearPatch(position) {
    const tent = COMPUTER_TENT;
    const [x, z] = insideComputerTent(position.x, position.z)
      ? safeLanding(...tentPoint(tent.halfLength + 1.4,0))
      : safeLanding(position.x + 3, position.z + 4);
    setMode('walk');
    climb = null;
    camera.position.set(x, visitorEyeHeight(x, z), z);
    pointAt(position.x, position.y + 1, position.z);
    canvas.focus({ preventScroll: true });
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

  function positionPatchView(position, dt, snap = false, inHammock = false) {
    if (inHammock) {
      // Look through the gap between the banana trees at the sleeping area.
      destination.set(position.x + .4, groundHeight(position.x, position.z) + 2.8, position.z + 3.6);
      patchView.position.copy(destination);
      patchView.lookAt(position.x, groundHeight(position.x, position.z) + 1.32, position.z);
      return;
    }
    target.copy(position);
    target.y += 1;
    const inTent = insideComputerTent(position.x, position.z);
    if (inTent) {
      const tent = COMPUTER_TENT;
      // A fixed view from inside the entrance keeps the canvas roof out of the way.
      const [viewX,viewZ]=tentPoint(2.15,.55);
      destination.set(viewX,groundHeight(viewX,viewZ)+1.45,viewZ);
      if (snap || !wasInTent) patchView.position.copy(destination);
      else patchView.position.lerp(destination, 1 - Math.exp(-8 * dt));
      patchView.lookAt(position.x, position.y + .74, position.z - .25);
      wasInTent = true;
      return;
    }
    if (wasInTent) snap = true;
    wasInTent = false;
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

  function vineEntrance() {
    return vineEnds.findIndex(([x,,z]) => Math.hypot(camera.position.x-x,camera.position.z-z)<1.15);
  }

  function startVine() {
    const end = vineEntrance();
    if (!canWalk() || climb || end < 0) return;
    keys.clear();
    resetStick();
    const [x,,z] = vineEnds[1-end];
    pointAt(x,visitorEyeHeight(x,z)-.7,z);
    climb = { end, elapsed:0, start:camera.position.clone() };
    vineButton.hidden = true;
    canvas.focus({ preventScroll:true });
  }

  vineButton.onclick = startVine;
  const canWalk = () => mode === 'walk' && !isModalOpen();
  moveStick.addEventListener('contextmenu', event => event.preventDefault());
  moveStick.addEventListener('pointerdown', event => {
    if (isModalOpen() || stickPointer !== null || event.button !== 0) return;
    if (mode !== 'walk') setMode('walk');
    event.preventDefault();
    stickPointer = event.pointerId;
    moveStick.setPointerCapture(stickPointer);
    moveStick.setAttribute('data-active', '');
    aimStick(event);
  });
  moveStick.addEventListener('pointermove', event => {
    if (event.pointerId === stickPointer) aimStick(event);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    moveStick.addEventListener(type, event => {
      if (event.pointerId === stickPointer) resetStick();
    });
  }
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
    if (e.code === 'KeyE' && !e.repeat && canWalk() && vineEntrance() >= 0) { e.preventDefault(); startVine(); return; }
    if (!canWalk() || !allowed.has(e.code) || e.altKey || e.metaKey || e.ctrlKey ||
        ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(document.activeElement?.tagName)) return;
    e.preventDefault();
    keys.add(e.code);
  });
  addEventListener('keyup', e => keys.delete(e.code));
  document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement !== canvas) keys.clear(); });
  addEventListener('blur', pause);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  canvas.addEventListener('pointerdown', e => {
    if (!canWalk() || !(e.pointerType === 'touch' || (e.pointerType === 'mouse' && !lockedLook && e.button === 0))) return;
    if (e.pointerType === 'touch') {
      lastTouch = Date.now();
      if (e.clientY > canvas.getBoundingClientRect().top + canvas.clientHeight * .72) return;
    }
    if (touchLook) return;
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
    findPatch(position, tracking = false, inHammock = false) {
      if (tracking) {
        setMode('follow');
        viewAngle = Math.PI / 4;
        viewOffset = viewOffsets[0];
        positionPatchView(position, 0, true, inHammock);
        return;
      }
      landNearPatch(position);
    },
    stopFollowing() {
      setMode('walk');
    },
    track(position, dt, inHammock = false) {
      if (mode === 'follow') positionPatchView(position, dt, false, inHammock);
    },
    update(dt) {
      if (!canWalk()) return;
      const end = vineEntrance();
      vineButton.hidden = end < 0 || !!climb;
      if (!vineButton.hidden) {
        const label = end === 0 ? 'Climb vines' : 'Descend vines';
        if (vineButton.textContent !== label) vineButton.textContent = label;
      }
      if (climb) {
        climb.elapsed += dt;
        const t = Math.min(1,Math.max(0,(climb.elapsed-.35)/6));
        const [x,,z] = vinePoint(climb.end ? 1-t : t);
        destination.set(x,visitorEyeHeight(x,z),z);
        camera.position.copy(climb.start).lerp(destination,Math.min(1,climb.elapsed/.35));
        if (t === 1) climb = null;
        return;
      }
      const has = (...codes) => codes.some(code => keys.has(code));
      const keyForward = Number(has('KeyW', 'ArrowUp')) - Number(has('KeyS', 'ArrowDown'));
      const keySide = Number(has('KeyD', 'ArrowRight')) - Number(has('KeyA', 'ArrowLeft'));
      const usingKeys = keyForward !== 0 || keySide !== 0;
      const forward = usingKeys ? keyForward : stickForward;
      const side = usingKeys ? keySide : stickSide;
      const length = Math.hypot(forward, side);
      if (!length) return;
      let pace;
      if (usingKeys) pace = has('ShiftLeft', 'ShiftRight') ? 7 : 3.5;
      else if (length <= .6) pace = 3.5 * length / .6;
      else pace = 3.5 + 3.5 * (length - .6) / .4;
      const { x, z } = camera.position;
      if (inPond(x,z)) pace = Math.min(pace,2.25);
      const speed = pace * dt / length;
      const dx = (-Math.sin(yaw) * forward + Math.cos(yaw) * side) * speed;
      const dz = (-Math.cos(yaw) * forward - Math.sin(yaw) * side) * speed;
      const [nextX, nextZ] = walkStep(x, z, dx, dz, walkSolids, true);
      camera.position.set(nextX, visitorEyeHeight(nextX,nextZ), nextZ);
      return Math.hypot(nextX - x, nextZ - z);
    }
  };
}
