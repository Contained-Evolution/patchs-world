export const hammock = {
  x: 0, z: 1, scale: 3.55, modelHeight: 1.28,
  halfLength: 1.53, halfWidth: 1.46, approach: [2.15, 1],
  sleepOffsetZ: .64, backPose: .84, sidePose: 1.43
};

const palm = { model: 'palm', scale: 5.4, bottom: -.429443, baseRadius: .41 };
const banana = { model: 'banana', scale: 4.85, bottom: -.475342, baseRadius: .36 };

// Each corner names the center of a lash point on the authored hammock mesh.
export const hammockSupports = [
  { ...palm, x: -3.15, z: -1.7, heading: -.3, corner: [-.351, .199, -.341], tie: [-.008, -.12, -.013], radius: [.058, .057] },
  { ...palm, x: 3.12, z: -1.63, heading: 1.05, corner: [.222, .226, -.426], tie: [-.008, -.10, -.013], radius: [.058, .059] },
  { ...banana, x: -3.05, z: 3.7, heading: .45, corner: [-.367, .105, .373], tie: [-.003, -.155, -.021], radius: [.047, .045] },
  { ...banana, x: 3.1, z: 3.86, heading: 2.42, corner: [.299, .05, .345], tie: [-.004, -.19, -.021], radius: [.055, .053] },
];
