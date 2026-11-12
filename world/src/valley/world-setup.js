import { addValleyBuildings, loadValleyModels, valleySceneryMesh } from './valley-layout.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createOutsideTerrain, terrainHeight } from './outside-terrain.js';
import { createWalkwaySurface } from './walkway-surface.js';
import { WALKWAY_MATERIALS, paintWalkway, readWalkways, touchesWalkway, walkwayCell,
  walkwayKey, writeWalkways } from './companion-walkways.js';
import { MAP_BOUNDS, GRID_SIZE, LANDMARKS, SCENERY_RADIUS, STARTER_SCENERY, WINTER_LIMIT,
  placeScenery, protectedSceneryCell, readScenery, writeScenery } from './companion-layout.js';

const main = document.querySelector('main');
const canvas = document.querySelector('#valley');
const status = document.querySelector('#status');
const remove = document.querySelector('#remove');
const tools = [...document.querySelectorAll('[data-tool]')];
const floorTool = document.querySelector('#walkway-tool');
let storage;
try { storage = window.localStorage; } catch { /* The editor can still run in memory. */ }
let items = readScenery(storage);
let selected = null;
let tool = 'select';
let requestRender = () => {};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fbeaf);
scene.add(new THREE.HemisphereLight(0xfff7df, 0x6b7850, 2.5));
const sun = new THREE.DirectionalLight(0xffebc2, 2);
sun.position.set(-80, 120, 55);
scene.add(sun);

const terrain = createOutsideTerrain(scene);
const walkways = readWalkways(storage, terrainHeight, items);
const drawWalkways = createWalkwaySurface(scene, terrain.mesh);
drawWalkways(walkways);
let walkwayFrame = 0;
function refreshWalkways() {
  if (walkwayFrame) return;
  walkwayFrame = requestAnimationFrame(() => {
    walkwayFrame = 0;
    drawWalkways(walkways);
    requestRender();
  });
}

function saveWalkways() {
  try {
    writeWalkways(storage, walkways);
    status.textContent = floorTool.value === 'erase' ? 'Walkway erased.' : 'Walkway saved.';
  } catch {
    status.textContent = 'Walkway changed. Browser storage is unavailable.';
  }
}

function isPaving() {
  return main.dataset.view === 'edit' && floorTool.value !== '';
}

function pave(from, to) {
  const changed = paintWalkway(walkways, from, to, floorTool.value, terrainHeight, items);
  if (changed) refreshWalkways();
  return changed;
}

function coversWalkway(item) {
  const cell = walkwayCell(item.x, item.z);
  return [-GRID_SIZE, 0, GRID_SIZE].some(dx => [-GRID_SIZE, 0, GRID_SIZE].some(dz => {
    const tile = walkways.get(walkwayKey(cell.x + dx, cell.z + dz));
    return tile && touchesWalkway(tile, item, SCENERY_RADIUS[item.type]);
  }));
}
const camera = new THREE.PerspectiveCamera(45, 1, 1, 2800);
const mapWidth = MAP_BOUNDS.x1 - MAP_BOUNDS.x0;
const mapDepth = MAP_BOUNDS.z1 - MAP_BOUNDS.z0;
const home = { x: (MAP_BOUNDS.x0 + MAP_BOUNDS.x1) / 2, z: (MAP_BOUNDS.z0 + MAP_BOUNDS.z1) / 2 };
let controls;

const mask = document.createElement('canvas');
mask.width = mapWidth / GRID_SIZE + 1;
mask.height = mapDepth / GRID_SIZE + 1;
const paint = mask.getContext('2d');
const colors = { border: '#242f31a0', winter: '#71799ac0', water: '#19496a90',
  slope: '#59496190', landmark: '#636e9db0' };
for (let row = 0; row < mask.height; row++) {
  for (let col = 0; col < mask.width; col++) {
    const x = MAP_BOUNDS.x0 + col * GRID_SIZE;
    const z = MAP_BOUNDS.z0 + row * GRID_SIZE;
    const reason = protectedSceneryCell(x, z, SCENERY_RADIUS.tree);
    // Building approaches are kept clear of scenery but can be paved.
    if (reason === 'landmark' && !LANDMARKS.some(item => touchesWalkway({ x, z }, item, item.radius))) continue;
    if (colors[reason]) {
      paint.fillStyle = colors[reason];
      paint.fillRect(col, row, 1, 1);
    }
  }
}
const maskTexture = new THREE.CanvasTexture(mask);
maskTexture.flipY = false;
maskTexture.colorSpace = THREE.SRGBColorSpace;
maskTexture.magFilter = THREE.NearestFilter;
maskTexture.minFilter = THREE.NearestFilter;
maskTexture.generateMipmaps = false;
const protectedAreas = new THREE.Mesh(terrain.mesh.geometry,
  new THREE.MeshBasicMaterial({ map: maskTexture, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
scene.add(protectedAreas);

function makeGrid(spacing, opacity, offset = 0) {
  const points = [];
  function segment(x, z, nextX, nextZ) {
    points.push(x, terrainHeight(x, z) + .16, z, nextX, terrainHeight(nextX, nextZ) + .16, nextZ);
  }
  for (let x = MAP_BOUNDS.x0 + offset; x <= MAP_BOUNDS.x1; x += spacing) {
    for (let z = MAP_BOUNDS.z0; z < MAP_BOUNDS.z1; z += GRID_SIZE) segment(x, z, x, z + GRID_SIZE);
  }
  for (let z = MAP_BOUNDS.z0 + offset; z <= MAP_BOUNDS.z1; z += spacing) {
    for (let x = MAP_BOUNDS.x0; x < MAP_BOUNDS.x1; x += GRID_SIZE) segment(x, z, x + GRID_SIZE, z);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  const grid = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
    color: 0xffefc5, transparent: true, opacity, depthWrite: false,
  }));
  grid.renderOrder = 2;
  scene.add(grid);
  return grid;
}
const coarseGrid = makeGrid(GRID_SIZE * 5, .45);
const fineGrid = makeGrid(GRID_SIZE, .38, GRID_SIZE / 2);
const labels = [];

function marker(text, x, z, height, color = '#18382e') {
  const surface = document.createElement('canvas');
  surface.width = 512;
  surface.height = 96;
  const pen = surface.getContext('2d');
  pen.fillStyle = color;
  pen.beginPath();
  pen.roundRect(0, 0, 512, 96, 20);
  pen.fill();
  pen.font = 'bold 42px system-ui, sans-serif';
  pen.textAlign = 'center';
  pen.textBaseline = 'middle';
  pen.fillStyle = '#fff5db';
  pen.fillText(text, 256, 49, 484);
  const texture = new THREE.CanvasTexture(surface);
  texture.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
  label.position.set(x, terrainHeight(x, z) + height, z);
  label.renderOrder = 4;
  labels.push(label);
  scene.add(label);
}

addValleyBuildings(scene);
for (const landmark of LANDMARKS) marker(landmark.name, landmark.x, landmark.z, 10);
marker('Winter route closed', 190, WINTER_LIMIT, 7, '#384859');
const scenery = new THREE.Group();
scene.add(scenery);
let models;

const highlight = new THREE.Mesh(new THREE.RingGeometry(2.6, 3, 28),
  new THREE.MeshBasicMaterial({ color: 0xffdf86, side: THREE.DoubleSide, depthTest: false }));
highlight.rotation.x = -Math.PI / 2;
highlight.renderOrder = 3;
scene.add(highlight);

const cursor = new THREE.Mesh(new THREE.RingGeometry(1.55, 1.8, 4, 1, Math.PI / 4),
  new THREE.MeshBasicMaterial({ color: 0xf9eac0, side: THREE.DoubleSide, depthTest: false }));
cursor.rotation.x = -Math.PI / 2;
cursor.visible = false;
cursor.renderOrder = 3;
scene.add(cursor);
let cursorX = 80;
let cursorZ = 44;

function showItems() {
  scenery.clear();
  if (models) for (const item of items) scenery.add(valleySceneryMesh(models[item.type], item));
  showSelection();
}

function showSelection() {
  const item = items.find(entry => entry.id === selected);
  highlight.visible = Boolean(item);
  if (item) highlight.position.set(item.x, terrainHeight(item.x, item.z) + .25, item.z);
  remove.disabled = !item;
  requestRender();
}

function updateItems(next, message) {
  items = next;
  try {
    writeScenery(storage, items);
    status.textContent = message;
  } catch {
    status.textContent = message + ' Browser storage is unavailable.';
  }
  showItems();
}

function setTool(next) {
  floorTool.value = '';
  if (controls) controls.enabled = true;
  tool = next;
  selected = null;
  for (const button of tools) button.setAttribute('aria-pressed', String(button.dataset.tool === tool));
  showSelection();
  status.textContent = tool === 'select' ? 'Tap a model to select it.' : 'Tap open ground to place a ' + tool + '.';
}

function actAt(x, z, hitId) {
  if (tool === 'select' && hitId) {
    selected = hitId;
    showSelection();
    status.textContent = 'Selected. Choose an open square to move it.';
    return;
  }
  const item = items.find(entry => entry.id === selected);
  const type = tool === 'select' ? item?.type : tool;
  if (!type) {
    status.textContent = 'Select a tree or rock, or choose a placement tool.';
    return;
  }
  const position = placeScenery(items, type, x, z, item?.id);
  if (!position || coversWalkway({ ...position, type })) {
    status.textContent = 'This square is protected or obstructed. Try another square.';
    return;
  }
  if (item) updateItems(items.map(entry => entry.id === item.id ? { ...item, ...position } : entry), 'Scenery moved.');
  else updateItems([...items, { id: crypto.randomUUID(), type, ...position }], 'Scenery placed.');
}

for (const button of tools) button.addEventListener('click', () => setTool(button.dataset.tool));
floorTool.addEventListener('change', () => {
  if (!floorTool.value) {
    setTool('select');
    return;
  }
  selected = null;
  showSelection();
  for (const button of tools) button.setAttribute('aria-pressed', 'false');
  controls.enabled = false;
  const name = WALKWAY_MATERIALS[floorTool.value];
  status.textContent = name ? 'Drag on flat ground to lay ' + name.toLowerCase() + '.' : 'Drag across a walkway to erase it.';
});
remove.addEventListener('click', () => {
  const id = selected;
  selected = null;
  updateItems(items.filter(item => item.id !== id), 'Scenery removed.');
});
document.querySelector('#clear').addEventListener('click', () => {
  selected = null;
  updateItems([], 'Ground cleared.');
});
document.querySelector('#starter').addEventListener('click', () => {
  selected = null;
  updateItems(STARTER_SCENERY.filter(item => !coversWalkway(item)).map(item => ({ ...item })), 'Starter layout restored.');
});

document.querySelector('#export').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ scenery: items, walkways: [...walkways.values()] }, null, 2) + '\n'], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'patch-valley-layout.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

const ray = new THREE.Raycaster();
const pointer = new THREE.Vector2();
function aimAt(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  pointer.set(2 * (clientX - rect.left) / rect.width - 1, 1 - 2 * (clientY - rect.top) / rect.height);
  camera.updateMatrixWorld();
  ray.setFromCamera(pointer, camera);
}

function tapMap(clientX, clientY) {
  aimAt(clientX, clientY);
  if (tool === 'select') {
    const hit = ray.intersectObject(scenery, true)[0];
    let node = hit?.object;
    while (node && !node.userData.sceneryId) node = node.parent;
    if (node && node.userData.sceneryId !== selected) {
      actAt(0, 0, node.userData.sceneryId);
      return;
    }
  }
  const ground = ray.intersectObject(terrain.mesh, false)[0]?.point;
  if (ground) actAt(ground.x, ground.z);
  else status.textContent = 'Tap inside the valley to place scenery.';
}

function showCursor() {
  cursor.visible = true;
  cursor.position.set(cursorX, terrainHeight(cursorX, cursorZ) + .35, cursorZ);
  requestRender();
}
canvas.addEventListener('focus', () => {
  if (main.dataset.view === 'edit') showCursor();
});
canvas.addEventListener('blur', () => { cursor.visible = false; requestRender(); });
canvas.addEventListener('keydown', event => {
  if (main.dataset.view !== 'edit') return;
  const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  const direction = directions[event.key];
  if (direction) {
    event.preventDefault();
    cursorX = THREE.MathUtils.clamp(cursorX + direction[0] * GRID_SIZE, MAP_BOUNDS.x0, MAP_BOUNDS.x1);
    cursorZ = THREE.MathUtils.clamp(cursorZ + direction[1] * GRID_SIZE, MAP_BOUNDS.z0, MAP_BOUNDS.z1);
    controls.target.set(cursorX, terrainHeight(cursorX, cursorZ), cursorZ);
    controls.update();
    showCursor();
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    if (isPaving()) {
      const point = { x: cursorX, z: cursorZ };
      if (pave(point, point)) saveWalkways();
      else status.textContent = 'Choose a clear, flat square.';
      return;
    }
    const hit = items.find(item => item.x === cursorX && item.z === cursorZ);
    actAt(cursorX, cursorZ, hit?.id);
  }
});

try {
  terrain.update(0, sun.position);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  let frame = 0;
  requestRender = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      renderer.render(scene, camera);
    });
  };
  THREE.DefaultLoadingManager.onLoad = requestRender;
  controls = new OrbitControls(camera, canvas);
  controls.minDistance = 8;
  controls.maxDistance = 2200;
  controls.minPolarAngle = .2;
  controls.maxPolarAngle = Math.PI * .46;
  controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
  controls.addEventListener('change', () => {
    const distance = camera.position.distanceTo(controls.target);
    fineGrid.visible = main.dataset.view === 'edit' && distance < 290;
    for (const label of labels) {
      const width = THREE.MathUtils.clamp(distance * .115, 12, 52);
      label.scale.set(width, width * 96 / 512, 1);
    }
    requestRender();
  });

  function resize() {
    if (!canvas.clientWidth || !canvas.clientHeight) return;
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    requestRender();
  }

  function view(x, z, distance, overview = false) {
    const target = new THREE.Vector3(x, terrainHeight(x, z), z);
    const direction = overview ? new THREE.Vector3(.06, .91, .42) : new THREE.Vector3(.37, .66, .65);
    controls.target.copy(target);
    camera.position.copy(target).addScaledVector(direction.normalize(), distance);
    controls.update();
  }
  const village = () => view(78, 76, Math.max(125, 100 / camera.aspect));
  const overview = () => view(home.x, home.z, Math.min(2100, Math.max(1040, 820 / camera.aspect)), true);
  document.querySelector('#overview').addEventListener('click', overview);
  document.querySelector('#village').addEventListener('click', village);
  function zoomBy(factor) {
    const offset = camera.position.clone().sub(controls.target);
    offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance));
    camera.position.copy(controls.target).add(offset);
    controls.update();
  }
  document.querySelector('#zoom-in').addEventListener('click', () => zoomBy(.73));
  document.querySelector('#zoom-out').addEventListener('click', () => zoomBy(1 / .73));

  for (const button of document.querySelectorAll('[data-camera]')) {
    button.addEventListener('click', () => {
      if (isPaving()) setTool('select');
      const pan = button.dataset.camera === 'pan';
      controls.touches.ONE = pan ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE;
      controls.mouseButtons.LEFT = pan ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
      for (const option of document.querySelectorAll('[data-camera]')) {
        option.setAttribute('aria-pressed', String(option === button));
      }
    });
  }

  const pointers = new Set();
  let start;
  let gesture = false;
  let stroke;
  function brushAt(event) {
    aimAt(event.clientX, event.clientY);
    const point = ray.intersectObject(terrain.mesh, false)[0]?.point;
    if (!point) { stroke.last = null; return; }
    const next = walkwayCell(point.x, point.z);
    if (stroke.last?.x === next.x && stroke.last?.z === next.z) return;
    stroke.changed = pave(stroke.last || next, next) || stroke.changed;
    stroke.last = next;
  }

  canvas.addEventListener('pointerdown', event => {
    if (!isPaving() || event.button !== 0) return;
    event.stopImmediatePropagation();
    if (stroke) return;
    canvas.setPointerCapture(event.pointerId);
    stroke = { id: event.pointerId, changed: false, last: null };
    brushAt(event);
  }, true);
  canvas.addEventListener('pointermove', event => {
    if (stroke?.id === event.pointerId) brushAt(event);
  }, true);
  function finishStroke(event) {
    if (stroke?.id !== event.pointerId) return;
    if (event.type === 'pointerup') brushAt(event);
    if (stroke.changed) saveWalkways();
    else status.textContent = floorTool.value === 'erase' ? 'No walkway erased.' : 'Choose clear, flat ground away from water.';
    stroke = null;
  }
  canvas.addEventListener('pointerup', finishStroke, true);
  canvas.addEventListener('pointercancel', finishStroke, true);
  canvas.addEventListener('lostpointercapture', finishStroke);
  canvas.addEventListener('pointerdown', event => {
    if (main.dataset.view !== 'edit' || event.button !== 0) return;
    if (!pointers.size) {
      start = { x: event.clientX, y: event.clientY };
      gesture = false;
    } else gesture = true;
    pointers.add(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (pointers.has(event.pointerId) && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) {
      gesture = true;
    }
  });
  canvas.addEventListener('pointerup', event => {
    if (!pointers.delete(event.pointerId)) return;
    if (main.dataset.view === 'edit' && !gesture && !pointers.size) tapMap(event.clientX, event.clientY);
  });
  canvas.addEventListener('pointercancel', event => pointers.delete(event.pointerId));
  new ResizeObserver(resize).observe(canvas);
  resize();
  const close = () => {
    if (window.parent !== window) window.parent.postMessage('patch-valley-editor-close', location.origin);
    else location.assign('/');
  };
  document.querySelector('#back-view').addEventListener('click', close);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') close();
  });
  overview();
  models = await loadValleyModels();
  showItems();
  status.textContent = '';
  requestRender();
} catch (error) {
  console.error(error);
  status.textContent = 'The 3D valley could not load. Reload to try again.';
  for (const button of document.querySelectorAll('button:not(#back-view)')) button.disabled = true;
}
main.inert = false;
