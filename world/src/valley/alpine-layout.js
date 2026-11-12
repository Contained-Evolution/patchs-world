import * as THREE from "three";
export const ALPINE_BOUNDS = { x0: -320, x1: 320, z0: -480, z1: 240 };
export const MEADOW_SPAWN = { x: 65, z: 80 };
const nodes = [
  [190, 5, 2], [190, -20, 4], [190, -50, 16],
  [190, -80, 29], [190, -110, 42], [190, -145, 58],
  [145, -160, 58], [70, -165, 58], [-10, -165, 58], [-50, -170, 58],
];
const curve = new THREE.CatmullRomCurve3(
  nodes.map(([x, z, y]) => new THREE.Vector3(x, y, z)),
  false,
  "centripetal",
);
export const HIKING_TRAIL = curve
  .getPoints(160)
  .map((p) => ({ x: p.x, z: p.z, y: p.y }));
export function nearTrail(x, z) {
  let best = { gap: Infinity, y: 0 };
  for (let i = 1; i < HIKING_TRAIL.length; i++) {
    const a = HIKING_TRAIL[i - 1],
      b = HIKING_TRAIL[i],
      dx = b.x - a.x,
      dz = b.z - a.z;
    const t = THREE.MathUtils.clamp(
      ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz),
      0,
      1,
    );
    const gap = Math.hypot(x - a.x - t * dx, z - a.z - t * dz);
    if (gap < best.gap) best = { gap, y: a.y + (b.y - a.y) * t };
  }
  return best;
}
const smooth = (t) => {
  t = THREE.MathUtils.clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
};
export function alpineHeight(x, z) {
  const meadow = 2 + 1.2 * Math.sin(x * .025) * Math.cos(z * .022) + .3 * Math.sin((x + z) * .038);
  // The upper terrace ends at a steep rock face along its southern edge.
  const cliffLine = -122 + 8 * Math.sin(x * .025) + 3 * Math.sin(x * .071);
  const terrace = (58 + 4 * Math.sin(x * .018)) * smooth((cliffLine - z) / (10 + 2 * Math.sin(x * .04))) *
    (1 - smooth((Math.abs(x) - 240) / 30));
  const peak = (cx, cz, rx, rz, height) => {
    const distance = Math.hypot((x - cx) / rx, (z - cz) / rz);
    const shape = Math.pow(Math.max(0, 1 - distance), 1.1);
    const strata = .79 + .27 * Math.abs(Math.sin(x * .034 + z * .013)) +
      .09 * Math.sin(x * .085 + z * .027) + .045 * Math.sin(z * .12 - x * .06);
    return 58 + height * shape * strata;
  };
  const mountains = z < -275 ? Math.max(
    peak(-190, -420, 160, 155, 145), peak(-10, -430, 185, 165, 175),
    peak(170, -415, 150, 150, 155)) : 0;
  const undulation = 9 * Math.sin(x * .018 + z * .013) + 5 * Math.sin(x * .039 - z * .026);
  const edge = Math.min(x + 320, 320 - x, 240 - z) + undulation;
  const riverOpening = (1 - smooth((x + 190) / 70)) * smooth((z - 145) / 70);
  const rim = (1 - riverOpening) * (25 + 5 * Math.sin(x * .018 + z * .012)) * (1 - smooth((edge - 5) / 75));
  return Math.max(meadow, terrace, mountains, rim);
}
export function hikingHeight(x, z, h) {
  const near = nearTrail(x, z);
  return THREE.MathUtils.lerp(h, near.y, 1 - smooth((near.gap - 5) / 10));
}
