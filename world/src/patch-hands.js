import { Quaternion, Vector3, MathUtils } from 'three';

// Bend the shoulder and elbow toward a wrist target while preserving both bone lengths.
export function patchArm(hand) {
  const elbow = hand?.parent, shoulder = elbow?.parent;
  if (!elbow?.isBone || !shoulder?.isBone) return null;

  const start = new Vector3(), mid = new Vector3(), end = new Vector3(), axis = new Vector3();
  const bend = new Vector3(), joint = new Vector3(), target = new Vector3();
  const from = new Vector3(), to = new Vector3(), parent = new Quaternion(), inverse = new Quaternion(), delta = new Quaternion();
  const baseShoulder = new Quaternion(), baseElbow = new Quaternion(), baseHand = new Quaternion();
  let posed = false;

  function aim(bone, pivot, current, desired) {
    bone.parent.getWorldQuaternion(parent);
    from.subVectors(current, pivot).normalize();
    to.subVectors(desired, pivot).normalize();
    delta.setFromUnitVectors(from, to).premultiply(inverse.copy(parent).invert()).multiply(parent);
    bone.quaternion.premultiply(delta);
  }

  return {
    reset() {
      if (!posed) return;
      shoulder.quaternion.copy(baseShoulder);
      elbow.quaternion.copy(baseElbow);
      hand.quaternion.copy(baseHand);
      posed = false;
    },
    reach(point, hint, weight = 1) {
      if (weight <= 0) return;
      baseShoulder.copy(shoulder.quaternion);
      baseElbow.copy(elbow.quaternion);
      baseHand.copy(hand.quaternion);
      posed = true;
      shoulder.getWorldPosition(start);
      elbow.getWorldPosition(mid);
      hand.getWorldPosition(end);
      const upper = start.distanceTo(mid), lower = mid.distanceTo(end);
      target.copy(end).lerp(point, weight);
      axis.subVectors(target, start);
      if (axis.lengthSq() < 1e-10) axis.subVectors(end, start);
      const distance = MathUtils.clamp(axis.length(), Math.abs(upper - lower) + .001, upper + lower - .001);
      axis.normalize();
      bend.subVectors(hint, start).addScaledVector(axis, -bend.dot(axis));
      if (bend.lengthSq() < 1e-6) bend.set(Math.abs(axis.y) > .8 ? 1 : 0, Math.abs(axis.y) > .8 ? 0 : 1, 0).addScaledVector(axis, -bend.dot(axis));
      bend.normalize();
      const along = (upper * upper - lower * lower + distance * distance) / (2 * distance);
      joint.copy(start).addScaledVector(axis, along).addScaledVector(bend, Math.sqrt(Math.max(0, upper * upper - along * along)));
      target.copy(start).addScaledVector(axis, distance);
      aim(shoulder, start, mid, joint);
      elbow.getWorldPosition(mid);
      hand.getWorldPosition(end);
      aim(elbow, mid, end, target);
    },
    orient(direction, weight = 1) {
      if (!posed) return;
      hand.getWorldPosition(end);
      hand.localToWorld(mid.set(0, 1, 0));
      joint.copy(mid).lerp(target.copy(end).add(direction), weight);
      aim(hand, end, mid, joint);
    },
  };
}
