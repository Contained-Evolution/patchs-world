export const BANANA_TREE = Object.freeze({
  id: 'banana-grove-tree',
  name: 'Banana grove tree',
  trunkRadius: .48,
  trunkScale: .75,
  trunkLean: .055,
  leafScale: 1.25,
  fruitHeight: 1.65,
  fruitCount: 4,
  fruitColor: 0xd7ba4d,
  pickDistance: 1.05,
  pickClip: 'pick-fruit',
  pickComplete: .72,
});

export function bananaFruitConnector(index) {
  const angle = index * 1.6;
  return {
    position: [Math.cos(angle) * .2, BANANA_TREE.fruitHeight, Math.sin(angle) * .2],
    rotation: [.2, angle, 0],
  };
}
import * as THREE from 'three';

export const TRUNK_GEOMETRY = [.06, .5, 1, 8];
export const FRUIT_GEOMETRY = [.24, .075, 3, 6, Math.PI * 1.2];


export function leafGeometry() {
  const positions = [], uv = [], indices = [], segments = 3;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const width = Math.sin(Math.PI * t) ** .72 * .48;
    const height = Math.sin(t * Math.PI) * .18 - t * t * .3;
    for (const side of [-1, 0, 1]) {
      positions.push(side * width, height + (side === 0 ? .045 : 0), t * 3.5);
      uv.push((side + 1) / 2, t);
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < 2; j++) {
      const a = i * 3 + j;
      indices.push(a, a + 3, a + 1, a + 1, a + 3, a + 4);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function palmLeafPose(angle, index, size, height) {
  return {
    position: [0, height, 0],
    rotation: [-.25 - (index % 3) * .12, angle + index * Math.PI * 2 / 7, (index % 2) * .08],
    scale: [size, size, size],
  };
}

export function bananaTreeCatalogEntry() {
  const height = 7;
  return {
    ...BANANA_TREE,
    model: [
      { shape: 'cylinder', args: TRUNK_GEOMETRY, color: 0x99816b, position: [0, height / 2, 0],
        rotation: [0, 0, BANANA_TREE.trunkLean], scale: [BANANA_TREE.trunkScale, height, BANANA_TREE.trunkScale] },
      ...Array.from({ length: 7 }, (_, i) => ({
        shape: 'leaf', color: 0x82a869, ...palmLeafPose(0, i, BANANA_TREE.leafScale, height),
      })),
      ...Array.from({ length: BANANA_TREE.fruitCount }, (_, i) => ({
        shape: 'torus', args: FRUIT_GEOMETRY, color: BANANA_TREE.fruitColor, ...bananaFruitConnector(i),
      })),
    ],
    leaf: leafGeometry().toJSON(),
    fruitConnectors: Array.from({ length: BANANA_TREE.fruitCount }, (_, i) => bananaFruitConnector(i).position),
  };
}
