// The world state the Worker publishes and the browser draws.
// GET /patch/api/state returns { patch, clock }; the browser polls it every few seconds.

// Places on the island. The world side owns their positions; the Worker only uses the IDs.
// hammock and shelves together are his camp. tall-trees is the jungle forest; pond includes the stream and waterfall.
export const PLACES = ['hammock', 'shelves', 'pond', 'banana-grove', 'tall-trees', 'beach', 'lookout', 'tide-pools', 'meadow', 'cave'];

// What Patch can be doing. Each maps to an animation or procedural motion in the browser.
export const ACTIONS = ['idle', 'walk', 'run', 'climb', 'swing', 'swim', 'fish', 'eat', 'sit', 'sleep', 'think', 'write', 'phone', 'wave', 'look', 'explore', 'watch-sky'];

// Needs run from 0 (empty) to 1 (full).
export const NEEDS = ['hunger', 'energy', 'fun', 'comfort', 'social'];

export const sampleState = {
  patch: {
    action: 'eat',
    place: 'banana-grove',
    target: null, // a place ID he is heading to while walking, running or swinging
    needs: { hunger: 0.4, energy: 0.8, fun: 0.6, comfort: 0.7, social: 0.3 },
    mood: 'curious',
    says: null, // a short line he says out loud, or null
    until: '2026-01-01T12:10:00Z', // when the current action ends
    since: '2026-01-01T12:00:00Z', // when the current action started
  },
  clock: {
    now: '2026-01-01T12:03:00Z',
    dayFraction: 0.5, // 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset
    weather: 'clear', // clear | cloudy | rain | storm
  },
};
