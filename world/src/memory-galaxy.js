import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { layoutMemories, sharedTagLinks, memoryLights, feelingColor, hash } from './memory-layout.js';
import { registerApp } from './app.js';
registerApp();

const $ = id => document.getElementById(id);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let paused = reduced.matches, data = null, selectedTag = null, selected = null, model, stars = [], labels = [], lines = [], flight = null, elapsed = 0;
let renderer, controls, camera, scene, group;
const vector = new THREE.Vector3();
function node(tag, text) { const el = document.createElement(tag); el.textContent = text; return el; }
function updateMotion() { $('motion').textContent = paused ? 'Resume orbits' : 'Pause orbits'; $('motion').setAttribute('aria-pressed', String(paused)); }
reduced.addEventListener('change', () => { paused = reduced.matches; flight = null; if (controls) controls.enableDamping = !reduced.matches; updateMotion(); });
$('motion').onclick = () => { paused = !paused; updateMotion(); };
updateMotion();

function focus(position, distance = 25) {
  if (!camera) return;
  const target = new THREE.Vector3(...position), end = target.clone().add(new THREE.Vector3(0, distance * .8, distance));
  if (reduced.matches) { camera.position.copy(end); controls.target.copy(target); }
  else flight = { start: performance.now(), from: camera.position.clone(), targetFrom: controls.target.clone(), end, target };
}
function home() { focus([0, 0, 0], (model?.radius || 100) * (Math.max(2.3, 2.3 / (innerWidth / innerHeight)))); }
$('home').onclick = home;
for (const [id, factor] of [['zoom-in', .8], ['zoom-out', 1.25]]) $(id).onclick = () => {
  if (!camera) return;
  flight = null; vector.copy(camera.position).sub(controls.target).multiplyScalar(factor).clampLength(controls.minDistance, controls.maxDistance); camera.position.copy(controls.target).add(vector);
};
$('browse').onclick = () => { $('reader').hidden = true; $('explorer').hidden = !$('explorer').hidden; if (!$('explorer').hidden) $('search').focus(); };
$('close-explorer').onclick = () => { $('explorer').hidden = true; $('browse').focus(); };
$('close-reader').onclick = () => { $('reader').hidden = true; $('browse').focus(); };
document.addEventListener('keydown', event => { if (event.key === 'Escape') { $('reader').hidden = true; $('explorer').hidden = true; } });
function read(memory) {
  selected = memory; $('explorer').hidden = true; $('reader').hidden = false;
  $('memory-category').textContent = `${data.categories?.[memory.category]?.title || memory.category} · ${memory.subcategory || ''}`;
  $('memory-title').textContent = memory.title;
  $('memory-meta').textContent = `${memory.feeling || 'A memory'} · Strength ${memory.strength || 1}/5 · ${memory.source === 'island' ? 'Island life' : `Childhood${memory.age != null ? ` · Age ${memory.age}` : ''}`}`;
  $('memory-text').textContent = memory.text;
  $('memory-tags').replaceChildren(...(memory.tags || []).map(tagButton));
  $('close-reader').focus({ preventScroll: true });
}
$('fly').onclick = () => { const star = stars.find(s => s.item.memory.id === selected?.id); if (star) { focus(star.mesh.position.toArray(), 12); $('reader').hidden = true; } };
function tagButton(tag) {
  const button = node('button', tag); button.dataset.tag = tag; button.setAttribute('aria-pressed', String(selectedTag === tag));
  button.onclick = () => { selectedTag = selectedTag === tag ? null : tag; glow(); listMemories(); };
  return button;
}
$('clear-tag').onclick = () => { selectedTag = null; glow(); listMemories(); };
function listMemories() {
  const query = $('search').value.toLowerCase(), category = $('category').value;
  const memories = (data?.memories || []).filter(m => (!category || m.category === category) && (!selectedTag || m.tags?.includes(selectedTag)) && `${m.title} ${m.text} ${m.feeling} ${(m.tags || []).join(' ')}`.toLowerCase().includes(query));
  $('memory-list').replaceChildren(...memories.map(memory => { const button = node('button', memory.title); button.onclick = () => read(memory); return button; }));
  if (!memories.length) $('memory-list').append(node('p', 'No memories match this search.'));
}
$('search').oninput = listMemories; $('category').onchange = listMemories;
function glow() {
  const lights = memoryLights(data?.lit), tagLights = new Map((data?.lit?.tags || []).map(t => [t.tag, Math.max(0, Math.min(1, t.light))]));
  for (const star of stars) {
    const light = selectedTag ? (star.item.memory.tags?.includes(selectedTag) ? 1 : 0) : lights.get(star.item.memory.id) || 0;
    star.halo.material.opacity = .18 + light * .72; star.halo.scale.setScalar(star.item.size * (5 + light * 6));
    star.mesh.material.color.set(feelingColor(star.item.memory.feeling)).multiplyScalar(1 + light * .7);
  }
  document.querySelectorAll('[data-tag]').forEach(button => { const light = selectedTag ? Number(button.dataset.tag === selectedTag) : tagLights.get(button.dataset.tag) || 0; button.style.setProperty('--light', light); button.setAttribute('aria-pressed', String(button.dataset.tag === selectedTag)); });
  $('clear-tag').hidden = !selectedTag;
  const at = data?.lit?.at ? new Date(data.lit.at).toLocaleString() : '';
  $('thought').textContent = selectedTag ? `Following “${selectedTag}” · ${data.memories.filter(m => m.tags?.includes(selectedTag)).length} memories` : at ? `His last thought · ${at}${data.lit.cues?.length ? ` · ${data.lit.cues.join(', ')}` : ''}` : 'His memories are here. Waiting for the next thought to light them.';
  for (const line of lines) line.object.material.opacity = selectedTag ? .012 : .025;
}

function initScene() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setClearColor('#101523');
  $('galaxy').append(renderer.domElement); renderer.domElement.setAttribute('aria-label', 'Drag to orbit the galaxy. Use Browse memories to read every star.');
  scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, .1, 3000);
  controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = !reduced.matches; controls.minDistance = 4; controls.maxDistance = 1000; controls.enablePan = true;
  controls.addEventListener('start', () => { flight = null; });
  group = new THREE.Group(); scene.add(group);
  const points = [];
  for (let i = 0; i < 1400; i++) { const a = hash(`a${i}`) * Math.PI * 2, y = hash(`y${i}`) * 2 - 1, r = 650; points.push(Math.cos(a) * Math.sqrt(1-y*y)*r, y*r, Math.sin(a)*Math.sqrt(1-y*y)*r); }
  const background = new THREE.BufferGeometry(); background.setAttribute('position', new THREE.Float32BufferAttribute(points, 3)); scene.add(new THREE.Points(background, new THREE.PointsMaterial({ color: '#b0c7dc', size: .8, transparent: true, opacity: .5 })));
  const ray = new THREE.Raycaster(), pointer = new THREE.Vector2(); let down = null, dragged = false, pointers = new Set();
  renderer.domElement.addEventListener('pointerdown', e => { pointers.add(e.pointerId); if (pointers.size > 1) dragged = true; else { down = [e.clientX, e.clientY]; dragged = false; } });
  renderer.domElement.addEventListener('pointermove', e => { if (down && Math.hypot(e.clientX-down[0], e.clientY-down[1]) > 6) dragged = true; });
  renderer.domElement.addEventListener('pointercancel', e => { pointers.delete(e.pointerId); down = null; });
  renderer.domElement.addEventListener('pointerup', e => {
    pointers.delete(e.pointerId); if (!down || dragged || e.button !== 0) return;
    pointer.set(e.clientX / innerWidth * 2 - 1, -e.clientY / innerHeight * 2 + 1); ray.setFromCamera(pointer, camera);
    const hit = ray.intersectObjects(group.children, false).find(hit => hit.object.userData.memory || hit.object.userData.core);
    if (hit?.object.userData.memory) read(hit.object.userData.memory);
    else if (hit?.object.userData.core) { $('category').value = 'core'; selectedTag = null; glow(); listMemories(); $('reader').hidden = true; $('explorer').hidden = false; }
    down = null;
  });
  addEventListener('resize', resize); resize(); renderer.setAnimationLoop(frame);
}
function resize() { if (!renderer) return; renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); for (const line of lines) line.object.material.resolution.set(innerWidth, innerHeight); }
const haloCanvas = document.createElement('canvas'); haloCanvas.width = haloCanvas.height = 64;
const ctx = haloCanvas.getContext('2d'), gradient = ctx.createRadialGradient(32,32,0,32,32,32);
gradient.addColorStop(0, '#fff'); gradient.addColorStop(.15, '#ffffffaa'); gradient.addColorStop(1, '#ffffff00'); ctx.fillStyle = gradient; ctx.fillRect(0,0,64,64);
const haloTexture = new THREE.CanvasTexture(haloCanvas);
function label(text, position, cluster = false) { const el = node('div', text); el.className = `galaxy-label${cluster ? ' cluster-label' : ''}`; $('galaxy').append(el); labels.push({ el, position: new THREE.Vector3(...position), cluster }); }
function rebuild() {
  model = layoutMemories(data.memories, data.categories);
  if (!renderer) return;
  group.traverse(object => { object.geometry?.dispose(); object.material?.dispose(); }); group.clear(); labels.forEach(l => l.el.remove()); labels = []; stars = []; lines = [];
  const planet = new THREE.Mesh(new THREE.SphereGeometry(5, 32, 24), new THREE.MeshBasicMaterial({ color: '#bfa479', wireframe: true })); planet.userData.core = true; group.add(planet);
  for (const galaxy of model.galaxies) {
    label(galaxy.title, [galaxy.position[0], 7, galaxy.position[2]]);
    if (galaxy.key === 'core') continue;
    const dust = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture, color: '#6a7fa2', transparent: true, opacity: .16, depthWrite: false })); dust.position.set(...galaxy.position); dust.scale.set(64, 45, 1); group.add(dust);
  }
  for (const cluster of model.clusters) label(cluster.subcategory, [cluster.position[0], 3, cluster.position[2]], true);
  for (const item of model.stars) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(item.size, 12, 8), new THREE.MeshBasicMaterial({ color: feelingColor(item.memory.feeling) })); mesh.userData.memory = item.memory; group.add(mesh);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture, color: feelingColor(item.memory.feeling), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); group.add(halo); stars.push({ item, mesh, halo });
  }
  const links = sharedTagLinks(data.memories);
  for (const count of new Set(links.map(l => l.count))) {
    const subset = links.filter(l => l.count === count), geometry = new LineSegmentsGeometry(); geometry.setPositions(new Float32Array(subset.length * 6));
    const material = new LineMaterial({ color: '#a1b6dc', linewidth: .45 + count * .45, transparent: true, opacity: .025, depthWrite: false }); material.resolution.set(innerWidth, innerHeight);
    const object = new LineSegments2(geometry, material); object.frustumCulled = false; group.add(object); lines.push({ object, links: subset });
  }
  positions(); glow();
}
function positions() {
  for (const star of stars) { const s = star.item, a = s.angle + elapsed * .025; star.mesh.position.set(s.center[0] + Math.cos(a)*s.radius, s.height, s.center[2] + Math.sin(a)*s.radius); star.halo.position.copy(star.mesh.position); }
  for (const line of lines) {
    const start = line.object.geometry.attributes.instanceStart, end = line.object.geometry.attributes.instanceEnd;
    line.links.forEach((link, i) => { const a = stars[link.from].mesh.position, b = stars[link.to].mesh.position; start.setXYZ(i,a.x,a.y,a.z); end.setXYZ(i,b.x,b.y,b.z); });
    start.needsUpdate = true; end.needsUpdate = true;
  }
}
let previous = 0;
function frame(now) {
  const delta = Math.min(.05, (now - previous) / 1000); previous = now;
  if (document.hidden) return;
  if (!paused) { elapsed += delta; positions(); }
  if (flight) { const t = Math.min(1, (now-flight.start)/850), ease = t*t*(3-2*t); camera.position.lerpVectors(flight.from,flight.end,ease); controls.target.lerpVectors(flight.targetFrom,flight.target,ease); if (t === 1) flight = null; }
  controls.update();
  for (const item of labels) { vector.copy(item.position).project(camera); const visible = vector.z > -1 && vector.z < 1 && Math.abs(vector.x) < .95 && Math.abs(vector.y) < .9 && (!item.cluster || camera.position.distanceTo(item.position) < 85); item.el.hidden = !visible; if (visible) { item.el.style.left = `${(vector.x*.5+.5)*innerWidth}px`; item.el.style.top = `${(-vector.y*.5+.5)*innerHeight}px`; } }
  renderer.render(scene, camera);
}
let signature = '', loading = false;
async function refresh() {
  if (loading) return; loading = true;
  try {
    const response = await fetch('/api/memory', { cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Unavailable'); const next = await response.json();
    if (!Array.isArray(next.memories)) throw new Error('Invalid memories');
    const changed = JSON.stringify([next.memories, next.categories]), first = !data; data = next;
    if (signature !== changed) {
      const category = $('category').value; $('category').replaceChildren(new Option('All galaxies',''), ...Object.entries(data.categories || {}).map(([key, value]) => new Option(value.title,key))); $('category').value = category;
      const tags = [...new Set([...(data.concepts || []).map(c => c.tag), ...data.memories.flatMap(m => m.tags || [])])].sort(); $('tags').replaceChildren(...tags.map(tagButton));
      rebuild(); signature = changed; listMemories();
    }
    glow(); if (first) home();
    $('status').textContent = `${data.memories.length} memories · ${Object.keys(data.categories || {}).length} galaxies · ${renderer ? 'A sky full of little stories' : 'Use Browse memories to explore — 3D is unavailable on this device'}`;
  } catch { $('status').textContent = data ? 'Connection paused · Showing his last memories. Retrying in 30 seconds.' : 'Couldn’t reach his memories. Retrying in 30 seconds.'; }
  finally { loading = false; }
}
try { initScene(); } catch { renderer = null; $('explorer').hidden = false; }
refresh(); setInterval(() => { if (!document.hidden) refresh(); }, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
