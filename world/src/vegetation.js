import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { groundHeight } from './terrain.js';
import { isReserved } from './forest.js';

const tileSize = 48;
const kinds = ['banana', 'banana-2', 'banana-3', 'palm', 'palm-dense', 'fig'];
const asset = name => new URL(`assets/vegetation/${name}`, document.baseURI).href;
const variation = tree => tree.angle / 6;
export function treeModel(tree) {
 if (tree.grove) return kinds[Math.min(2, Math.floor(variation(tree) * 3))];
 if (tree.broad) return 'fig';
 return variation(tree) < .56 ? 'palm' : 'palm-dense';
}

async function loadModel(loader, name, trackingShader) {
 const { scene } = await loader.loadAsync(asset(name + '.glb'));
 scene.updateMatrixWorld(true);
 let source;
 scene.traverse(object => { if (object.isMesh) source = object; });
 if (!source) throw new Error(`Missing vegetation mesh: ${name}`);
 const geometry = source.geometry.clone().applyMatrix4(source.matrixWorld);
 geometry.computeBoundingBox();
 const material = source.material;
 if (trackingShader) material.onBeforeCompile = trackingShader;
 return { geometry, material, bounds: geometry.boundingBox };
}

// Use the bottom of the detailed trunk as the shared origin for both meshes.
function trunkOrigin({ geometry, bounds }) {
 const base = new THREE.Box3();
 const p = geometry.getAttribute('position'), point = new THREE.Vector3();
 const band = bounds.min.y + (bounds.max.y - bounds.min.y) * .055;
 for (let i = 0; i < p.count; i++) {
  if (p.getY(i) <= band) base.expandByPoint(point.fromBufferAttribute(p, i));
 }
 return base.getCenter(point).setY(bounds.min.y);
}

function groupedInstances(model, placements) {
 const tiles = new Map();
 for (const placement of placements) {
  const { x, z } = placement;
  const key = `${Math.floor(x / tileSize)},${Math.floor(z / tileSize)}`;
  if (!tiles.has(key)) tiles.set(key, []);
  tiles.get(key).push(placement);
 }
 const meshes = new Map();
 for (const [key, entries] of tiles) {
  const mesh = new THREE.InstancedMesh(model.geometry, model.material, entries.length);
  const tint = new THREE.Color();
  entries.forEach(({ matrix, shade }, i) => {
   mesh.setMatrixAt(i, matrix);
   if (shade !== undefined) mesh.setColorAt(i, tint.setRGB(shade, shade, shade));
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  meshes.set(key, mesh);
 }
 return meshes;
}

export function loadIslandVegetation(scene, trees, trackingShader) {
 const loader = new GLTFLoader(), pose = new THREE.Object3D();
 const group = new THREE.Group();
 group.name = 'Island vegetation';
 const treeLayers = kinds.map(async kind => {
  const [near, far] = await Promise.all([
   loadModel(loader, kind, trackingShader), loadModel(loader, kind + '-far', trackingShader)
  ]);
  const origin = trunkOrigin(near);
  const size = near.bounds.getSize(new THREE.Vector3());
  for (const model of [near, far]) model.geometry.translate(-origin.x, -origin.y, -origin.z);
  const placements = trees.filter(tree => treeModel(tree) === kind).map(tree => {
   const height = tree.grove ? 3.7 + (tree.h - 5.7) * .25 : tree.h + (tree.swing ? 3.5 : 0);
   const spread = .89 + .22 * variation(tree);
   const width = height * (tree.grove ? .83 : tree.swing ? .49 : .72) * spread;
   pose.position.set(tree.x, groundHeight(tree.x, tree.z) - .16, tree.z);
   pose.rotation.set(0, tree.angle, 0);
   pose.scale.set(width / size.x, height / size.y, width / size.z * (kind === 'fig' ? .76 : 1));
   pose.updateMatrix();
   return { x: tree.x, z: tree.z, matrix: pose.matrix.clone(), shade: .88 + .17 * variation(tree) };
  });
  const detailed = groupedInstances(near, placements), distant = groupedInstances(far, placements);
  for (const [key, mesh] of detailed) {
   const lod = new THREE.LOD();
   const [x, z] = key.split(',').map(n => (+n + .5) * tileSize);
   lod.position.set(x, groundHeight(x, z), z);
   for (const layer of [mesh, distant.get(key)]) layer.position.copy(lod.position).negate();
   lod.addLevel(mesh, 0);
   lod.addLevel(distant.get(key), 67, .12);
   group.add(lod);
  }
 });
 const rootLayers = ['vine', 'vine-2'].map(async (kind, variant) => {
  const model = await loadModel(loader, kind, null);
  model.geometry.center();
  const placements = [];
  for (const tree of trees) {
   if (!tree.broad || tree.swing || Math.floor(tree.angle * 103) % 19 !== variant) continue;
   const angle = tree.angle * 3, dx = Math.cos(angle), dz = Math.sin(angle);
   const x = tree.x + dx * 1.15, z = tree.z + dz * 1.15;
   if (isReserved(x, z) || isReserved(x + dx * 1.2, z + dz * 1.2)) continue;
   const y = groundHeight(x, z);
   const slope = Math.atan2(groundHeight(x + dx, z + dz) - groundHeight(x - dx, z - dz), 2);
   pose.position.set(x, y + .025, z);
   pose.rotation.set(Math.PI / 2 - slope, Math.PI / 2 - angle, 0, 'YXZ');
   pose.scale.set(1.5, 2.7, .92);
   pose.updateMatrix();
   placements.push({ x, z, matrix: pose.matrix.clone() });
  }
  pose.rotation.order = 'XYZ';
  for (const mesh of groupedInstances(model, placements).values()) {
   const lod = new THREE.LOD();
   lod.position.copy(mesh.boundingSphere.center);
   mesh.position.copy(lod.position).negate();
   lod.addLevel(mesh, 0);
   lod.addLevel(new THREE.Object3D(), 64);
   group.add(lod);
  }
 });
 return Promise.all([...treeLayers, ...rootLayers]).then(() => scene.add(group));
}
