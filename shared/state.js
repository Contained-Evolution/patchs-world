// The world state the Worker publishes and the browser draws.
// GET /api/state returns { patch, clock }; the browser polls it every few seconds.

// Places on the island. The world side owns their positions; the Worker only uses the IDs.
// hammock, shelves and computer (the coconut computer in its tent) together are his camp.
// tall-trees is the jungle forest; pond includes the stream and waterfall.
export const PLACES = ['hammock', 'shelves', 'computer', 'pond', 'banana-grove', 'tall-trees', 'beach', 'lookout', 'tide-pools', 'meadow', 'cave'];

// What Patch can be doing. Each maps to an animation or procedural motion in the browser.
// computer: at the coconut computer, reading and answering letters and searching the web.
// research and write: on his tablet anywhere (searching the web; writing his journal and memories), or typing when at the computer.
export const ACTIONS = ['idle', 'walk', 'run', 'climb', 'swing', 'swim', 'fish', 'eat', 'sit', 'sleep', 'think', 'write', 'research', 'computer', 'wave', 'look', 'explore', 'watch-sky'];

export const GIFT_SOUND_DURATION = 8000;

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
    speechUntil: null, // expiry for the spoken line
    speech: null, // the line being said or about to start: { text, at, until, voice } (voice: recording id, or null)
    carrying: ['smooth river stone from Dad'], // what he has with him
    mail: 0, // letters waiting for him at the coconut computer; his tablet pings him about them
    since: '2026-01-01T12:00:00Z', // when the current action started
    until: '2026-01-01T12:05:00Z', // when the current action ends
  },
  clock: {
    now: '2026-01-01T12:03:00Z',
    dayFraction: 0.5, // 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset
    weather: 'clear', // clear | cloudy | rain | storm
  },
};
