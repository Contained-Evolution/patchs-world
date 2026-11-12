import { ALPINE_BOUNDS, alpineHeight, hikingHeight } from './alpine-layout.js';
import * as THREE from 'three';
import { mountainHeight } from './mountain-layout.js';
import { LAKE, waterEdgeDistance, valleyWaterDepth } from './valley-water-layout.js';

export const WORLD = ALPINE_BOUNDS;
export const STEP = 2;
export const COLS = (WORLD.x1 - WORLD.x0) / STEP + 1;
export const ROWS = (WORLD.z1 - WORLD.z0) / STEP + 1;
export const heights = new Float32Array(COLS * ROWS);
const clamp = THREE.MathUtils.clamp;

export function terrainHeight(x, z) {
  const column = clamp((x - WORLD.x0) / STEP, 0, COLS - 1);
  const row = clamp((z - WORLD.z0) / STEP, 0, ROWS - 1);
  const c = Math.min(COLS - 2, Math.floor(column));
  const r = Math.min(ROWS - 2, Math.floor(row));
  const tx = column - c, tz = row - r;
  const a = heights[r * COLS + c], b = heights[r * COLS + c + 1];
  const d = heights[(r + 1) * COLS + c], e = heights[(r + 1) * COLS + c + 1];
  // Match the two triangles in the rendered mesh, including their shared diagonal.
  return tx + tz <= 1 ? a + tx * (b - a) + tz * (d - a) :
    e + (1 - tx) * (d - e) + (1 - tz) * (b - e);
}

function resetTerrain() {
  for (let row = 0; row < ROWS; row++) for (let column = 0; column < COLS; column++)
    {
      const x = WORLD.x0 + column * STEP, z = WORLD.z0 + row * STEP;
      let h = hikingHeight(x, z, mountainHeight(x, z, alpineHeight(x, z)));
      // Patch's camp furniture shares a level clearing.
      h = THREE.MathUtils.lerp(2, h, THREE.MathUtils.smoothstep(Math.hypot(x, z), 12, 20));
      const edge = waterEdgeDistance(x, z);
      if (edge < 10) {
        const bed = LAKE.surface - valleyWaterDepth(x, z);
        h = THREE.MathUtils.lerp(Math.min(h, bed), h, THREE.MathUtils.smoothstep(edge, 0, 10));
      }
      const shore = Math.min(x - WORLD.x0, WORLD.x1 - x, z - WORLD.z0, WORLD.z1 - z);
      heights[row * COLS + column] = THREE.MathUtils.lerp(-.5, h, THREE.MathUtils.smoothstep(shore, 0, 20));
    }
}

resetTerrain();
