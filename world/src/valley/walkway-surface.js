import * as THREE from 'three';
import { makeTexture } from './surface-textures.js';
import { GRID_SIZE, MAP_BOUNDS } from './companion-layout.js';
import { WALKWAY_MATERIALS } from './companion-walkways.js';

export function createWalkwaySurface(scene, groundMesh) {
  const scale = 2;
  const canvas = document.createElement('canvas');
  const coverage = document.createElement('canvas');
  canvas.width = coverage.width = (MAP_BOUNDS.x1 - MAP_BOUNDS.x0) * scale;
  canvas.height = coverage.height = (MAP_BOUNDS.z1 - MAP_BOUNDS.z0) * scale;
  const pen = canvas.getContext('2d');
  const mask = coverage.getContext('2d');
  const patterns = Object.fromEntries(Object.keys(WALKWAY_MATERIALS).map(material => {
    const source = makeTexture(material);
    const pattern = pen.createPattern(source.image, 'repeat');
    pattern.setTransform(new DOMMatrix().scale(.36));
    source.dispose();
    return [material, pattern];
  }));
  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const mesh = new THREE.Mesh(groundMesh.geometry, new THREE.MeshStandardMaterial({
    map: texture, roughness: .98, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
  }));
  mesh.renderOrder = 1;
  scene.add(mesh);

  return function draw(cells) {
    mesh.visible = cells.size > 0;
    if (!mesh.visible) return;
    pen.clearRect(0, 0, canvas.width, canvas.height);
    mask.clearRect(0, 0, coverage.width, coverage.height);
    const tileSize = GRID_SIZE * scale;
    for (const { x, z, material } of cells.values()) {
      const left = (x - MAP_BOUNDS.x0) * scale - tileSize / 2;
      const top = (z - MAP_BOUNDS.z0) * scale - tileSize / 2;
      pen.fillStyle = patterns[material];
      pen.fillRect(left - 2, top - 2, tileSize + 4, tileSize + 4);
      mask.fillRect(left, top, tileSize, tileSize);
    }
    // Feather the perimeter of the combined path so internal joins stay opaque.
    pen.globalCompositeOperation = 'destination-in';
    pen.filter = 'blur(1px)';
    pen.drawImage(coverage, 0, 0);
    pen.filter = 'none';
    pen.globalCompositeOperation = 'source-over';
    texture.needsUpdate = true;
  };
}
