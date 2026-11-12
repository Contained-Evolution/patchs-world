import * as THREE from 'three';
import { forest } from './forest.js';
import { hammock, hammockSupports } from './hammock.js';
import { CLIMB_WALLS } from './climbing.js';
import { COMPUTER_DESK_DISTANCE, COMPUTER_TENT } from './furniture.js';
import { groundHeight, ISLAND, places, pondFraction, shoreFraction, walkShoreLimit, streamInfo, TIDE_POOLS, tideWaterHeight } from './terrain.js';

export const WALK_RADIUS = .3;
const CELL_SIZE = 8;

export function createWalkSolids() {
  const cells = new Map();
  const cell = value => Math.floor(value / CELL_SIZE);
  function add(minX, minZ, maxX, maxZ, depth) {
    for (let x = cell(minX - WALK_RADIUS); x <= cell(maxX + WALK_RADIUS); x++) {
      for (let z = cell(minZ - WALK_RADIUS); z <= cell(maxZ + WALK_RADIUS); z++) {
        const key = x + ',' + z;
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push(depth);
      }
    }
  }

  return {
    ellipse(x, z, rx, rz) {
      add(x - rx, z - rz, x + rx, z + rz,
        (px, pz) => 1 - Math.hypot((px - x) / (rx + WALK_RADIUS), (pz - z) / (rz + WALK_RADIUS)));
    },
    box(minX, minZ, maxX, maxZ) {
      add(minX, minZ, maxX, maxZ, (x, z) => WALK_RADIUS + Math.min(x - minX, maxX - x, z - minZ, maxZ - z));
    },
    log(x, z, endX, endZ, radius) {
      const dx = endX - x, dz = endZ - z, length = dx * dx + dz * dz;
      add(Math.min(x, endX) - radius, Math.min(z, endZ) - radius,
        Math.max(x, endX) + radius, Math.max(z, endZ) + radius, (px, pz) => {
          const along = Math.max(0, Math.min(1, ((px - x) * dx + (pz - z) * dz) / (length || 1)));
          return radius + WALK_RADIUS - Math.hypot(px - x - along * dx, pz - z - along * dz);
        });
    },
    wall({ x, z, normal, tangent, width, depth }) {
      const extent = width / 2 + depth + .25;
      add(x - extent, z - extent, x + extent, z + extent, (px, pz) => {
        const dx = px - x, dz = pz - z;
        const front = dx * normal[0] + dz * normal[1];
        const side = dx * tangent[0] + dz * tangent[1];
        return WALK_RADIUS + Math.min(.05 - front, front + depth + .2, width / 2 + .1 - Math.abs(side));
      });
    },
    blocks(x, z, fromX, fromZ) {
      return (cells.get(cell(x) + ',' + cell(z)) || []).some(depth => {
        const next = depth(x, z);
        return next > 0 && (fromX === undefined || next > depth(fromX, fromZ) + 1e-9);
      });
    }
  };
}

// Ground-level trunks, rocks, furniture and structures are solid. Canopies, reeds,
// grass, loose decorations and carried props do not obstruct walking.
export const BANANA_TREE = { trunkRadius: .48, pickDistance: 1.05, fruitHeight: 1.65 };
export const bananaTrees = forest.filter(tree => tree.grove);

export function bananaPickingSpots(tree, origin, solids) {
  const home = Math.atan2(origin[1] - tree.z, origin[0] - tree.x);
  const spots = [];
  for (let i = 0; i < 16; i++) {
    const angle = home + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * Math.PI / 8;
    const end = [tree.x + Math.cos(angle) * BANANA_TREE.pickDistance, tree.z + Math.sin(angle) * BANANA_TREE.pickDistance];
    if (walkable(...end, undefined, undefined, solids)) spots.push(end);
  }
  return spots;
}
const trunkRadius = tree => tree.grove ? BANANA_TREE.trunkRadius : .7;
export function createIslandCollision() {
  const solids = createWalkSolids();
  for (const tree of forest) {
    const radius = trunkRadius(tree);
    solids.ellipse(tree.x, tree.z, radius, radius);
  }
  solids.ellipse(hammock.x, hammock.z, hammock.halfLength, hammock.halfWidth);
  for (const { x, z, baseRadius } of hammockSupports) solids.ellipse(x, z, baseRadius, baseRadius);
  for (const wall of CLIMB_WALLS) solids.wall(wall);
  const [x, z] = places.cave;
  solids.box(x - 7.3, z - 20, x - 5, z - 3);
  solids.box(x + 5, z - 20, x + 7.3, z - 3);
  solids.box(x - 8, z - 20, x + 8, z - 14.9);

  // Two open ends. Only the fabric walls and the curtains flanking each opening stop walking.
  const tent = COMPUTER_TENT;
  const west = tent.x - tent.halfLength, east = tent.x + tent.halfLength;
  const north = tent.z - tent.halfWidth, south = tent.z + tent.halfWidth;
  const edge = .12;
  for (const z of [north, south]) solids.box(west, z - edge, east, z + edge);
  for (const x of [west, east]) {
    solids.box(x - edge, north, x + edge, tent.z - tent.halfDoor);
    solids.box(x - edge, tent.z + tent.halfDoor, x + edge, south);
  }

  // Match the desk's ground footprint before its model finishes loading.
  const [deskX, chairZ] = places.computer;
  const deskZ = chairZ - COMPUTER_DESK_DISTANCE;
  solids.box(deskX - .48, deskZ - .32, deskX + .48, deskZ + .327);

  const bounds = new THREE.Box3();
  return Object.assign(solids, {
    mesh(object) {
      bounds.setFromObject(object, true);
      solids.box(bounds.min.x, bounds.min.z, bounds.max.x, bounds.max.z);
    },
    rock(x, z, geometry, matrix, scattered = false) {
      // All boulders use the same footprint derived from the transformed mesh.
      const vertices = geometry.attributes.position, point = new THREE.Vector3();
      let radius = 0;
      for (let i = 0; i < vertices.count; i++) {
        point.fromBufferAttribute(vertices, i).applyMatrix4(matrix);
        radius = Math.max(radius, Math.hypot(point.x - x, point.z - z));
      }
      if (scattered && bananaTrees.some(tree =>
        Math.hypot(x-tree.x,z-tree.z) < radius + BANANA_TREE.pickDistance + WALK_RADIUS)) return false;
      solids.ellipse(x, z, radius, radius);
      return true;
    }
  });
}

const terrainSolids = createIslandCollision();

export function dryGround(x, z, swimming = false) {
  const shore = shoreFraction(x, z);
  if (shore > walkShoreLimit || (shore > .88 && groundHeight(x, z) <= ISLAND.ocean)) return false;
  if (!swimming && inPond(x, z)) return false;
  const stream = streamInfo(x, z);
  if (!swimming && stream.distance < stream.width*1.17 && groundHeight(x, z) < stream.level) return false;
  return !TIDE_POOLS.some(pool => {
    const [px, pz, rx, rz] = pool;
    return Math.hypot((x - px) / rx, (z - pz) / rz) < .8 && groundHeight(x, z) < tideWaterHeight(pool);
  });
}

export function walkable(x, z, fromX, fromZ, solids = terrainSolids, swimming = false) {
  if (!dryGround(x, z, swimming) || solids.blocks(x, z, fromX, fromZ)) return false;
  if (fromX === undefined || swimming) return true;
  const distance = Math.hypot(x - fromX, z - fromZ);
  return !distance || Math.abs(groundHeight(x, z) - groundHeight(fromX, fromZ)) <= 1.1 * distance;
}

export function clearGroundLine(from, to, solids, swimming = false) {
  const dx = to[0] - from[0], dz = to[1] - from[1];
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (WALK_RADIUS / 2)));
  let [x, z] = from;
  for (let i = 1; i <= steps; i++) {
    const nextX = from[0] + dx * i / steps, nextZ = from[1] + dz * i / steps;
    if (!walkable(nextX, nextZ, x, z, solids, swimming)) return false;
    x = nextX;
    z = nextZ;
  }
  return true;
}

export function walkStep(x, z, dx, dz, solids) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (WALK_RADIUS / 2)));
  dx /= steps;
  dz /= steps;
  for (let i = 0; i < steps; i++) {
    if (dx && walkable(x + dx, z, x, z, solids)) x += dx;
    if (dz && walkable(x, z + dz, x, z, solids)) z += dz;
  }
  return [x, z];
}

export function nearestWalkable(x, z, solids, maxRadius = 15) {
  if (walkable(x, z, undefined, undefined, solids)) return [x, z];
  for (let radius = .5; radius <= maxRadius; radius += .5) {
    for (let i = 0; i < 24; i++) {
      const angle = i * Math.PI / 12;
      const px = x + radius * Math.cos(angle), pz = z + radius * Math.sin(angle);
      if (walkable(px, pz, undefined, undefined, solids)) return [px, pz];
    }
  }
  return null;
}

export function inPond(x, z) {
  return pondFraction(x, z) < 1 && groundHeight(x, z) < ISLAND.pondY;
}

export function pondAccess(from, solids) {
  const angle = Math.atan2((from[1] - ISLAND.pondZ) / ISLAND.pondRZ, (from[0] - ISLAND.pondX) / ISLAND.pondRX);
  const leaving = inPond(...from);
  for (let i = 0; i < 32; i++) {
    const a = angle + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * Math.PI / 16;
    const bank = [ISLAND.pondX + Math.cos(a) * (ISLAND.pondRX + 2), ISLAND.pondZ + Math.sin(a) * (ISLAND.pondRZ + 2)];
    const water = leaving ? from : [ISLAND.pondX + Math.cos(a) * 8, ISLAND.pondZ + Math.sin(a) * 5.6];
    if (walkable(...bank, undefined, undefined, solids) && clearGroundLine(water, bank, solids, true)) return {bank, water};
  }
  return null;
}
