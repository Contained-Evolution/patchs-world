// What Patch does with his body while an activity keeps him in one spot.
// Each activity has a base clip and a table of breaks. A break's weights say how
// often it comes up in each spirit (okay, happy, tired, grumpy; 0 leaves it out),
// and its wait is how many seconds pass before it may come round again. No break
// plays twice running. Every choice is seeded from the activity, so each visitor
// sees the same beats.
import { CLIPS } from './patch-clips.js';

export const SPIRITS = ['okay', 'happy', 'tired', 'grumpy'];
const beat = (clip, okay, happy, tired, grumpy, wait = 0, extra = {}) => ({ clip, weight: { okay, happy, tired, grumpy }, wait, ...extra });
const tablet = (oneHanded, twoHanded) => ({
  postures: ['stand'], holding: 'tablet', base: 'tablet-stand', breaks: [twoHanded, oneHanded],
});
export const TABLET_BEATS = {
  research: tablet(beat('texting', 2, 2, 1, 1, 60, { again: true }), beat('tablet-stand', 5, 5, 6, 6, 0, { again: true })),
  write: tablet(beat('texting', 3, 4, 2, 2, 35, { again: true }), beat('tablet-stand', 4, 4, 5, 5, 0, { again: true })),
};

// `postures` are the ways he may hold his body in the activity and `holding` is
// what is in his hands. `gap` is how long the base clip plays between breaks.
// A break with `hold` loops for about that many seconds; `then` follows it at once;
// `min` keeps it for stops at least that long.
export const BEATS = {
  //                        okay happy tired grumpy wait
  sleep: { postures: ['lie'], base: 'sleep', gap: [130, 310],
    moodGap: { tired: 1.35, grumpy: .8 }, weatherGap: { storm: .75 }, breaks: [
    beat('sleep-roll',        1,   1,   1,   1,  120, { again: true }),
  ] },
  'computer@desk': { postures: ['seat'], holding: 'keys', base: 'typing', gap: [32, 68],
    moodGap: { happy: 1.15, tired: .75, grumpy: .85 }, breaks: [
    beat('type-to-sit',      1,   1,   1,   1,    0, { then: 'seat-idle', hold: [6, 15], resume: 'sit-to-type', again: true }),
    beat('type-to-sit',      1,   1,   3,   2,    0, { then: 'sit', hold: [3, 7], resume: 'sit-to-type', again: true }),
  ] },
  'read@desk': { postures: ['seat'], base: 'seat-idle', gap: [15, 40], breaks: [
    beat('sit',             1,   2,   2,   1,    0, { hold: [5, 10], again: true }),
  ] },
  idle: { postures: ['stand'], base: 'idle', gap: [4, 12], breaks: [
    beat('look-around',      4,   4,   2,   2,    8),
    beat('happy-idle',       1,   4,   0,   0,   15, { hold: [4, 8] }),
    beat('happy-idle-2',    .5,   3,   0,   0,   20, { hold: [3, 9] }),
    beat('happy-swing',     .3,   2,   0,   0,   60),
    beat('dance-swing-2',    0, 1.5,   0,   0,   90, { hold: [5, 10] }),
    beat('excited',          0,   1,   0,   0,  120),
    beat('jump',            .3, 1.5,   0,   0,   45, { room: true, weatherWeight: { rain: 0, storm: 0 } }),
    beat('flip',             0,  .5,   0,   0,  180, { room: true, weatherWeight: { rain: 0, storm: 0 } }),
    beat('backflip',         0,  .5,   0,   0,  180, { room: true, weatherWeight: { rain: 0, storm: 0 } }),
    beat('yawn',            .2,   0,   6,  .5,   60),
    beat('angry',            0,   0,   0,   3,   90),
    beat('angry-point',      0,   0,   0,   2,   30),
  ] },
  think: { postures: ['stand'], base: 'idle', gap: [8, 20], breaks: [
    beat('look-around',      3,   3,   2,   2,   12),
    beat('happy-idle',      .5,   2,   0,   0,   30, { hold: [4, 6] }),
    beat('yawn',            .2,   0,   5,  .5,   60),
    beat('angry',            0,   0,   0, 1.5,  120),
  ] },
  'think@seat': { postures: ['seat'], base: 'seat-idle', gap: [15, 40], breaks: [
    beat('sit', 1, 2, 3, 2, 20, { hold: [5, 12], again: true }),
  ] },
  look: { postures: ['stand'], base: 'idle', gap: [3, 8], breaks: [
    beat('look-around',      6,   6,   4,   4,    0),
    beat('happy-idle',       1,   3,   0,   0,   20, { hold: [4, 8] }),
    beat('jump',            .2,   1,   0,   0,   60, { room: true, weatherWeight: { rain: 0, storm: 0 } }),
    beat('yawn',            .1,   0,   4,   0,   60),
    beat('angry-point',      0,   0,   0,   2,   30),
  ] },
  wave: { postures: ['stand'], base: 'idle', gap: [2, 5], breaks: [
    beat('excited',          5,   8,   2,   1,    0),
    beat('happy-idle',       3,   3,   3,   2,    0, { hold: [4, 8] }),
    beat('happy-swing',      2,   3,   0,   0,   30),
    beat('jump',             1,   2,   0,   0,   20, { room: true, weatherWeight: { rain: 0, storm: 0 } }),
    beat('look-around',      2,   2,   2,   3,    6),
  ] },
  eat: { postures: ['stand'], base: 'idle', gap: [10, 22], breaks: [
    beat('look-around',      2,   2,   1,   2,   12),
    beat('happy-idle',       1,   3,   0,   0,   25, { hold: [4, 6] }),
  ] },
  // At the rope shelves he reaches up for each banana before he eats it.
  'eat@shelves': { postures: ['stand'], base: 'idle', gap: [8, 16], breaks: [
    beat('pick-fruit',       6,   6,   6,   6,    0),
    beat('look-around',      1,   1,   1,   1,   20),
    beat('happy-idle',      .5,   2,   0,   0,   30, { hold: [4, 6] }),
  ] },
  // Every stop on a roam is one beat.
  explore: { postures: ['stand', 'ground'], base: 'idle', gap: [3, 9], breaks: [
    beat('look-around',      5,   5,   4,   4,    0),
    beat('idle',             3,   2,   3,   3,    0),
    beat('happy-idle',      .5,   3,   0,   0,   20),
    beat('happy-idle-2',     0,   2,   0,   0,   30),
    beat('jump',             1,   2,   0,   0,   30, { room: true, weatherWeight: { rain: 0, storm: 0 } }),
    beat('flip',            .2,   1,   0,   0,  120, { room: true, weatherWeight: { rain: 0, storm: 0 } }),
    beat('sit-ground',       1,   1,   4,   1,   60, { room: true, min: 7, weatherWeight: { rain: 0, storm: 0 } }),
    beat('yawn',             0,   0,   3,   0,   90, { min: 8 }),
    beat('angry-point',      0,   0,   0, 1.5,   40),
  ] },
  // He leans or lies back to watch the sky, then sits up again.
  'watch-sky': { postures: ['ground', 'lie'], base: 'sit-ground', gap: [30, 90], breaks: [
    beat('sit-idle-3',       4,   4,   4,   4,    0, { hold: [40, 120] }),
    beat('sit-idle-2',       2,   2,   1,   3,    0, { hold: [20, 60] }),
    beat('sky-watch',        5,   5,   6,   2,    0, { hold: [60, 180], weatherWeight: { rain: 0, storm: 0 } }),
    beat('lay',              2,   2,   2,   2,    0, { hold: [30, 90], weatherWeight: { rain: .25, storm: 0 } }),
  ] },
  // Sitting where there is no seat.
  sit: { postures: ['ground', 'lie'], base: 'sit-ground', gap: [20, 45], breaks: [
    beat('sit-idle-2',       3,   3,   2,   3,    0, { hold: [20, 45] }),
    beat('sit-idle-3',       2,   3,   4,   1,    0, { hold: [20, 45] }),
    beat('lay',              2,   2,   3,   1,    0, { hold: [20, 45], weatherWeight: { rain: 0, storm: 0 } }),
    beat('lay-pose',         1,   1,   2,   1,   60, { hold: [20, 40], weatherWeight: { rain: 0, storm: 0 } }),
  ] },
  // On a chair, bench, driftwood or stump, once he has lowered himself onto it.
  'sit@seat': { postures: ['seat'], base: 'seat-idle', gap: [8, 20], breaks: [
    beat('sit',              3,   2,   3,   2,    0, { hold: [6, 12] }),
    beat('sit-cheer',        0,   3,   0,   0,   40),
    beat('sit-scared',       0,   0,   0,   2,   90),
  ] },
  // He strings dances together, keeping the beat between them.
  dance: { postures: ['stand'], base: 'dance-swing-2', gap: [2.5, 7.5], breaks: [
    beat('dance-hip-hop',    4,   4,   3,   4,    0),
    beat('dance',            3,   4,   1,   3,   20),
    beat('dance-hip-hop-2',  3,   3,   2,   3,   30),
    beat('dance-hip-hop-3',  2,   3,   1,   2,   40),
    beat('dance-arms',       3,   3,   4,   3,   40),
    beat('dance-swing',      2,   3,   1,   2,   40),
    beat('flip',            .5,   1,   0,  .3,   60, { room: true, weatherWeight: { rain: 0, storm: 0 } }),
    beat('backflip',        .5,   1,   0,  .3,   60, { room: true, weatherWeight: { rain: 0, storm: 0 } }),
    beat('excited',         .5,   1,   0,   0,   90),
  ] },
  // A shot is a draw and a held aim; between shots he checks his bow or looks for his mark.
  archery: { postures: ['stand'], holding: 'bow', base: 'bow-idle', gap: [3, 8], breaks: [
    beat('bow-draw',         6,   7,   4,   6,    0, { then: 'bow-aim', hold: [2.5, 5], again: true, weatherWeight: { rain: .7, storm: .35 } }),
    beat('bow-look',         2,   2,   1,   2,   10),
    beat('bow-examine',    1.5, 1.5,   2,   2,   25),
  ] },
};

// The table an activity uses at a place, or on a seat, or null when it has none.
export const beatsFor = (action, place, seated = false) => seated ? (BEATS[`${action}@seat`] ? `${action}@seat` : null) : BEATS[`${action}@${place}`] ? `${action}@${place}` : BEATS[action] ? action : null;

// A clip collides with a moment when his body is held another way, or when his
// hands are not as the clip needs them.
export function fits(clip, { postures, holding = null }) {
  const { posture, arms } = CLIPS[clip];
  return postures.includes(posture) && (arms === 'relaxed' || arms === (holding || 'free'));
}

// One weighted choice from a table. `last` is the break before, `played` maps each
// clip to when it last ended, `at` is now and `span` is how long he has.
export function pickBeat(table, spirit, random, { last = null, played = new Map(), at = 0, span = Infinity, weather = 'clear', room = true } = {}) {
  const mood = SPIRITS.includes(spirit) ? spirit : 'okay';
  const weight = row => row.weight[mood] * (row.weatherWeight?.[weather] ?? 1);
  const open = table.breaks.filter(row => {
    const clip = CLIPS[row.clip];
    const minimum = Math.max(row.min || 0, clip.once ? clip.duration : 0);
    const lastEnd = played.get(row.clip) ?? -Infinity;
    return weight(row) > 0 && (row.again || row.clip !== last)
      && minimum <= span && lastEnd + row.wait <= at && fits(row.clip, table) && (!row.room || room);
  });
  let roll = random() * open.reduce((sum, row) => sum + weight(row), 0);
  for (const row of open) { roll -= weight(row); if (roll <= 0) return row; }
  return open.at(-1) || null;
}

// A seeded timeline for a standing-still activity: the base clip, a break, the base clip again.
// at(seconds) gives the clip and the time within it, and can be joined at any moment.
export function beatPlan(name, random, spirit = 'okay', weather = 'clear', room = true) {
  const table = BEATS[name], beats = [], played = new Map();
  let time = 0, last = null;
  const span = ([a, b]) => a + random() * (b - a);
  const add = (clip, length) => { beats.push({ clip, t0: time, t1: time + length }); time += length; };
  // A held clip plays whole loops, so it hands over on its own first frame.
  const held = (clip, hold) => Math.max(1, Math.round(span(hold) / CLIPS[clip].duration)) * CLIPS[clip].duration;
  function next() {
    const gapScale = (table.moodGap?.[spirit] ?? 1) * (table.weatherGap?.[weather] ?? 1);
    add(table.base, span(table.gap) * gapScale);
    const row = pickBeat(table, spirit, random, { last, played, at: time, weather, room });
    if (!row) return;
    if (row.then) { add(row.clip, CLIPS[row.clip].duration); add(row.then, held(row.then, row.hold)); }
    else add(row.clip, row.hold ? held(row.clip, row.hold) : CLIPS[row.clip].duration);
    if (row.resume) add(row.resume, CLIPS[row.resume].duration);
    last = row.clip;
    played.set(row.clip, time);
  }
  return { at(seconds) {
    seconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    while (time <= seconds) next();
    let lo = 0, hi = beats.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (beats[mid].t0 <= seconds) lo = mid; else hi = mid - 1; }
    const { clip, t0, t1 } = beats[lo];
    return { clip, time: (seconds - t0) % CLIPS[clip].duration, elapsed: seconds - t0, duration: t1 - t0, base: clip === table.base, index: lo };
  } };
}

// He walks with a spring in his step when he feels good.
export const walkClip = (spirit, weather) => spirit === 'happy' && !['rain', 'storm'].includes(weather) ? 'happy-walk' : 'walk';
