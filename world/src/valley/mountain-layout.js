import { MathUtils } from 'three';

const smooth = value => {
  const t = MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};
export function mountainHeight(x, z, original) {
  if (x < -110 || x > 110 || z < -255 || z > 45) return original;
  let height = original;
  const townEdge = Math.max((Math.abs(x) - 72) / 13, (z + 151) / 13,
    (-232 - z) / 10);
  height = MathUtils.lerp(height, 58, 1 - smooth(townEdge));
  return height;
}
