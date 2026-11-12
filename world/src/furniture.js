// Where Patch sits. Each seat is a spot his feet stand on (he sits back onto the seat behind them),
// the way he faces, and what it is. Sizes match his clips: seated hips are about .28 above his feet.
import { places } from './terrain.js';
import { CLIPS } from './patch-clips.js';

export const SEAT_HEIGHT = .22;
export const SEATS = {
 computer: { x: places.computer[0], z: places.computer[1], heading: Math.PI, kind: 'chair' },
 hammock: { x: -1.6, z: -4.2, heading: Math.PI, kind: 'bench' },
 beach: { x: places.beach[0], z: places.beach[1], heading: Math.PI / 2, kind: 'driftwood' },
 pond: { x: places.pond[0], z: places.pond[1], heading: Math.PI / 2, kind: 'stump' },
};
// The camp bench serves the rope shelves too.
SEATS.shelves = SEATS.hammock;

// The tent runs east–west so the entrance opens toward the camp clearing.
const [computerX, computerZ] = places.computer;
export const COMPUTER_DESK_DISTANCE = .60;
export const COMPUTER_TENT = {
 x: computerX, z: computerZ + .8, scale: 7.5, halfLength: 3.45, halfWidth: 3.05, halfDoor: .72,
};
export function insideComputerTent(x, z) {
 const tent = COMPUTER_TENT;
 return Math.abs(x - tent.x) < tent.halfLength && Math.abs(z - tent.z) < tent.halfWidth;
}

export function computerActivity(action, place, target, secondsLeft) {
 if (place !== 'computer' || target) return 'Inbox';
 if (action === 'research') return 'Searching the web';
 if (action === 'write') return 'Writing';
 if (action === 'computer') return secondsLeft <= 1 ? 'Reading' : 'Messaging';
 if (action === 'sit' || action === 'think' || action === 'idle') return 'Reading';
 return 'Inbox';
}

const DESK = new Set(['computer', 'research', 'write']);
// Seated activities only use a seat where one stands. At the coconut computer he sits for desk work.
export function seatFor(action, place) {
 if (!SEATS[place]) return null;
 if (action === 'sit' || (action === 'fish' && place === 'pond')) return SEATS[place];
 if (place === 'computer' && (DESK.has(action) || action === 'think' || action === 'idle')) return SEATS.computer;
 return null;
}
// On the tablet unless he is at the coconut computer.
export const usesTablet = (action, place) => (action === 'research' || action === 'write') && place !== 'computer';

export const deskBeats = action => DESK.has(action) ? 'computer@desk' : 'read@desk';

// Desk work starts with reaching for the keys, then follows the shared timeline.
export function deskClip(action, seconds, remaining, plan) {
 if (!DESK.has(action)) return plan.at(seconds);
 const up = CLIPS['sit-to-type'].duration, back = CLIPS['type-to-sit'].duration;
 if (seconds < up) return { clip: 'sit-to-type', time: Math.max(0, seconds) };
 const pose = plan.at(seconds - up);
 if (pose.clip === 'typing' && remaining < back) return { clip: 'type-to-sit', time: Math.max(0, back - remaining) };
 return pose;
}
