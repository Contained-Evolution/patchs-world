import * as THREE from 'three';


// ---- Materials and procedural textures (textures are skipped where there is no DOM, e.g. in tests) ----
const cache = new Map();
const mat = (color, extra = {}) => {
  const key = color + JSON.stringify(extra);
  if (!cache.has(key)) cache.set(key, new THREE.MeshStandardMaterial({ color, roughness: .95, ...extra }));
  return cache.get(key);
};

let seed = 7;
const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
function texture(w, h, draw) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  draw(canvas.getContext('2d'), w, h);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 4;
  return map;
}
const mapped = (map, color = 0xffffff, extra = {}) => new THREE.MeshStandardMaterial({ map, color, roughness: .95, ...extra });

// Dutch lap vinyl siding: one board per tile, with the concave cove along the top edge.
const SIDING_TILE = .22;
const siding = () => mapped(texture(128, 128, (g, w, h) => {
  g.fillStyle = '#e4ddcb'; g.fillRect(0, 0, w, h);
  const cove = g.createLinearGradient(0, 0, 0, 34);
  cove.addColorStop(0, '#9f9886'); cove.addColorStop(.55, '#d3ccb8'); cove.addColorStop(1, '#ebe5d4');
  g.fillStyle = cove; g.fillRect(0, 0, w, 34);
  g.fillStyle = '#f8f4ea'; g.fillRect(0, 34, w, 3);
  const foot = g.createLinearGradient(0, h - 24, 0, h);
  foot.addColorStop(0, '#e4ddcb'); foot.addColorStop(1, '#b9b29f');
  g.fillStyle = foot; g.fillRect(0, h - 24, w, 24);
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(120,110,90,${.03 + rand() * .04})`; g.fillRect(0, 40 + rand() * (h - 70), w, 1); }
}));

// Knockdown drywall: flattened splatter blobs, drawn wrapped so the tile repeats cleanly.
const KNOCK_TILE = 1.2;
const knockdown = () => texture(256, 256, (g, w, h) => {
  g.fillStyle = '#ece8df'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 1100; i++) {
    const x = rand() * w, y = rand() * h, r = 2.5 + rand() * 8, flat = .55 + rand() * .45, turn = rand() * 3;
    for (const [ox, oy] of [[0, 0], [w, 0], [-w, 0], [0, h], [0, -h]]) {
      if ((ox && x > 24 && x < w - 24) || (oy && y > 24 && y < h - 24)) continue;
      g.save(); g.translate(x + ox, y + oy); g.rotate(turn);
      g.fillStyle = 'rgba(150,140,120,.13)'; g.beginPath(); g.ellipse(0, 0, r, r * flat, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,250,.3)'; g.beginPath(); g.ellipse(-r * .15, -r * .15, r * .6, r * .6 * flat, 0, 0, 7); g.fill();
      g.restore();
    }
  }
});

// Gray asphalt shingles: staggered rows of tabs with cutout slots.
const SHINGLE_TILE = .9;
const shingles = () => mapped(texture(128, 128, (g, w, h) => {
  g.fillStyle = '#4b4e53'; g.fillRect(0, 0, w, h);
  for (let row = 0; row < 4; row++) {
    const y = row * 32, shift = row % 2 ? 32 : 0;
    for (let x = -64 + shift; x < w; x += 64) {
      g.fillStyle = `hsl(215, 4%, ${35 + rand() * 12}%)`; g.fillRect(x + 1, y, 62, 31);
      g.fillStyle = '#25272a'; g.fillRect(x, y + 14, 2, 18);
    }
    g.fillStyle = '#222428'; g.fillRect(0, y + 30, w, 2);
  }
  for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(${rand() > .5 ? '255,255,255' : '0,0,0'},${rand() * .12})`; g.fillRect(rand() * w, rand() * h, 1.5, 1.5); }
}), 0xffffff, { side: THREE.DoubleSide });

// Green louvred shutter tile.
const SHUTTER_TILE = .14;
const shutters = () => mapped(texture(64, 64, (g, w, h) => {
  g.fillStyle = '#2f6b3f'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#1f4a2b'; g.fillRect(0, 0, w, 10);
  g.fillStyle = '#4a8a5a'; g.fillRect(0, 10, w, 5);
}));

// Box from min corner to max corner. `color` is a hex colour, a material, or six materials.
export function slab(parent, x0, y0, z0, x1, y1, z1, color, extra) {
  const material = typeof color === 'number' ? mat(color, extra) : color;
  const box = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), material);
  box.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  parent.add(box);
  return box;
}

// A box whose faces repeat their texture every tiles[face] units, aligned to world height so boards line up.
function skinned(parent, x0, y0, z0, x1, y1, z1, mats, tiles) {
  const w = x1 - x0, h = y1 - y0, d = z1 - z0;
  const box = slab(parent, x0, y0, z0, x1, y1, z1, mats);
  const uv = box.geometry.attributes.uv;
  const extents = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let face = 0; face < 6; face++) {
    for (let i = 0; i < 4; i++) {
      const at = face * 4 + i, side = face < 2 || face > 3;
      uv.setXY(at, uv.getX(at) * extents[face][0] / tiles[face], uv.getY(at) * extents[face][1] / tiles[face] + (side ? y0 / tiles[face] : 0));
    }
  }
  return box;
}

// Gable roof along `axis`; slopes get shingle UVs, the two end triangles get siding UVs on the wall plane.
function roof(parent, axis, a0, a1, b0, b1, y, h, slopeMat, gableMat, gableA) {
  const bc = (b0 + b1) / 2;
  const P = (a, b, yy) => axis === 'x' ? [a, yy, b] : [b, yy, a];
  const v = [P(a0, b0, y), P(a1, b0, y), P(a1, b1, y), P(a0, b1, y), P(a0, bc, y + h), P(a1, bc, y + h)];
  const slant = Math.hypot(h, bc - b0);
  const uvOf = i => [(i === 0 || i === 3 || i === 4 ? 0 : a1 - a0) / SHINGLE_TILE, (i === 4 || i === 5 ? slant : 0) / SHINGLE_TILE];
  const shape = (positions, uvs, material) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.computeVertexNormals();
    parent.add(new THREE.Mesh(geometry, material));
  };
  const slopes = [0, 1, 5, 0, 5, 4, 3, 5, 2, 3, 4, 5];
  shape(slopes.flatMap(i => v[i]), slopes.flatMap(uvOf), slopeMat);
  const ends = [], endUv = [];
  for (const a of [-gableA, gableA]) {
    const corners = [[b0, y], [b1, y], [bc, y + h]];
    if ((a > 0) === (axis === 'x')) corners.reverse();
    for (const [b, yy] of corners) {
      ends.push(...P(a, b, yy));
      endUv.push((b - b0) / SIDING_TILE, (yy - y) / SIDING_TILE);
    }
  }
  shape(ends, endUv, gableMat);
}

export function buildStreetHouse(parent, { width, depth, stories, tint, garageSide, driveway, walk }) {
  const sidingMat = siding();
  sidingMat.color.setHex(tint);
  const sidingTiles = Array(6).fill(SIDING_TILE);
  const trim = mat(0xe8e3d8);
  const shutter = shutters();
  const wallMat = mapped(knockdown(), 0xe6dcc3);
  const shingle = shingles();
  const half = width / 2, front = depth / 2, height = 3.2;
  const garage = garageSide * (half - 2.2);
  const entry = -garageSide * .55;
  const colliders = [];
  const wall = (x0, z0, x1, z1) => colliders.push({ x0, z0, x1, z1 });
  const side = (x0, y0, z0, x1, y1, z1) =>
    skinned(parent, x0, y0, z0, x1, y1, z1, Array(6).fill(sidingMat), sidingTiles);

  for (let level = 0; level < stories; level++) {
    const y = level * height;
    slab(parent, -half, y - .14, -front, half, y + .015, front, 0xa9825c);
    side(-half, y, -front, half, y + height, -front + .2);
    side(-half, y, -front, -half + .2, y + height, front);
    side(half - .2, y, -front, half, y + height, front);
    if (level) side(-half, y, front - .2, half, y + height, front);
    else {
      side(-half, y, front - .2, entry - .65, y + height, front);
      side(entry + .65, y, front - .2, half, y + height, front);
      side(entry - .65, 2.45, front - .2, entry + .65, height, front);
    }
    const windows = level ? [-half + 2, 0, half - 2] : [-garage];
    for (const x of windows) {
      slab(parent, x - .95, y + 1.2, front, x + .95, y + 2.55, front + .1, trim);
      slab(parent, x - .82, y + 1.32, front + .1, x + .82, y + 2.43, front + .13, 0x95afb8);
      for (const edge of [-1, 1]) {
        const center = x + edge * 1.1;
        skinned(parent, center - .15, y + 1.2, front, center + .15, y + 2.55, front + .12,
          Array(6).fill(shutter), Array(6).fill(SHUTTER_TILE));
      }
    }
  }
  const ceiling = mapped(knockdown(), 0xffffff);
  for (let level = 1; level <= stories; level++) {
    const y = level * height;
    const overhang = level === stories ? .4 : 0;
    skinned(parent, -half - overhang, y - .08, -front - overhang,
      half + overhang, y, front + overhang, Array(6).fill(ceiling), Array(6).fill(KNOCK_TILE));
  }
  roof(parent, 'x', -half - .4, half + .4, -front - .4, front + .4,
    stories * height, stories === 1 ? 2 : 2.5, shingle, sidingMat, half);
  slab(parent, garage - 1.85, .02, front, garage + 1.85, 2.48, front + .12, trim);
  for (let row = 0; row < 4; row++) {
    slab(parent, garage - 1.7, .13 + row * .56, front + .12,
      garage + 1.7, .63 + row * .56, front + .16, 0xbab9ae);
  }
  for (const edge of [-1, 1]) {
    const x = entry + edge * .73;
    slab(parent, x - .09, 0, front, x + .09, 2.5, front + .14, trim);
  }
  slab(parent, entry - .82, 2.43, front, entry + .82, 2.58, front + .14, trim);
  slab(parent, entry - 1.05, 2.6, front - .05, entry + 1.05, 2.76, front + 1.15, 0x4e5058);
  const partition = garageSide * (half - 4.1);
  const roomEnd = stories === 1 ? -.8 : 1.2;
  skinned(parent, partition - .1, 0, roomEnd, partition + .1, height, front - .2,
    Array(6).fill(wallMat), Array(6).fill(KNOCK_TILE));
  wall(partition - .1, roomEnd, partition + .1, front - .2);
  slab(parent, garage - 1.95, -.12, front, garage + 1.95, .005, front + driveway, 0xbcbab0);
  for (let joint = 3; joint < driveway; joint += 3) {
    slab(parent, garage - 1.95, .005, front + joint, garage + 1.95, .009, front + joint + .035, 0x8f8c80);
  }
  slab(parent, entry - .65, -.12, front, entry + .65, .014, front + walk, 0xc9c6bb);
  wall(-half, -front, half, -front + .2);
  wall(-half, -front, -half + .2, front);
  wall(half - .2, -front, half, front);
  wall(-half, front - .2, entry - .65, front);
  wall(entry + .65, front - .2, half, front);
  return colliders;
}
