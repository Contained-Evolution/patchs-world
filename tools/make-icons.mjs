// Renders Patch's face from world/assets/patch.glb into the app icons in world/icons/.
// Run from world/ after `npm ci`, with Playwright on NODE_PATH: node ../tools/make-icons.mjs
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');

const world = resolve(import.meta.dirname, '../world');
const types = { '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.html': 'text/html', '.png': 'image/png' };

const page = `<!doctype html><html><body style="margin:0;background:transparent">
<script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
// One icon: Patch's head on a round teal backdrop. "fill" is how much of the square his head spans.
window.icon = async (size, fill, backdrop) => {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(size, size); renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff4dc, 0x1d4a40, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 2.4); sun.position.set(1.5, 2, 3); scene.add(sun);
  const gltf = await new GLTFLoader().loadAsync('/assets/patch.glb');
  const patch = gltf.scene; scene.add(patch);
  const mixer = new THREE.AnimationMixer(patch);
  mixer.clipAction(THREE.AnimationClip.findByName(gltf.animations, 'idle')).play(); mixer.update(0.6);
  patch.updateMatrixWorld(true);
  const head = patch.getObjectByName('mixamorigHead'), top = patch.getObjectByName('mixamorigHeadTop_End');
  const a = head.getWorldPosition(new THREE.Vector3()), b = top.getWorldPosition(new THREE.Vector3());
  const centre = a.clone().lerp(b, 0.45), span = a.distanceTo(b) * 2.1 / fill;
  const camera = new THREE.PerspectiveCamera(24, 1, 0.01, 100);
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(head.getWorldQuaternion(new THREE.Quaternion())).setY(0).normalize();
  camera.position.copy(centre).addScaledVector(forward, span / 2 / Math.tan(THREE.MathUtils.degToRad(12))).add(new THREE.Vector3(0, span * 0.06, 0));
  camera.lookAt(centre);
  renderer.render(scene, camera);
  const out = document.createElement('canvas'); out.width = out.height = size;
  const g = out.getContext('2d');
  if (backdrop) {
    const glow = g.createRadialGradient(size / 2, size * 0.42, size * 0.05, size / 2, size / 2, size * 0.72);
    glow.addColorStop(0, '#4f9a83'); glow.addColorStop(1, '#173c38');
    g.fillStyle = glow; g.fillRect(0, 0, size, size);
  }
  g.drawImage(renderer.domElement, 0, 0);
  return out.toDataURL('image/png');
};
</script></body></html>`;

const server = createServer(async (request, response) => {
  const path = new URL(request.url, 'http://x').pathname;
  if (path === '/') { response.writeHead(200, { 'content-type': 'text/html' }); return response.end(page); }
  try { const body = await readFile(resolve(world, `.${path}`)); response.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' }); response.end(body); }
  catch { response.writeHead(404); response.end(); }
}).listen(0);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const tab = await browser.newPage();
  await tab.goto(`http://localhost:${server.address().port}/`);
  await tab.waitForFunction(() => window.icon);
  await mkdir(resolve(world, 'icons'), { recursive: true });
  // Maskable icons keep him inside the middle 80%, which every launcher shape leaves visible.
  for (const [name, size, fill] of [['icon-512.png', 512, 0.9], ['icon-192.png', 192, 0.9], ['apple-touch-icon.png', 180, 0.86], ['maskable-512.png', 512, 0.66]]) {
    const data = await tab.evaluate(([size, fill]) => window.icon(size, fill, true), [size, fill]);
    await writeFile(resolve(world, 'icons', name), Buffer.from(data.split(',')[1], 'base64'));
  }
} finally { await browser.close(); server.close(); }
