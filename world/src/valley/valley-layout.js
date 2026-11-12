import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { LANDMARKS, WINTER_LIMIT, readScenery } from './companion-layout.js';
import { terrainHeight } from './heightfield.js';
import { buildStreetHouse } from './village-house.js';
import { createWalkwaySurface } from './walkway-surface.js';
import { readWalkways } from './companion-walkways.js';

export function addValleyBuildings(scene) {
  const walls = [0xb9926d, 0xb6a174, 0xcfb885, 0xc7ad91, 0xa5b69a];
  for (const [index, landmark] of LANDMARKS.entries()) {
    if (landmark.id === 'cabin') {
      const plot = new THREE.Mesh(new THREE.CircleGeometry(landmark.radius, 32),
        new THREE.MeshBasicMaterial({ color: 0xb58f5e, transparent: true, opacity: .55 }));
      plot.rotation.x = -Math.PI / 2;
      plot.position.set(landmark.x, terrainHeight(landmark.x, landmark.z) + .15, landmark.z);
      scene.add(plot);
    } else {
      const building = new THREE.Group();
      buildStreetHouse(building, { width: 10, depth: 8, stories: 1, tint: walls[index],
        garageSide: 1, driveway: 0, walk: 0 });
      building.position.set(landmark.x, terrainHeight(landmark.x, landmark.z), landmark.z);
      scene.add(building);
    }

  }
  const stepMaterial = new THREE.MeshStandardMaterial({ color: 0x9b9787 });
  const stepGeometry = new THREE.BoxGeometry(8, .22, 1.3);
  for (let z = WINTER_LIMIT; z >= -142; z -= 2) {
    const step = new THREE.Mesh(stepGeometry, stepMaterial);
    step.position.set(190, terrainHeight(190, z) + .1, z);
    scene.add(step);
  }
  const gate = new THREE.Mesh(new THREE.BoxGeometry(9, 1.8, .4),
    new THREE.MeshStandardMaterial({ color: 0x6c4b34 }));
  gate.position.set(190, terrainHeight(190, WINTER_LIMIT) + .9, WINTER_LIMIT);
  scene.add(gate);
}

export async function loadValleyModels() {
  const loader = new GLTFLoader();
  const models = await Promise.all(['valley-fir', 'valley-boulder'].map(asset =>
    loader.loadAsync('/assets/valley/' + asset + '.glb')));
  return { tree: models[0].scene, rock: models[1].scene };
}

export function valleySceneryMesh(model, item) {
  const mesh = model.clone(true);
  mesh.position.set(item.x, terrainHeight(item.x, item.z), item.z);
  mesh.rotation.y = (item.x * .21 + item.z * .35) % (Math.PI * 2);
  mesh.userData.sceneryId = item.id;
  return mesh;
}

export function addValleyLayout(scene, groundMesh) {
  addValleyBuildings(scene);
  const group = new THREE.Group();
  scene.add(group);
  const draw = createWalkwaySurface(scene, groundMesh);
  let storage;
  try { storage = window.localStorage; } catch {}
  const layout = { items: [], walkways: new Map(), revision: 0 };
  let models;
  function refresh() {
    layout.items = readScenery(storage);
    layout.walkways = readWalkways(storage, terrainHeight, layout.items);
    layout.revision++;
    draw(layout.walkways);
    if (!models) return;
    group.clear();
    for (const item of layout.items) group.add(valleySceneryMesh(models[item.type], item));
  }
  refresh();
  loadValleyModels().then(result => {
    models = result;
    refresh();
  }).catch(error => console.error('Could not load valley scenery:', error));
  globalThis.window?.addEventListener('storage', event => {
    if (event.storageArea === storage) refresh();
  });
  return layout;
}
