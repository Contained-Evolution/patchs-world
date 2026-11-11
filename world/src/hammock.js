export const hammock = {
  x: 0, z: 1, halfLength: 2.5, halfWidth: 1.15,
  backPose: .93, sidePose: 1.56
};

// The rim dips beside his head and rises around his hips and legs.
export function hammockHeight(length, width) {
  const lowerBody = Math.max(0, Math.min(1, (length + .22) / .34));
  const rim = .29 + .42 * lowerBody * lowerBody * (3 - 2 * lowerBody);
  return 1.08 + .88 * length ** 2 + rim * width ** 2 * (1 - length ** 2);
}
