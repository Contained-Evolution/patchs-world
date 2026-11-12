import {
  BoxGeometry, CylinderGeometry, Euler, Group, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, PerspectiveCamera, SphereGeometry, Vector3, MathUtils
} from 'three';
import { createDrone } from './drone-flight.js';
import { groundHeight, places, RIVER, riverPoint } from './terrain.js';

// Each mount is an offset from the landmark it watches.
const riverBend = riverPoint(RIVER.lip);
const upperRiver = riverPoint(RIVER.entry - 38);
const mounts = [
  ['Camp', places.hammock, [10, 5, 12]],
  ['Banana grove', places['banana-grove'], [-14, 7, 12]],
  ['Tall trees', places['tall-trees'], [23, 14, 19], 8],
  ['Pond', places.pond, [25, 9, 24]],
  ['Lakeshore', places.beach, [-21, 8, 18]],
  ['Lookout', places.lookout, [24, 13, 18], 5],
  ['Meadow', places.meadow, [-23, 10, 22]],
  ['Cave', places.cave, [12, 5, 20]],
  ['Tide pools', places['tide-pools'], [18, 9, 23]],
  ['River bend', [riverBend.x, riverBend.z], [-13, 8, -13], 0],
  ['River inlet', [upperRiver.x, upperRiver.z], [10, 7, -13], 0],
  ['Coconut Computer', places.computer, [-9, 5, 9]]
];
const directions = {
  left: [-1, 0], up: [0, 1], down: [0, -1], right: [1, 0]
};

function cameraProps(scene) {
  const body = new BoxGeometry(.76, .38, .92);
  const lens = new CylinderGeometry(.18, .18, .13, 16);
  lens.rotateX(Math.PI / 2);
  const lamp = new SphereGeometry(.077, 10, 8);
  const housing = new MeshStandardMaterial({ color: 0xc9c7ac });
  const dark = new MeshStandardMaterial({ color: 0x223330 });
  const lit = new MeshBasicMaterial({ color: 0x55ff78 });
  const pole = new CylinderGeometry(.09, .14, 1, 8);

  return (camera, base) => {
    const head = new Group();
    const window = new Mesh(lens, dark);
    window.position.z = -.49;
    const indicator = new Mesh(lamp, dark);
    indicator.position.set(.27, .1, -.48);
    head.add(new Mesh(body, housing), window, indicator);
    head.position.copy(camera.position);

    const support = new Mesh(pole, dark);
    support.position.copy(camera.position);
    support.position.y = (base + camera.position.y) / 2;
    support.scale.y = camera.position.y - base;
    scene.add(support, head);
    return {
      head, support,
      setActive(active) { indicator.material = active ? lit : dark; }
    };
  };
}

export function setupIslandCameras(renderer, scene) {
  const panel = document.querySelector('#cameras-panel');
  const dialog = panel.closest('dialog');
  const isOpen = () => dialog.open && !panel.hidden;
  const strip = document.querySelector('#camera-strip');
  const label = document.querySelector('#camera-label');
  const feed = document.querySelector('#camera-feed');
  const feedContext = feed.getContext('2d');
  const movement = document.querySelector('#camera-move');
  const rotation = document.querySelector('#camera-rotate');
  const elevation = document.querySelector('#drone-elevation');
  const sticks = [movement, rotation, elevation].map(node => ({ node, x: 0, y: 0, pointer: null }));
  const audioButton = document.querySelector('#camera-audio');
  const createProp = cameraProps(scene);
  const drone = createDrone();
  let motor = 0, motorUntil = 0;
  let selected, litView, audio = true, drag;
  let previewIndex = 0, nextPreview = 0, lastUpdate = performance.now();

  function makeButton(name) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'camera-tile';
    button.title = name;
    button.setAttribute('aria-label', name);
    button.setAttribute('aria-pressed', 'false');
    return button;
  }

  const feeds = mounts.map(([name, [x, z], [dx, height, dz], aimHeight = 1], index) => {
    const camera = new PerspectiveCamera(54, 1, .1, 12000);
    const base = groundHeight(x + dx, z + dz);
    camera.position.set(x + dx, base + height, z + dz);
    camera.lookAt(new Vector3(x, groundHeight(x, z) + aimHeight, z));
    const center = new Euler().setFromQuaternion(camera.quaternion, 'YXZ');
    const prop = createProp(camera, base);
    const code = `CAM ${String(index + 1).padStart(3, '0')}`;
    const nameplate = `${code} · ${name}`;
    const button = makeButton(nameplate);
    const preview = document.createElement('canvas');
    preview.width = preview.height = 112;
    preview.setAttribute('aria-hidden', 'true');
    const caption = document.createElement('span');
    caption.className = 'camera-caption';
    caption.textContent = code;
    button.append(preview, caption);
    strip.append(button);

    const view = {
      camera, button, prop, preview: preview.getContext('2d'), label: nameplate,
      pan: 0, tilt: 0,
      aim() {
        camera.rotation.set(center.x + view.tilt, center.y + view.pan, 0, 'YXZ');
        prop.head.quaternion.copy(camera.quaternion);
      }
    };
    view.aim();
    button.onclick = () => select(view);
    return view;
  });

  const droneButton = document.querySelector('#camera-drone');
  const flight = { camera: drone.camera, button: droneButton, label: 'Drone' };
  droneButton.onclick = () => select(flight);

  function syncLight() {
    const active = isOpen() && !document.hidden && selected?.prop ? selected : null;
    if (active === litView) return;
    litView?.prop.setActive(false);
    litView?.button.removeAttribute('data-live');
    active?.prop.setActive(true);
    active?.button.setAttribute('data-live', '');
    litView = active;
  }

  function select(view) {
    stopInput();
    selected?.button.setAttribute('aria-pressed', 'false');
    selected = view;
    view.button.setAttribute('aria-pressed', 'true');
    label.textContent = view.label;
    const flying = view === flight;
    feed.setAttribute('aria-label', flying ? 'Live drone view. Use arrow keys to aim.' : `Live view · ${view.label}`);
    feed.tabIndex = flying ? 0 : -1;
    feed.toggleAttribute('data-flight', flying);
    movement.setAttribute('aria-label', flying ? 'Fly forward or backward' : 'Tilt camera up or down');
    rotation.setAttribute('aria-label', flying ? 'Aim drone left, right, up or down' : 'Pan camera left or right');
    elevation.parentElement.hidden = !flying;
    syncLight();
  }

  function steer(forward, turn, tilt, lift, elapsed) {
    if (!isOpen() || (!forward && !turn && !tilt && !lift)) return;
    if (selected === flight) {
      const motion = drone.steer(turn, tilt, forward, lift, elapsed);
      if (motion) {
        motor = motion;
        motorUntil = performance.now() + 100;
      }
    } else {
      selected.pan = MathUtils.clamp(selected.pan - turn * elapsed, -1.15, 1.15);
      selected.tilt = MathUtils.clamp(selected.tilt + forward * elapsed, -.6, .7);
      selected.aim();
    }
  }

  function resetStick(stick) {
    const { node, pointer } = stick;
    stick.pointer = null;
    stick.x = stick.y = 0;
    node.removeAttribute('data-active');
    node.style.removeProperty('--stick-x');
    node.style.removeProperty('--stick-y');
    if (node.hasAttribute('aria-valuenow')) node.setAttribute('aria-valuenow', '0');
    if (pointer !== null && node.hasPointerCapture(pointer)) node.releasePointerCapture(pointer);
  }

  function steerStick(node, x, y, elapsed) {
    if (node === rotation) steer(0, x, y, 0, elapsed);
    else if (node === elevation) steer(0, 0, 0, y, elapsed);
    else steer(y, 0, 0, 0, elapsed);
  }

  for (const stick of sticks) {
    const { node } = stick;
    const aim = event => {
      const bounds = node.getBoundingClientRect();
      const radius = bounds.width * .28;
      const canPan = node === rotation;
      const canTilt = !canPan || selected === flight;
      const dx = canPan ? event.clientX - bounds.left - bounds.width / 2 : 0;
      const dy = canTilt ? event.clientY - bounds.top - bounds.height / 2 : 0;
      const distance = Math.hypot(dx, dy);
      const scale = Math.min(1, radius / (distance || 1));
      const strength = MathUtils.clamp((distance / radius - .15) / .85, 0, 1);
      stick.x = strength * dx / (distance || 1);
      stick.y = -strength * dy / (distance || 1);
      node.style.setProperty('--stick-x', `${dx * scale}px`);
      node.style.setProperty('--stick-y', `${dy * scale}px`);
      if (node.hasAttribute('aria-valuenow')) node.setAttribute('aria-valuenow', String(Math.round(stick.y * 100)));
    };
    node.onpointerdown = event => {
      if (event.button !== 0 || stick.pointer !== null) return;
      event.preventDefault();
      node.focus({ preventScroll: true });
      stick.pointer = event.pointerId;
      node.setPointerCapture(event.pointerId);
      node.setAttribute('data-active', '');
      aim(event);
    };
    node.onpointermove = event => {
      if (stick.pointer === event.pointerId) aim(event);
    };
    const release = event => {
      if (stick.pointer === event.pointerId) resetStick(stick);
    };
    node.onpointerup = node.onpointercancel = node.onlostpointercapture = release;
    node.onkeydown = event => {
      if (event.altKey || event.ctrlKey || event.metaKey || !event.key.startsWith('Arrow')) return;
      const direction = directions[event.key.slice(5).toLowerCase()];
      if (!direction) return;
      event.preventDefault();
      steerStick(node, ...direction, .1);
    };
  }
  feed.onkeydown = event => {
    if (selected !== flight || event.altKey || event.ctrlKey || event.metaKey || !event.key.startsWith('Arrow')) return;
    const direction = directions[event.key.slice(5).toLowerCase()];
    if (!direction) return;
    event.preventDefault();
    drone.look(-direction[0] * 16, direction[1] * 16);
  };
  feed.onpointerdown = event => {
    if (selected !== flight || event.button !== 0 || drag) return;
    feed.setPointerCapture(event.pointerId);
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
  };
  feed.onpointermove = event => {
    if (drag?.id !== event.pointerId) return;
    drone.look(event.clientX - drag.x, event.clientY - drag.y);
    drag.x = event.clientX;
    drag.y = event.clientY;
  };
  feed.onpointerup = feed.onpointercancel = feed.onlostpointercapture = event => {
    if (drag?.id === event.pointerId) drag = null;
  };
  function stopInput() {
    drag = null;
    motor = motorUntil = 0;
    for (const stick of sticks) resetStick(stick);
  }
  window.addEventListener('blur', stopInput);
  dialog.addEventListener('close', () => { stopInput(); syncLight(); });
  document.addEventListener('visibilitychange', () => { stopInput(); syncLight(); });
  audioButton.onclick = () => {
    audio = !audio;
    audioButton.setAttribute('aria-pressed', String(audio));
  };

  function renderInto(view, context, width, height, renderScene) {
    const source = renderer.domElement;
    const ratio = renderer.getPixelRatio();
    const aspect = width / Math.max(1, height);
    const renderWidth = Math.max(1, Math.floor(Math.min(source.width, source.height * aspect, width * ratio, 1280) / ratio));
    const renderHeight = Math.max(1, Math.floor(renderWidth / aspect));
    const pixelsWide = Math.round(renderWidth * ratio);
    const pixelsHigh = Math.round(renderHeight * ratio);
    const canvas = context.canvas;
    if (context === feedContext && (canvas.width !== pixelsWide || canvas.height !== pixelsHigh)) {
      canvas.width = pixelsWide;
      canvas.height = pixelsHigh;
    }
    view.camera.aspect = renderWidth / renderHeight;
    view.camera.updateProjectionMatrix();
    renderer.setViewport(0, 0, renderWidth, renderHeight);
    // The optical center sits inside the camera housing.
    if (view.prop) view.prop.head.visible = view.prop.support.visible = false;
    try {
      renderScene(view.camera);
      context.drawImage(source, 0, source.height - pixelsHigh, pixelsWide, pixelsHigh,
        0, 0, canvas.width, canvas.height);
    } finally {
      if (view.prop) view.prop.head.visible = view.prop.support.visible = true;
      renderer.setViewport(0, 0, source.width / ratio, source.height / ratio);
    }
  }

  return {
    capture(index, canvas, renderScene) {
      const view = feeds[index];
      if (!view) return false;
      renderInto(view, canvas.getContext('2d'), canvas.width, canvas.height, renderScene);
      return true;
    },
    reset() {
      drone.reset();
      for (const view of feeds) {
        view.pan = view.tilt = 0;
        view.aim();
      }
      select(feeds[0]);
      strip.scrollLeft = 0;
      previewIndex = nextPreview = 0;
    },
    update() {
      syncLight();
      const now = performance.now();
      steer(sticks[0].y, sticks[1].x, sticks[1].y, sticks[2].y, Math.min((now - lastUpdate) / 1000, .05));
      lastUpdate = now;
    },
    get open() { return isOpen(); },
    get audio() { return audio; },
    get droneMotion() { return isOpen() && selected === flight && performance.now() < motorUntil ? motor : 0; },
    get camera() {
      if (!isOpen()) return null;
      selected.camera.updateMatrixWorld();
      return selected.camera;
    },
    render(now, renderScene) {
      if (now >= nextPreview) {
        const bounds = strip.getBoundingClientRect();
        for (let i = 0; i < feeds.length; i++) {
          const view = feeds[previewIndex];
          previewIndex = (previewIndex + 1) % feeds.length;
          const tile = view.button.getBoundingClientRect();
          if (tile.right <= bounds.left || tile.left >= bounds.right) continue;
          renderInto(view, view.preview, 112, 112, renderScene);
          break;
        }
        nextPreview = now + 125;
      }
      renderInto(selected, feedContext, feed.clientWidth, feed.clientHeight, renderScene);
    }
  };
}
