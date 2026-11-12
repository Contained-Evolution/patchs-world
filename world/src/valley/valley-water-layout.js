// Coordinates shared by the valley water surface, riverbed and movement.
export const LAKE = Object.freeze({ x: -62, z: 83, radiusX: 70, radiusZ: 57, surface: 1.5, depth: 4 });
export const RIVER = Object.freeze([
  { x: -295, z: 520, width: 13 },
  { x: -265, z: 375, width: 15 },
  { x: -207, z: 250, width: 14 },
  { x: -171, z: 201, width: 13 },
  { x: -140, z: 153, width: 15 },
  { x: -112, z: 114, width: 19 },
]);
const smooth = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

// Negative distance is underwater; positive distance is measured from shore.
export function waterEdgeDistance(x, z) {
  const dx = x - LAKE.x, dz = z - LAKE.z;
  const lake = (Math.hypot(dx / LAKE.radiusX, dz / LAKE.radiusZ) - 1) * Math.min(LAKE.radiusX, LAKE.radiusZ);
  let river = Infinity;
  for (let i = 1; i < RIVER.length; i++) {
    const a = RIVER[i - 1], b = RIVER[i], vx = b.x - a.x, vz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((x - a.x) * vx + (z - a.z) * vz) / (vx * vx + vz * vz)));
    river = Math.min(river, Math.hypot(x - a.x - t * vx, z - a.z - t * vz) - (a.width + (b.width - a.width) * t));
  }
  return Math.min(lake, river);
}

export function valleyWaterDepth(x, z) {
  const edge = waterEdgeDistance(x, z);
  if (edge >= 0) return 0;
  const lakeRadius = Math.hypot((x - LAKE.x) / LAKE.radiusX, (z - LAKE.z) / LAKE.radiusZ);
  const lakeDepth = LAKE.depth * smooth((1 - lakeRadius) / .7);
  const riverDepth = .65 * smooth(-edge / 6);
  return Math.max(lakeDepth, riverDepth);
}
