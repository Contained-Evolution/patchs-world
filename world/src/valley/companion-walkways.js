import { GRID_SIZE, LANDMARKS, MAP_BOUNDS, SCENERY_RADIUS, WINTER_LIMIT } from './companion-layout.js';
import { waterEdgeDistance } from './valley-water-layout.js';

export const WALKWAY_MATERIALS = Object.freeze({ stone: 'Stone', gravel: 'Gravel', wood: 'Wood' });
const STORAGE_KEY = 'tenari-companion-walkways-v1';
const HALF = GRID_SIZE / 2;
const CELL_LIMIT = 5000;
const directions = [[GRID_SIZE, 0], [0, GRID_SIZE], [-GRID_SIZE, 0], [0, -GRID_SIZE]];
export const walkwayKey = (x, z) => x + ',' + z;

export function walkwayCell(x, z) {
  return { x: Math.round(x / GRID_SIZE) * GRID_SIZE, z: Math.round(z / GRID_SIZE) * GRID_SIZE };
}

export function walkwayFits({ x, z }, ground, scenery) {
  if (x - HALF < MAP_BOUNDS.x0 + 35 || x + HALF > MAP_BOUNDS.x1 - 35 ||
      z - HALF < -275 || z + HALF > MAP_BOUNDS.z1 - 35 ||
      (x > 174 - HALF && x < 206 + HALF && z < WINTER_LIMIT + HALF)) return false;
  const samples = [];
  for (const dx of [-HALF, 0, HALF]) {
    for (const dz of [-HALF, 0, HALF]) {
      if (waterEdgeDistance(x + dx, z + dz) < 1) return false;
      samples.push(ground(x + dx, z + dz));
    }
  }
  if (!samples.every(Number.isFinite) || Math.max(...samples) - Math.min(...samples) > .8) return false;
  return !LANDMARKS.some(landmark => touchesWalkway({ x, z }, landmark, landmark.radius)) &&
    !scenery.some(item => touchesWalkway({ x, z }, item, SCENERY_RADIUS[item.type]));
}

export function touchesWalkway(cell, object, radius) {
  return Math.hypot(Math.max(0, Math.abs(cell.x - object.x) - HALF),
    Math.max(0, Math.abs(cell.z - object.z) - HALF)) < radius;
}

export function paintWalkway(cells, from, to, material, ground, scenery) {
  let { x, z } = walkwayCell(from.x, from.z);
  const end = walkwayCell(to.x, to.z);
  if (![x, end.x].every(value => value >= MAP_BOUNDS.x0 && value <= MAP_BOUNDS.x1) ||
      ![z, end.z].every(value => value >= MAP_BOUNDS.z0 && value <= MAP_BOUNDS.z1)) return false;
  if (material !== 'erase' && !Object.hasOwn(WALKWAY_MATERIALS, material)) return false;
  const dx = Math.abs(end.x - x) / GRID_SIZE;
  const dz = Math.abs(end.z - z) / GRID_SIZE;
  const stepX = Math.sign(end.x - x) * GRID_SIZE;
  const stepZ = Math.sign(end.z - z) * GRID_SIZE;
  let stepsX = 0;
  let stepsZ = 0;
  let changed = false;
  while (stepsX + stepsZ <= dx + dz) {
    const key = walkwayKey(x, z);
    if (material === 'erase') changed = cells.delete(key) || changed;
    else {
      if (!walkwayFits({ x, z }, ground, scenery) || (!cells.has(key) && cells.size >= CELL_LIMIT)) break;
      if (cells.get(key)?.material !== material) {
        cells.set(key, { x, z, material });
        changed = true;
      }
    }
    if (stepsX === dx && stepsZ === dz) break;
    if (stepsZ === dz || (stepsX < dx && (stepsX + .5) / dx <= (stepsZ + .5) / dz)) {
      x += stepX;
      stepsX++;
    } else {
      z += stepZ;
      stepsZ++;
    }
  }
  return changed;
}

export function readWalkways(storage, ground, scenery) {
  const cells = new Map();
  try {
    const saved = JSON.parse(storage.getItem(STORAGE_KEY));
    if (!Array.isArray(saved)) return cells;
    for (const tile of saved.slice(0, CELL_LIMIT)) {
      if (!tile || ![tile.x, tile.z].every(Number.isFinite)) continue;
      paintWalkway(cells, tile, tile, tile.material, ground, scenery);
    }
  } catch { /* A missing layout starts with bare ground. */ }
  return cells;
}

export function writeWalkways(storage, cells) {
  storage.setItem(STORAGE_KEY, JSON.stringify([...cells.values()]));
}

export function navigationSurface(cells, x, z) {
  const cell = walkwayCell(x, z);
  if (cells.has(walkwayKey(cell.x, cell.z))) return 'walkway';
  return LANDMARKS.some(item => Math.hypot(x - item.x, z - item.z) <= item.radius + GRID_SIZE * 2)
    ? 'approach' : 'exploration';
}

export function walkwayRoute(cells, start, destination) {
  const to = walkwayCell(destination.x, destination.z);
  return findRoute(cells, start, tile => tile.x === to.x && tile.z === to.z);
}

export function walkwayRouteToLandmark(cells, start, landmarkId) {
  const landmark = LANDMARKS.find(entry => entry.id === landmarkId);
  if (!landmark) return null;
  return findRoute(cells, start, tile =>
    Math.hypot(tile.x - landmark.x, tile.z - landmark.z) <= landmark.radius + GRID_SIZE);
}

function findRoute(cells, start, reached) {
  const from = walkwayCell(start.x, start.z);
  const first = walkwayKey(from.x, from.z);
  if (!cells.has(first)) return null;
  const queue = [first];
  const previous = new Map([[first, null]]);
  for (let index = 0; index < queue.length; index++) {
    const key = queue[index];
    const cell = cells.get(key);
    if (reached(cell)) {
      const route = [];
      for (let point = key; point !== null; point = previous.get(point)) route.push(cells.get(point));
      return route.reverse();
    }
    const { x, z } = cell;
    for (const [dx, dz] of directions) {
      const neighbor = walkwayKey(x + dx, z + dz);
      if (!cells.has(neighbor) || previous.has(neighbor)) continue;
      previous.set(neighbor, key);
      queue.push(neighbor);
    }
  }
  return null;
}
