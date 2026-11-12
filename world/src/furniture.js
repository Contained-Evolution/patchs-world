// Where Patch sits. Each seat is a spot his feet stand on (he sits back onto the seat behind them),
// the way he faces, and what it is. Sizes match his clips: seated hips are about .28 above his feet.
import { places } from './terrain.js';

export const SEAT_HEIGHT = .22;
export const SEATS = {
 computer: { x: places.computer[0], z: places.computer[1], heading: Math.PI, kind: 'chair' },
 hammock: { x: -1.6, z: -4.2, heading: Math.PI, kind: 'bench' },
 beach: { x: places.beach[0], z: places.beach[1], heading: Math.PI / 2, kind: 'driftwood' },
 pond: { x: places.pond[0], z: places.pond[1], heading: Math.PI / 2, kind: 'stump' },
};
// The camp bench serves the rope shelves too.
SEATS.shelves = SEATS.hammock;

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

// What he does at the desk, from the moment he sat down: get his hands to the keys, type, and sit back near the end.
export function deskClip(action, seconds, remaining, durations) {
 const up = durations['sit-to-type'], back = durations['type-to-sit'];
 if (!DESK.has(action)) return { clip: 'type-to-sit', time: back };
 if (remaining < back) return { clip: 'type-to-sit', time: Math.max(0, back - remaining) };
 if (seconds < up) return { clip: 'sit-to-type', time: Math.max(0, seconds) };
 return { clip: 'typing', time: (seconds - up) % durations.typing };
}
