import { MathUtils, PerspectiveCamera } from 'three';
import { forest } from './forest.js';
import { hammockSupports } from './hammock.js';
import { pondSwings } from './pond-swings.js';
import { MAP_BOUNDS, LANDMARKS } from './valley/companion-layout.js';
import { waterEdgeDistance } from './valley/valley-water-layout.js';
import { groundHeight, ISLAND } from './terrain.js';

// Crown envelopes include overhanging leaves, so the drone cannot enter from the side.
const crowns = [
  ...LANDMARKS.filter(site => site.id !== 'cabin').map(({ x, z, radius }) => [x, z, radius, groundHeight(x, z) + 8]),
  ...forest.map(({ x, z, h, broad }) => [x, z, broad ? 8 : 6.5, groundHeight(x, z) + h + (broad ? 5 : 2)]),
  ...hammockSupports.map(({ x, z, scale }) => [x, z, scale * .65, groundHeight(x, z) + scale * 1.1]),
  ...pondSwings.map(({ x, y, z, scale }) => [x, z, scale * .75, y + scale * 1.15])
];

const terrainFloor = (x, z) => Math.max(waterEdgeDistance(x, z) < 0 ? ISLAND.pondY : -Infinity, groundHeight(x, z)) + 1.8;

function flightFloor(x, z) {
  let floor = terrainFloor(x, z);
  for (const [cx, cz, radius, top] of crowns) {
    if ((cx - x) ** 2 + (cz - z) ** 2 <= radius ** 2) floor = Math.max(floor, top + 1);
  }
  return floor;
}

function clearsCrowns(position, x, z, altitude) {
  const dx = x - position.x, dz = z - position.z;
  const lengthSquared = dx * dx + dz * dz;
  for (const [cx, cz, radius, top] of crowns) {
    if (altitude >= top + 1) continue;
    const offsetX = cx - position.x, offsetZ = cz - position.z;
    const t = MathUtils.clamp((offsetX * dx + offsetZ * dz) / lengthSquared, 0, 1);
    if ((offsetX - dx * t) ** 2 + (offsetZ - dz * t) ** 2 <= radius ** 2) return false;
  }
  return true;
}

export function createDrone() {
  const camera = new PerspectiveCamera(52, 1, .1, 12000);
  let highest = Math.max(...crowns.map(crown => crown[3]));
  for (let x = MAP_BOUNDS.x0; x <= MAP_BOUNDS.x1; x += 8) {
    for (let z = MAP_BOUNDS.z0; z <= MAP_BOUNDS.z1; z += 8) {
      highest = Math.max(highest, groundHeight(x, z));
    }
  }
  const startAltitude = highest + 14;
  const maxAltitude = startAltitude + 100;
  let pitch, yaw;

  function aim(turn, tilt) {
    yaw -= turn;
    pitch = MathUtils.clamp(pitch + tilt, -Math.PI / 2, 0);
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
  }

  return {
    camera,
    reset() {
      camera.position.set(0, startAltitude, (MAP_BOUNDS.z0 + MAP_BOUNDS.z1) / 2);
      pitch = -Math.PI / 2;
      yaw = 0;
      aim(0, 0);
    },
    look(dx, dy) { aim(dx * .005, dy * .005); },
    steer(turn, tilt, forward, lift, elapsed) {
      aim(turn * 1.2 * elapsed, tilt * 1.2 * elapsed);
      const position = camera.position;
      const altitude = MathUtils.clamp(position.y + lift * 14 * elapsed,
        flightFloor(position.x, position.z), maxAltitude);
      const distance = 34 * forward * elapsed;
      const x = position.x - Math.sin(yaw) * distance;
      const z = position.z - Math.cos(yaw) * distance;
      const canAdvance = distance && x >= MAP_BOUNDS.x0 && x <= MAP_BOUNDS.x1 && z >= MAP_BOUNDS.z0 && z <= MAP_BOUNDS.z1 &&
        altitude >= terrainFloor(x, z) &&
        altitude >= terrainFloor((x + position.x) / 2, (z + position.z) / 2) &&
        clearsCrowns(position, x, z, altitude);
      const motor = Math.max(Math.abs(turn), canAdvance ? Math.abs(forward) : 0,
        altitude !== position.y ? Math.abs(lift) : 0);
      if (canAdvance) position.set(x, altitude, z);
      else position.y = altitude;
      return motor;
    }
  };
}
