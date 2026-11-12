import { ALPINE_BOUNDS, alpineHeight, MEADOW_SPAWN, nearTrail } from './alpine-layout.js';
import { waterEdgeDistance } from './valley-water-layout.js';

export const GRID_SIZE = 4;
export const WINTER_LIMIT = -20;
export const MAP_BOUNDS = Object.freeze({ ...ALPINE_BOUNDS });
export const SCENERY_RADIUS = Object.freeze({ tree: 1.8, rock: 1.1 });

export const LANDMARKS = Object.freeze([
  { id: 'cabin', name: 'Cabin plot', x: 44, z: 100, radius: 8 },
  { id: 'mill', name: 'Wood mill', x: 104, z: 56, radius: 8 },
  { id: 'market', name: 'Food market', x: 88, z: 96, radius: 7 },
  { id: 'library', name: 'Library', x: 48, z: 60, radius: 7 },
  { id: 'rec', name: 'Rec center', x: 112, z: 100, radius: 8 },
].map(Object.freeze));

export const STARTER_SCENERY = Object.freeze([
  { id: 'starter-tree-1', type: 'tree', x: 32, z: 48 },
  { id: 'starter-tree-2', type: 'tree', x: 40, z: 44 },
  { id: 'starter-tree-3', type: 'tree', x: 80, z: 44 },
  { id: 'starter-tree-4', type: 'tree', x: 120, z: 48 },
  { id: 'starter-tree-5', type: 'tree', x: 124, z: 116 },
  { id: 'starter-tree-6', type: 'tree', x: 48, z: 120 },
  { id: 'starter-rock-1', type: 'rock', x: 32, z: 112 },
  { id: 'starter-rock-2', type: 'rock', x: 76, z: 112 },
  { id: 'starter-rock-3', type: 'rock', x: 128, z: 60 },
].map(Object.freeze));

const STORAGE_KEY = 'tenari-companion-scenery-v1';
const approachClearance = 3;

function distanceToApproach(x, z, landmark) {
  const dx = landmark.x - MEADOW_SPAWN.x;
  const dz = landmark.z - MEADOW_SPAWN.z;
  const offsetX = x - MEADOW_SPAWN.x;
  const offsetZ = z - MEADOW_SPAWN.z;
  const progress = Math.max(0, Math.min(1, (offsetX * dx + offsetZ * dz) / (dx * dx + dz * dz)));
  return Math.hypot(offsetX - dx * progress, offsetZ - dz * progress);
}

export function valleyBoundary(x, z, radius = 0) {
  return x < MAP_BOUNDS.x0 + 3 + radius || x > MAP_BOUNDS.x1 - 3 - radius ||
    z > MAP_BOUNDS.z1 - 3 - radius || z < -275 + radius ||
    (x > 174 - radius && x < 206 + radius && z < WINTER_LIMIT + radius);
}

export function protectedSceneryCell(x, z, radius) {
  if (x - radius < MAP_BOUNDS.x0 + 35 || x + radius > MAP_BOUNDS.x1 - 35 ||
      z - radius < MAP_BOUNDS.z0 || z + radius > MAP_BOUNDS.z1 - 35) return 'border';
  if (z < -275 + radius || (x > 174 - radius && x < 206 + radius && z < WINTER_LIMIT + radius)) return 'winter';
  if (waterEdgeDistance(x, z) < radius + 2) return 'water';
  if (nearTrail(x, z).gap < radius + 5) return 'trail';
  const rise = Math.hypot(alpineHeight(x + 1, z) - alpineHeight(x - 1, z),
    alpineHeight(x, z + 1) - alpineHeight(x, z - 1));
  if (rise > 1.4) return 'slope';
  for (const landmark of LANDMARKS) {
    if (Math.hypot(x - landmark.x, z - landmark.z) < radius + landmark.radius + approachClearance ||
        distanceToApproach(x, z, landmark) < radius + approachClearance) return 'landmark';
  }
  return null;
}

export function placeScenery(items, type, x, z, excludeId = null) {
  if (!Object.hasOwn(SCENERY_RADIUS, type) || !Number.isFinite(x) || !Number.isFinite(z)) return null;
  const radius = SCENERY_RADIUS[type];
  const snappedX = Math.round(x / GRID_SIZE) * GRID_SIZE;
  const snappedZ = Math.round(z / GRID_SIZE) * GRID_SIZE;
  if (protectedSceneryCell(snappedX, snappedZ, SCENERY_RADIUS.tree)) return null;
  if (items.some(item => item.id !== excludeId && Math.hypot(snappedX - item.x, snappedZ - item.z) <
      radius + SCENERY_RADIUS[item.type])) return null;
  return { x: snappedX, z: snappedZ };
}

export function readScenery(storage) {
  let saved;
  try {
    saved = JSON.parse(storage.getItem(STORAGE_KEY));
  } catch {
    // An unavailable or invalid save opens the starter arrangement.
  }
  if (!Array.isArray(saved)) return STARTER_SCENERY.map(item => ({ ...item }));

  const items = [];
  const ids = new Set();
  for (const item of saved) {
    if (!item || typeof item.id !== 'string' || !item.id || ids.has(item.id)) continue;
    const position = placeScenery(items, item.type, item.x, item.z);
    if (!position) continue;
    items.push({ id: item.id, type: item.type, ...position });
    ids.add(item.id);
  }
  return items;
}

export function writeScenery(storage, items) {
  storage.setItem(STORAGE_KEY, JSON.stringify(items));
}
