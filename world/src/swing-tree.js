export const SWING_TREE = Object.freeze({
  id: 'swing-tree',
  name: 'Tall trees and swing ropes',
  branchGrips: Object.freeze([
    Object.freeze({ angle: -.6, reach: 1.4, heightOffset: 0 }),
    Object.freeze({ angle: -.2, reach: 1.55, heightOffset: .2 }),
    Object.freeze({ angle: .2, reach: 1.7, heightOffset: -.15 }),
    Object.freeze({ angle: .6, reach: 1.85, heightOffset: .1 }),
  ]),
  branchDrop: 1,
  canopyExtension: 3.5,
  rope: Object.freeze({ length: 6.9, canopyClearance: .5, swingOffset: .9 }),
  traversal: Object.freeze({
    trunkClearance: .95,
    airLift: .65,
    bends: Object.freeze([1.5, -1.5, 2, -2, 2.5, -2.5, 3, -3]),
    pace: Object.freeze({ happy: 3.6, tired: 2.3, default: 3 }),
    rest: Object.freeze({ happy: 1, tired: 4, default: 2 }),
    stormRest: 2,
  }),
});

export function branchGrip(treeHeight, variant) {
  const { angle, reach, heightOffset } = SWING_TREE.branchGrips[variant];
  return [Math.cos(angle) * reach, treeHeight - SWING_TREE.branchDrop + heightOffset, Math.sin(angle) * reach];
}

// The rope attaches above the canopy at the same horizontal offset as the branch.
export function ropeAnchor([x, , z], canopyHeight) {
  return [x, canopyHeight + SWING_TREE.rope.canopyClearance, z];
}
