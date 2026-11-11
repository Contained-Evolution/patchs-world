import { PerspectiveCamera } from 'three';
import { groundHeight, places } from './terrain.js';

// Each mount is an offset from the landmark it watches.
const mounts = [
  ['Camp', 'hammock', [10, 5, 12]],
  ['Banana grove', 'banana-grove', [-14, 7, 12]],
  ['Tall trees', 'tall-trees', [23, 14, 19], 8],
  ['Pond', 'pond', [25, 9, 24]],
  ['Beach', 'beach', [-21, 8, 18]],
  ['Lookout', 'lookout', [24, 13, 18], 5],
  ['Meadow', 'meadow', [-23, 10, 22]],
  ['Cave', 'cave', [12, 5, 20]],
  ['Tide pools', 'tide-pools', [18, 9, 23]]
];
const aspect = 16 / 9;

export function setupIslandCameras(renderer) {
  const panel = document.querySelector('#cameras-panel');
  const dialog = panel.closest('dialog');
  const isOpen = () => dialog.open && !panel.hidden;
  const grid = document.querySelector('#camera-grid');
  const title = document.querySelector('#cameras-title');
  const back = document.querySelector('#camera-back');
  const feed = document.querySelector('#camera-feed');
  const feedContext = feed.getContext('2d');
  let selected = null, previewIndex = 0, nextPreview = 0;

  const feeds = mounts.map(([name, place, [dx, height, dz], aimHeight = 1], index) => {
    const [x, z] = places[place];
    const camera = new PerspectiveCamera(54, aspect, .1, 12000);
    camera.position.set(x + dx, groundHeight(x + dx, z + dz) + height, z + dz);
    camera.lookAt(x, groundHeight(x, z) + aimHeight, z);

    const code = `CAM ${String(index + 1).padStart(3, '0')}`;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'camera-tile';
    const preview = document.createElement('canvas');
    preview.width = 320;
    preview.height = 180;
    preview.setAttribute('aria-hidden', 'true');
    const caption = document.createElement('span');
    caption.className = 'camera-caption';
    const number = document.createElement('strong');
    number.textContent = code;
    const location = document.createElement('span');
    location.textContent = name;
    caption.append(number, location);
    button.append(preview, caption);
    grid.append(button);

    const view = { camera, button, preview: preview.getContext('2d'), label: `${code} · ${name}` };
    button.onclick = () => {
      selected = view;
      title.textContent = view.label;
      feed.setAttribute('aria-label', view.label);
      grid.hidden = true;
      feed.hidden = back.hidden = false;
      back.focus();
    };
    return view;
  });

  function showGrid(restoreFocus = false) {
    const previous = selected;
    selected = null;
    title.textContent = 'Island cameras';
    feed.hidden = back.hidden = true;
    grid.hidden = false;
    nextPreview = 0;
    if (restoreFocus && previous && isOpen()) previous.button.focus();
  }
  back.onclick = () => showGrid(true);

  return {
    showGrid,
    get open() { return isOpen(); },
    get camera() { return isOpen() ? selected?.camera : null; },
    render(now, renderScene) {
      if (!selected && now < nextPreview) return;
      const source = renderer.domElement;
      const ratio = renderer.getPixelRatio();
      const view = selected || feeds[previewIndex];
      const context = selected ? feedContext : view.preview;
      const maxWidth = selected ? Math.min(feed.clientWidth * ratio, 1280) : 320;
      const width = Math.max(1, Math.floor(Math.min(source.width, source.height * aspect, maxWidth) / ratio));
      const height = Math.max(1, Math.floor(width / aspect));
      const pixelsWide = Math.round(width * ratio);
      const pixelsHigh = Math.round(height * ratio);

      // Render one feed at a time into the shared WebGL canvas and copy it before compositing.
      renderer.setViewport(0, 0, width, height);
      renderScene(view.camera);
      if (selected && (feed.width !== pixelsWide || feed.height !== pixelsHigh)) {
        feed.width = pixelsWide;
        feed.height = pixelsHigh;
      }
      context.drawImage(source, 0, source.height - pixelsHigh, pixelsWide, pixelsHigh,
        0, 0, context.canvas.width, context.canvas.height);
      renderer.setViewport(0, 0, source.width / ratio, source.height / ratio);
      if (!selected) {
        previewIndex = (previewIndex + 1) % feeds.length;
        nextPreview = now + 65;
      }
    }
  };
}
