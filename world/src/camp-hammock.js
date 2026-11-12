import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { groundHeight } from './terrain.js';
import { hammock, hammockSupports } from './hammock.js';

function lashCorner(group, corner, tree, tie, radii, material) {
 const toCorner = tree.worldToLocal(corner.clone()).sub(tie);
 const startAngle = Math.atan2(toCorner.z, toCorner.x);
 const turns = 2.25, samples = 68;
 const wrap = Array.from({ length: samples + 1 }, (_, i) => {
  const t = i / samples, angle = startAngle + t * turns * Math.PI * 2;
  return tree.localToWorld(new THREE.Vector3(
   tie.x + radii[0] * Math.cos(angle),
   tie.y - t * .033,
   tie.z + radii[1] * Math.sin(angle)
  ));
 });
 const knot = wrap[0];
 const toward = corner.clone().sub(knot).normalize();
 const rope = new THREE.CatmullRomCurve3([
  wrap.at(-1).clone().add(new THREE.Vector3(0, -.16, 0)),
  ...wrap.reverse(),
  knot.clone().addScaledVector(toward, .14),
  knot.clone().lerp(corner, .55).add(new THREE.Vector3(0, -.09, 0)),
  corner,
 ]);
 group.add(new THREE.Mesh(new THREE.TubeGeometry(rope, 96, .031, 7, false), material));
 const binding = new THREE.Mesh(new THREE.SphereGeometry(.062, 8, 6), material);
 binding.position.copy(knot);
 binding.scale.set(1, 1.3, 1);
 group.add(binding);
}

export async function addCampHammock(scene, rope) {
 const loader = new GLTFLoader();
 const load = async name => (await loader.loadAsync(new URL(`assets/camp/${name}.glb`, document.baseURI).href)).scene;
 const [bed, palm, banana] = await Promise.all(['hammock', 'palm', 'banana'].map(load));
 const camp = new THREE.Group();
 camp.name = 'Camp hammock';
 const ground = groundHeight(hammock.x, hammock.z);
 bed.position.set(hammock.x, ground + hammock.modelHeight, hammock.z);
 bed.scale.setScalar(hammock.scale);
 camp.add(bed);

 const templates = { palm, banana };
 for (const support of hammockSupports) {
  const tree = templates[support.model].clone();
  const { x, z, bottom, scale, heading, corner, tie, radius } = support;
  tree.position.set(x, groundHeight(x, z) - bottom * scale - .025, z);
  tree.scale.setScalar(scale);
  tree.rotation.y = heading;
  camp.add(tree);
  lashCorner(camp, bed.localToWorld(new THREE.Vector3(...corner)), tree, new THREE.Vector3(...tie), radius, rope);
 }
 scene.add(camp);
}
