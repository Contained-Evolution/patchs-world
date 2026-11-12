import { OrthographicCamera, Vector3, Vector4 } from 'three';
import { ISLAND, groundHeight, places } from './terrain.js';
import { LANDMARKS, MAP_BOUNDS } from './valley/companion-layout.js';

const landmarks = [
  ['Lookout', places.lookout, 100], ['Cave', places.cave, 76],
  ['Tall trees', places['tall-trees'], 110], ['Tide pools', places['tide-pools'], 112],
  ['Meadow', places.meadow, 124], ['Camp & coconut computer', places.hammock, 75],
  ['Banana grove', places['banana-grove'], 105], ['Pond', [ISLAND.pondX, ISLAND.pondZ], 102],
  ['Lakeshore', places.beach, 135],
  ...LANDMARKS.map(({ name, x, z }) => [name, [x, z], 75])
];
const overviewSpan = MAP_BOUNDS.z1 - MAP_BOUNDS.z0 + 160;
const mapCenter = [0, (MAP_BOUNDS.z0 + MAP_BOUNDS.z1) / 2];
const minZoom = .65, maxZoom = 6;
const visitorColor = '#78e6ff', patchColor = '#ffcb70';

function mapCamera(camera, canvas, x, z, span, angled) {
  const halfHeight = span / 2;
  const halfWidth = halfHeight * canvas.width / canvas.height;
  camera.left = -halfWidth;
  camera.right = halfWidth;
  camera.top = halfHeight;
  camera.bottom = -halfHeight;
  const y = angled ? groundHeight(x, z) : 0;
  camera.up.set(0, angled ? 1 : 0, angled ? 0 : -1);
  camera.position.set(x, y + 850, z + (angled ? 610 : 0));
  camera.lookAt(x, y, z);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}

function drawPin(context, point, radius, color) {
  context.beginPath();
  context.arc(...point, radius, 0, Math.PI * 2);
  context.fillStyle = color;
  context.fill();
  context.lineWidth = 2;
  context.strokeStyle = '#173c38';
  context.stroke();
}

function mapSurface(canvas) {
  const snapshot = document.createElement('canvas');
  snapshot.width = canvas.width;
  snapshot.height = canvas.height;
  return {
    context: canvas.getContext('2d'),
    backdrop: snapshot.getContext('2d'),
    camera: new OrthographicCamera(-1, 1, 1, -1, 1, 2600)
  };
}

export function setupIslandMap(renderer, mini, full, key, renderAerial) {
  const overview = mapSurface(mini), detail = mapSurface(full);
  const viewport = new Vector4(), point = new Vector3();
  const viewName = document.getElementById('map-view-name');
  const chart = document.getElementById('full-chart');
  const zoomIn = document.getElementById('map-zoom-in'), zoomOut = document.getElementById('map-zoom-out');
  let [x, z] = mapCenter;
  let zoom = 1, selected = -1, dirty = true;
  let nextOverview = -Infinity, nextDetail = -Infinity, nextDraw = -Infinity, wasShown = false;
  let overviewReady = false;

  function capture({ backdrop, camera }) {
    const source = renderer.domElement;
    const ratio = renderer.getPixelRatio();
    const aspect = backdrop.canvas.width / backdrop.canvas.height;
    const width = Math.max(1, Math.floor(Math.min(backdrop.canvas.width, source.width, source.height * aspect) / ratio));
    const height = Math.max(1, Math.floor(width / aspect));
    const pixelsWide = Math.floor(width * ratio), pixelsHigh = Math.floor(height * ratio);
    renderer.getViewport(viewport);
    renderer.setViewport(0, 0, width, height);
    try {
      renderAerial(camera);
      backdrop.drawImage(source, 0, source.height - pixelsHigh, pixelsWide, pixelsHigh,
        0, 0, backdrop.canvas.width, backdrop.canvas.height);
    } finally {
      renderer.setViewport(viewport);
    }
  }

  function project(camera, canvas, x, y, z) {
    point.set(x, y, z).project(camera);
    return [(point.x + 1) * canvas.width / 2, (1 - point.y) * canvas.height / 2];
  }

  function paint({ context, backdrop, camera }, visitor, patch, miniature) {
    const canvas = context.canvas;
    const at = position => project(camera, canvas, position.x, position.y, position.z);
    const visitorPoint = at(visitor), patchPoint = patch && at(patch);
    context.drawImage(backdrop.canvas, 0, 0);
    if (!miniature && selected === -1) {
      context.font = 'bold 13px sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      for (const [index, [, [x, z]]] of landmarks.entries()) {
        const marker = project(camera, canvas, x, groundHeight(x, z), z);
        // Keep the numbered pin legible when a live marker is on the same landmark.
        if ([visitorPoint, patchPoint].some(p => p && Math.hypot(p[0] - marker[0], p[1] - marker[1]) < 19)) marker[0] += 21;
        drawPin(context, marker, 10, '#29483c');
        context.fillStyle = '#fff7df';
        context.fillText(String(index + 1), ...marker);
      }
    }
    const radius = miniature ? 11 : 7;
    const close = patchPoint && Math.hypot(visitorPoint[0] - patchPoint[0], visitorPoint[1] - patchPoint[1]) < radius * 1.8;
    if (patchPoint) drawPin(context, patchPoint, close ? radius * 1.5 : radius, patchColor);
    drawPin(context, visitorPoint, close ? radius * .64 : radius, visitorColor);
  }

  function setZoom(value) {
    zoom = Math.max(minZoom, Math.min(maxZoom, value));
    zoomIn.disabled = zoom === maxZoom;
    zoomOut.disabled = zoom === minZoom;
    dirty = true;
  }

  function span() {
    return (landmarks[selected]?.[2] ?? overviewSpan) / zoom;
  }

  function pan(dx, dy) {
    const scale = span() / full.clientHeight;
    x = Math.max(-overviewSpan / 2, Math.min(overviewSpan / 2, x - dx * scale));
    z = Math.max(-overviewSpan / 2, Math.min(overviewSpan / 2, z - dy * scale / (selected < 0 ? 1 : .81)));
    dirty = true;
  }

  const buttons = landmarks.map(([name], index) => {
    const item = document.createElement('li'), button = document.createElement('button');
    const number = document.createElement('span');
    number.className = 'landmark-number';
    number.setAttribute('aria-hidden', 'true');
    number.textContent = String(index + 1);
    button.type = 'button';
    button.setAttribute('aria-pressed', 'false');
    button.append(number, name);
    button.onclick = () => {
      chooseView(index);
      chart.scrollIntoView({ block: 'nearest' });
    };
    item.append(button);
    key.append(item);
    return button;
  });

  function chooseView(index) {
    selected = index;
    const [name, center] = landmarks[index] ?? ['Valley overview', mapCenter];
    [x, z] = center;
    viewName.textContent = name;
    chart.setAttribute('aria-label', index < 0 ? 'Aerial view of Patch’s island' : `Angled aerial view of ${name}`);
    buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
    setZoom(1);
  }
  document.getElementById('map-overview').onclick = () => chooseView(-1);
  zoomIn.onclick = () => setZoom(zoom * 1.35);
  zoomOut.onclick = () => setZoom(zoom / 1.35);
  full.addEventListener('wheel', event => {
    event.preventDefault();
    setZoom(zoom * Math.exp(-Math.max(-80, Math.min(80, event.deltaY)) * .008));
  }, { passive: false });

  const pointers = new Map();
  full.addEventListener('pointerdown', event => {
    if (event.button !== 0 || pointers.size >= 2) return;
    pointers.set(event.pointerId, [event.clientX, event.clientY]);
    full.setPointerCapture(event.pointerId);
  });
  full.addEventListener('pointermove', event => {
    const previous = pointers.get(event.pointerId);
    if (!previous) return;
    const next = [event.clientX, event.clientY];
    pointers.set(event.pointerId, next);
    if (pointers.size === 1) {
      pan(next[0] - previous[0], next[1] - previous[1]);
      return;
    }
    const [, other] = [...pointers].find(([id]) => id !== event.pointerId);
    const before = Math.hypot(previous[0] - other[0], previous[1] - other[1]);
    const after = Math.hypot(next[0] - other[0], next[1] - other[1]);
    if (before > 4) setZoom(zoom * after / before);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    full.addEventListener(type, event => pointers.delete(event.pointerId));
  }

  mapCamera(overview.camera, mini, ...mapCenter, overviewSpan, false);
  const draw = (now, visitor, patch, showFull) => {
    if (!showFull) wasShown = false;
    if (now < nextDraw) return;
    nextDraw = now + 85;
    if (now >= nextOverview) {
      capture(overview);
      nextOverview = now + (overviewReady ? 45000 : 1800);
      overviewReady = true;
    }
    paint(overview, visitor, patch, true);
    if (!showFull) return;
    if (!wasShown || dirty || now >= nextDetail) {
      mapCamera(detail.camera, full, x, z, span(), selected >= 0);
      capture(detail);
      nextDetail = now + 3000;
      dirty = false;
    }
    wasShown = true;
    paint(detail, visitor, patch, false);
  };
  draw.invalidate = () => {
    dirty = true;
    nextOverview = nextDetail = nextDraw = -Infinity;
  };
  return draw;
}
