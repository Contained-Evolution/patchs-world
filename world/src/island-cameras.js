import {
  BoxGeometry, CylinderGeometry, Euler, Group, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, PerspectiveCamera, SphereGeometry, Vector3, MathUtils
} from 'three';
import { forest } from './forest.js';
import { groundHeight, ISLAND, places, RIVER, riverPoint, shoreFraction } from './terrain.js';

// Each mount is an offset from the landmark it watches.
const waterfall = riverPoint(RIVER.lip);
const upperRiver = riverPoint(RIVER.entry - 38);
const mounts = [
  ['Camp', places.hammock, [10, 5, 12]],
  ['Banana grove', places['banana-grove'], [-14, 7, 12]],
  ['Tall trees', places['tall-trees'], [23, 14, 19], 8],
  ['Pond', places.pond, [25, 9, 24]],
  ['Beach', places.beach, [-21, 8, 18]],
  ['Lookout', places.lookout, [24, 13, 18], 5],
  ['Meadow', places.meadow, [-23, 10, 22]],
  ['Cave', places.cave, [12, 5, 20]],
  ['Tide pools', places['tide-pools'], [18, 9, 23]],
  ['Waterfall', [waterfall.x, waterfall.z], [-13, 8, -13], 0],
  ['Upper River', [upperRiver.x, upperRiver.z], [10, 7, -13], 0],
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

function makeDrone() {
  const camera = new PerspectiveCamera(52, 1, .1, 12000);
  let highest = 0;
  for (const tree of forest) {
    highest = Math.max(highest, groundHeight(tree.x, tree.z) + tree.h);
  }
  // Leave room above crowns and the exposed ridges between trees.
  for (let x = -ISLAND.radiusX * 1.2; x <= ISLAND.radiusX * 1.2; x += 8) {
    for (let z = -ISLAND.radiusZ * 1.2; z <= ISLAND.radiusZ * 1.2; z += 8) {
      highest = Math.max(highest, groundHeight(x, z));
    }
  }
  const altitude = highest + 14;
  let pitch, yaw;
  return {
    camera,
    reset() {
      camera.position.set(0, altitude, 0);
      pitch = -Math.PI / 2;
      yaw = 0;
      camera.rotation.set(pitch, yaw, 0, 'YXZ');
    },
    look(dx, dy) {
      yaw -= dx * .005;
      pitch = MathUtils.clamp(pitch + dy * .005, -Math.PI / 2, -.2);
      camera.rotation.set(pitch, yaw, 0, 'YXZ');
    },
    steer(turn, forward, elapsed) {
      if (turn) {
        yaw -= turn * 1.2 * elapsed;
        camera.rotation.y = yaw;
      }
      const distance = 34 * forward * elapsed;
      const x = camera.position.x - Math.sin(yaw) * distance;
      const z = camera.position.z - Math.cos(yaw) * distance;
      if (shoreFraction(x, z) <= 1) camera.position.set(x, altitude, z);
    }
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
  const sticks = [
    { node: movement, axis: 'y', value: 0, pointer: null },
    { node: rotation, axis: 'x', value: 0, pointer: null }
  ];
  const audioButton = document.querySelector('#camera-audio');
  const createProp = cameraProps(scene);
  const drone = makeDrone();
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
    rotation.setAttribute('aria-label', flying ? 'Rotate drone left or right' : 'Pan camera left or right');
    syncLight();
  }

  function steer(side, vertical, elapsed) {
    if (!isOpen() || (!side && !vertical)) return;
    if (selected === flight) {
      drone.steer(side, vertical, elapsed);
    } else {
      selected.pan = MathUtils.clamp(selected.pan - side * elapsed, -1.15, 1.15);
      selected.tilt = MathUtils.clamp(selected.tilt + vertical * elapsed, -.6, .7);
      selected.aim();
    }
  }

  function resetStick(stick) {
    const { node, pointer } = stick;
    stick.pointer = null;
    stick.value = 0;
    node.removeAttribute('data-active');
    node.setAttribute('aria-valuenow', '0');
    node.style.removeProperty(`--stick-${stick.axis}`);
    if (pointer !== null && node.hasPointerCapture(pointer)) node.releasePointerCapture(pointer);
  }

  for (const stick of sticks) {
    const { node, axis } = stick;
    const vertical = axis === 'y';
    const aim = event => {
      const bounds = node.getBoundingClientRect();
      const radius = bounds.width * .28;
      const offset = vertical ? event.clientY - bounds.top - bounds.height / 2 :
        event.clientX - bounds.left - bounds.width / 2;
      const displacement = MathUtils.clamp(offset / radius, -1, 1);
      const strength = Math.max(0, (Math.abs(displacement) - .15) / .85);
      stick.value = Math.sign(displacement) * strength * (vertical ? -1 : 1);
      node.style.setProperty(`--stick-${axis}`, `${displacement * radius}px`);
      node.setAttribute('aria-valuenow', String(Math.round(stick.value * 100)));
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
      const [side, lift] = direction;
      event.preventDefault();
      steer(vertical ? 0 : side, vertical ? lift : 0, .1);
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
      steer(sticks[1].value, sticks[0].value, Math.min((now - lastUpdate) / 1000, .05));
      lastUpdate = now;
    },
    get open() { return isOpen(); },
    get audio() { return audio; },
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
