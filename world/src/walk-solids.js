export const VISITOR_RADIUS = .3;
const CELL_SIZE = 8;

export function createWalkSolids() {
  const cells = new Map();
  const cell = value => Math.floor(value / CELL_SIZE);
  function add(minX, minZ, maxX, maxZ, depth) {
    for (let x = cell(minX - VISITOR_RADIUS); x <= cell(maxX + VISITOR_RADIUS); x++) {
      for (let z = cell(minZ - VISITOR_RADIUS); z <= cell(maxZ + VISITOR_RADIUS); z++) {
        const key = x + ',' + z;
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push(depth);
      }
    }
  }

  return {
    ellipse(x, z, rx, rz) {
      add(x - rx, z - rz, x + rx, z + rz,
        (px, pz) => 1 - Math.hypot((px - x) / (rx + VISITOR_RADIUS), (pz - z) / (rz + VISITOR_RADIUS)));
    },
    box(minX, minZ, maxX, maxZ) {
      add(minX, minZ, maxX, maxZ, (x, z) => VISITOR_RADIUS + Math.min(x - minX, maxX - x, z - minZ, maxZ - z));
    },
    log(x, z, endX, endZ, radius) {
      const dx = endX - x, dz = endZ - z, length = dx * dx + dz * dz;
      add(Math.min(x, endX) - radius, Math.min(z, endZ) - radius,
        Math.max(x, endX) + radius, Math.max(z, endZ) + radius, (px, pz) => {
          const along = Math.max(0, Math.min(1, ((px - x) * dx + (pz - z) * dz) / length));
          return radius + VISITOR_RADIUS - Math.hypot(px - x - along * dx, pz - z - along * dz);
        });
    },
    blocks(x, z, fromX, fromZ) {
      return (cells.get(cell(x) + ',' + cell(z)) || []).some(depth => {
        const next = depth(x, z);
        return next > 0 && next > depth(fromX, fromZ);
      });
    }
  };
}
