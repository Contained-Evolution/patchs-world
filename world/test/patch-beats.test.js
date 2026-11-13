import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { BEATS, TABLET_BEATS, SPIRITS, beatPlan, beatsFor, fits, pickBeat, walkClip } from '../src/patch-beats.js';
import { CLIPS } from '../src/patch-clips.js';
import { rng, seedFrom } from '../src/patch-motion.js';

const clipsOf = table => [table.base, ...table.breaks.flatMap(row => [row.clip, row.then, row.resume].filter(Boolean))];

test('no beat collides with how he is standing or what he is holding', () => {
  for (const [name, table] of Object.entries({ ...BEATS, ...TABLET_BEATS })) {
    for (const clip of clipsOf(table)) assert.ok(fits(clip, table), `${clip} collides with ${name}`);
  }
  assert.equal(fits('yawn', BEATS.archery), false, 'his hands are full of bow');
  assert.equal(fits('bow-aim', BEATS.idle), false, 'he has no bow in his hands');
  assert.equal(fits('sit-cheer', BEATS.idle), false, 'he is not sitting');
  assert.equal(fits('idle', BEATS.archery), true, 'relaxed arms can hold something');
});

test('dance keeps its base step and skips flips on cramped or wet ground', () => {
  const clips = (weather, room) => {
    const plan = beatPlan('dance', rng(7), 'happy', weather, room);
    assert.equal(plan.at(0).clip, 'dance-swing-2');
    return new Set(Array.from({ length: 900 }, (_, i) => plan.at(i * 4).clip));
  };
  assert.ok(clips('clear', true).has('flip'));
  for (const poses of [clips('clear', false), clips('rain', true)]) {
    assert.ok(poses.size > 4);
    assert.ok(!poses.has('flip') && !poses.has('backflip'));
  }
  assert.equal(walkClip('happy', 'rain'), 'walk');
});

test('every clip in the model is played somewhere on the island, or marked spare', () => {
  const source = readdirSync(new URL('../src/', import.meta.url)).filter(file => file.endsWith('.js')).filter(file => !['patch-clips.js', 'island-audio.js', 'animation-viewer.js'].includes(file))
    .map(file => readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8')).join('\n')
    + readFileSync(new URL('../src/patch-clips.js', import.meta.url), 'utf8').split('export const HANG_CLIPS')[1];
  for (const [clip, info] of Object.entries(CLIPS)) {
    assert.ok(info.posture && info.arms, `${clip} has no posture or arms`);
    const used = source.includes(`'${clip}'`) || new RegExp(`[{,\\s]${clip}:`).test(source);
    if (!info.spare) assert.ok(used, `${clip} is not played anywhere`);
  }
});

test('beats are the same for every visitor and can be joined late', () => {
  for (const name of Object.keys(BEATS)) {
    const seed = seedFrom(`${name}|x`), early = beatPlan(name, rng(seed), 'happy'), late = beatPlan(name, rng(seed), 'happy');
    for (let s = 0; s < 1500; s += 1.5) early.at(s);
    assert.deepEqual(late.at(1498.5), early.at(1498.5), name);
    const pose = late.at(700);
    assert.ok(pose.time >= 0 && pose.time < CLIPS[pose.clip].duration);
  }
});

test('no break plays twice running, and each waits its turn', () => {
  for (const spirit of SPIRITS) {
    const plan = beatPlan('idle', rng(seedFrom(`idle|${spirit}`)), spirit), runs = [];
    for (let s = 0; s < 3600; s += .5) {
      const { clip, index, base } = plan.at(s);
      if (!base && runs.at(-1)?.index !== index) runs.push({ clip, index, at: s });
    }
    assert.ok(runs.length > 40, `${spirit}: only ${runs.length} breaks in an hour`);
    for (let i = 1; i < runs.length; i++) assert.notEqual(runs[i].clip, runs[i - 1].clip, `${spirit}: ${runs[i].clip} twice running`);
    for (const row of BEATS.idle.breaks) {
      const times = runs.filter(run => run.clip === row.clip).map(run => run.at);
      for (let i = 1; i < times.length; i++) assert.ok(times[i] - times[i - 1] >= row.wait, `${row.clip} came back after ${times[i] - times[i - 1]} s`);
    }
  }
});

test('his spirit changes what he does', () => {
  const seen = spirit => { const plan = beatPlan('idle', rng(7), spirit), clips = new Set(); for (let s = 0; s < 3600; s += 1) clips.add(plan.at(s).clip); return clips; };
  const happy = seen('happy'), grumpy = seen('grumpy'), tired = seen('tired');
  assert.ok(happy.has('happy-idle') && !happy.has('angry') && !happy.has('yawn'));
  assert.ok(grumpy.has('angry') && grumpy.has('angry-point') && !grumpy.has('happy-idle'));
  assert.ok(tired.has('yawn') && !tired.has('jump'));
  assert.ok(happy.size >= 6, [...happy].join(','));
  assert.equal(walkClip('happy'), 'happy-walk');
  assert.equal(walkClip('grumpy'), 'walk');
});

test('a shot is a draw and then a held aim', () => {
  const plan = beatPlan('archery', rng(3), 'okay');
  let last = null, shots = 0;
  for (let s = 0; s < 600; s += .25) {
    const { clip } = plan.at(s);
    if (clip === 'bow-aim' && last !== 'bow-aim') { assert.equal(last, 'bow-draw'); shots++; }
    if (last === 'bow-draw' && clip !== 'bow-draw') assert.equal(clip, 'bow-aim');
    last = clip;
  }
  assert.ok(shots > 10, `${shots} shots in ten minutes`);
});

test('a short stop leaves out the long breaks, and a place can have its own table', () => {
  for (let i = 0; i < 200; i++) assert.notEqual(pickBeat(BEATS.explore, 'tired', rng(i), { span: 4 })?.clip, 'sit-ground');
  assert.equal(beatsFor('eat', 'shelves'), 'eat@shelves');
  assert.equal(beatsFor('eat', 'beach'), 'eat');
  assert.equal(beatsFor('sleep', 'hammock'), 'sleep');
});

test('sleep starts lying down, varies its roll timing, and can be joined mid-roll', () => {
  const rested = beatPlan('sleep', rng(7), 'okay');
  const storm = beatPlan('sleep', rng(7), 'okay', 'storm');
  const tired = beatPlan('sleep', rng(7), 'tired');
  const firstRoll = plan => {
    for (let s = 0; s < 600; s++) if (plan.at(s).clip === 'sleep-roll') return s;
  };
  assert.equal(rested.at(0).clip, 'sleep');
  const roll = firstRoll(rested);
  assert.ok(firstRoll(storm) < roll && firstRoll(tired) > roll);
  assert.deepEqual(beatPlan('sleep', rng(7), 'okay').at(roll), rested.at(roll));
  assert.equal(rested.at(roll + 20).clip, 'sleep');
});

test('sky watching stays seated during a storm', () => {
  const poses = weather => {
    const plan = beatPlan('watch-sky', rng(7), 'okay', weather);
    return new Set(Array.from({ length: 120 }, (_, i) => plan.at(i * 10).clip));
  };
  assert.ok(poses('clear').has('sky-watch'));
  assert.deepEqual([...poses('storm')].sort(), ['sit-ground', 'sit-idle-2', 'sit-idle-3']);
});
