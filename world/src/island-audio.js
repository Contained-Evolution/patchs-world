import { ACTIONS, GIFT_SOUND_DURATION } from '../../shared/state.js';
import { ISLAND, places, pondFraction, shoreFraction, streamInfo, TIDE_POOLS } from './terrain.js';

const steps = new Set(['walk', 'run', 'walk-texting', 'carry-walk', 'carry-jog', 'carry-run']);
const sleep = new Set(['sleep', 'sleep-lay', 'sleep-roll']);
const actionSounds = {
  idle: 'breath', think: 'breath', look: 'rustle', wave: 'rustle', explore: 'rustle',
  walk: 'step', run: 'step', climb: 'grip', swing: 'rope', swim: 'splash',
  fish: 'cast', eat: 'bite', sit: 'seat', sleep: 'cloth',
  write: 'tap', research: 'tap', computer: 'key', 'watch-sky': 'seat'
};
const clipSounds = {
  'sleep-roll': 'cloth', 'sit-to-type': 'seat', 'type-to-sit': 'seat',
  'sit-ground': 'seat', 'tablet-stand': 'tap', 'pick-up': 'rustle', 'pick-fruit': 'rustle',
  'walk-texting': 'tap', 'hang-drop': 'rustle', 'braced-drop': 'rustle', yawn: 'breath',
  'open-lid': 'lid', 'carry-stop': 'seat', 'swing-start': 'rope',
  'swing-land': 'land', 'rope-to-ground': 'land', 'climb-top': 'grip',
  'jump-down': 'rustle', jump: 'rustle', fall: 'rustle'
};
const repeats = {
  typing: [.18, 'key'], 'tablet-stand': [1.1, 'tap'],
  swim: [.68, 'splash'], tread: [1.55, 'splash'],
  'rope-climb': [.52, 'rope'], 'rope-swing': [.65, 'rope'], 'rope-hang': [1.5, 'rope'], swing: [.75, 'rope'],
  hang: [1.5, 'grip']
};

// Each burst describes a filtered noise band and its envelope.
const effects = {
  grass: [[.16, 1550, .28], [.08, 190, .34]],
  sand: [[.19, 650, .32], [.1, 210, .22]],
  stone: [[.07, 1850, .34], [.1, 330, .35]],
  wet: [[.18, 1250, .48], [.13, 430, .25]],
  breath: [[.38, 520, .12]],
  rustle: [[.25, 1750, .30], [.15, 780, .2, .12]],
  grip: [[.16, 1080, .30], [.09, 240, .26]],
  rope: [[.3, 460, .37], [.18, 1050, .15, .07]],
  cloth: [[.46, 600, .35], [.29, 1380, .22, .12]],
  splash: [[.32, 1350, .45], [.23, 560, .37, .04]],
  cast: [[.14, 2400, .24], [.25, 930, .4, .21]],
  bite: [[.08, 1350, .46], [.11, 600, .35, .15], [.10, 690, .29, .31]],
  seat: [[.18, 240, .35], [.27, 540, .25, .06]],
  key: [[.034, 2600, .28], [.06, 540, .19]],
  tap: [[.046, 1500, .3], [.065, 290, .25]],
  lid: [[.23, 540, .38], [.09, 260, .40, .21]],
  land: [[.14, 210, .52], [.18, 930, .24]],
  bounce: [[.17, 180, .5], [.12, 230, .32, .29], [.08, 270, .23, .48]],
  thunder: [[2.4, 92, .58], [1.5, 160, .34, .45]]
};

const clamp = value => Math.max(0, Math.min(1, value));
export function actionSound(action) {
  return ACTIONS.includes(action) ? actionSounds[action] : undefined;
}

export function giftSoundAt(gift, now) {
  if (!gift || !Object.hasOwn(places, gift.place) || !Number.isFinite(gift.at) ||
      now - gift.at >= GIFT_SOUND_DURATION) return null;
  if (gift.action === 'play') return 'bounce';
  if (gift.action === 'eat') return 'bite';
  return 'rustle';
}

export function ambienceAt(x, z, daylight, weather) {
  const coast = shoreFraction(x, z);
  const stream = streamInfo(x, z).distance;
  const pond = pondFraction(x, z);
  const tide = Math.min(...TIDE_POOLS.map(([px, pz]) => Math.hypot(x - px, z - pz)));
  const [cx, cz] = places.cave;
  const sheltered = Math.abs(x - cx) < 5 && z < cz - 3 && z > cz - 16;
  const rain = weather === 'storm' ? 1 : weather === 'rain' ? .64 : 0;
  const water = Math.max(clamp((1.18 - pond) * 2), clamp(1 - stream / 23), clamp(1 - tide / 19) * .65);
  return {
    wind: (sheltered ? .12 : 1) * (.42 + rain * .55),
    rain: rain * (sheltered ? .18 : 1),
    surf: clamp((coast - .82) / .18),
    water,
    birds: !sheltered && daylight > .25 && rain < .8,
    surface: stream < 2.1 ? 'wet' : coast > .88 ? 'sand' : sheltered ? 'stone' : 'grass'
  };
}

export function createIslandAudio(button) {
  let context, output, noise, layers, soundOn = true, paused = false;
  let nextBird = 0, nextThunder = 0, nextRepeat = 0, visitorStride = 0, patchStride = 0;
  let lastClip, lastActivity, lastMail, lastGift, lastCarrying, lastCueTime = -1;
  let lastMix = -1, environment, leftFoot = false;
  try { soundOn = localStorage.getItem('patch-sound') !== 'muted'; } catch {}

  function syncButton() {
    const active = soundOn && context?.state === 'running';
    button.setAttribute('aria-pressed', String(Boolean(active)));
    button.textContent = active ? 'Sound on' : 'Sound off';
  }

  function start() {
    if (!soundOn || document.hidden || paused) return;
    if (!context) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) { button.disabled = true; return; }
      try { context = new Audio(); } catch { button.disabled = true; return; }
      context.addEventListener('statechange', syncButton);
      output = context.createGain();
      output.gain.value = .64;
      output.connect(context.destination);
      noise = context.createBuffer(1, context.sampleRate * 4, context.sampleRate);
      const samples = noise.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
      layers = {
        wind: layer(380), rain: layer(3000), surf: layer(245), water: layer(1170)
      };
    }
    context.resume().then(syncButton, syncButton);
  }

  function layer(frequency) {
    const source = context.createBufferSource(), filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = noise;
    source.loop = true;
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = .55;
    gain.gain.value = 0;
    source.connect(filter).connect(gain).connect(output);
    source.start(0, Math.random() * 3);
    return gain.gain;
  }

  function applyVolume() {
    if (output) output.gain.setTargetAtTime(soundOn && !paused && !document.hidden ? .64 : 0, context.currentTime, .04);
    syncButton();
  }

  button.addEventListener('click', () => {
    soundOn = !(soundOn && context?.state === 'running');
    try { localStorage.setItem('patch-sound', soundOn ? 'on' : 'muted'); } catch {}
    if (soundOn) start();
    applyVolume();
  });
  document.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' && !button.contains(event.target)) start();
  }, { passive: true });
  document.addEventListener('pointerup', event => {
    if (event.pointerType !== 'mouse' && !button.contains(event.target)) start();
  }, { passive: true });
  document.addEventListener('click', event => {
    if (!button.contains(event.target)) start();
  }, { passive: true });
  document.addEventListener('keydown', event => {
    if (!event.repeat && !button.contains(event.target)) start();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && context) start();
    applyVolume();
  });
  syncButton();

  function voice(duration, volume, pan, time) {
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + Math.min(.02, duration / 4));
    gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
    const stereo = context.createStereoPanner();
    stereo.pan.value = pan;
    gain.connect(stereo).connect(output);
    return { gain, stereo };
  }

  function finish(source, filter, voiceNodes, end) {
    source.onended = () => {
      source.disconnect();
      filter?.disconnect();
      voiceNodes.gain.disconnect();
      voiceNodes.stereo.disconnect();
    };
    source.stop(end);
  }

  function play(name, volume, pan = 0) {
    if (volume < .006) return;
    for (const [duration, frequency, level, delay = 0] of effects[name]) {
      const time = context.currentTime + delay;
      const source = context.createBufferSource(), filter = context.createBiquadFilter();
      const nodes = voice(duration, volume * level, pan, time);
      source.buffer = noise;
      source.playbackRate.value = .92 + Math.random() * .16;
      filter.type = 'bandpass';
      filter.frequency.value = frequency * (.84 + Math.random() * .32);
      filter.Q.value = 1;
      source.connect(filter).connect(nodes.gain);
      source.start(time, Math.random());
      finish(source, filter, nodes, time + duration);
    }
  }

  function chirp(frequency, end, time, duration, pan, level) {
    const source = context.createOscillator(), nodes = voice(duration, level, pan, time);
    source.frequency.setValueAtTime(frequency, time);
    source.frequency.exponentialRampToValueAtTime(end, time + duration);
    source.connect(nodes.gain);
    source.start(time);
    finish(source, null, nodes, time + duration);
  }

  return {
    pause(value) {
      if (paused === value) return;
      paused = value;
      applyVolume();
    },
    update(camera, state) {
      if (!context || !soundOn || paused || document.hidden || context.state !== 'running') return;
      const time = context.currentTime;
      const { x, z } = camera.position;
      if (time - lastMix > .08) {
        environment = ambienceAt(x, z, state.daylight, state.weather);
        const mix = state.silent ? 0 : 1;
        layers.wind.setTargetAtTime(mix * environment.wind * (.39 + .13 * Math.sin(time * 1.1)), time, .32);
        layers.rain.setTargetAtTime(mix * environment.rain * .33, time, .32);
        layers.surf.setTargetAtTime(mix * environment.surf * (.18 + .12 * Math.sin(time * 1.15)), time, .4);
        layers.water.setTargetAtTime(mix * environment.water * .27, time, .32);
        lastMix = time;
      }
      if (state.silent) return;
      if (environment.birds && time >= nextBird) {
        nextBird = time + 6 + Math.random() * 9;
        const pan = Math.random() * 1.6 - .8, pitch = 1500 + Math.random() * 850;
        chirp(pitch, pitch * 1.65, time, .12, pan, .09);
        chirp(pitch * 1.3, pitch * .85, time + .16, .17, pan, .075);
        chirp(pitch * 1.2, pitch * 1.4, time + .39, .10, pan, .055);
      }
      if (state.weather === 'storm' && time >= nextThunder) {
        nextThunder = time + 15 + Math.random() * 22;
        play('thunder', .38);
      }

      visitorStride += state.walked;
      if (visitorStride >= 1.22) {
        leftFoot = !leftFoot;
        play(environment.surface, .85, leftFoot ? -.11 : .11);
        visitorStride %= 1.22;
      }
      const { patch, previousPatch, clip, clipTime, action, place, since, target, mail } = state;
      if (!patch) return;
      const dx = patch.x - x, dz = patch.z - z;
      const distance = Math.hypot(dx, patch.y - camera.position.y, dz);
      const right = camera.matrixWorld.elements;
      const pan = Math.max(-.85, Math.min(.85, (dx * right[0] + dz * right[2]) / Math.max(2, distance)));
      const volume = .91 / (1 + (distance / 8) ** 2);
      const moving = steps.has(clip);
      const patchTravel = Math.hypot(patch.x - previousPatch.x, patch.z - previousPatch.z);
      if (moving && patchTravel < 1) patchStride += patchTravel;
      else patchStride = 0;
      if (patchStride >= .79) {
        play(ambienceAt(patch.x, patch.z, state.daylight, state.weather).surface, volume, pan);
        patchStride %= .79;
      }

      const activity = [action, place, since].join('|');
      const ready = clip && !target && !moving && clip !== 'yawn' &&
        (action !== 'sleep' || place !== 'hammock' || sleep.has(clip));
      let cue;
      if (ready && lastActivity !== activity) {
        lastActivity = activity;
        cue = actionSound(action);
      }
      if (clip !== lastClip) {
        cue = clipSounds[clip] || cue;
        nextRepeat = time + .18;
        lastClip = clip;
        lastCueTime = -1;
      }
      if (cue && cue !== 'step') play(cue, volume, pan);
      const recurring = repeats[clip] || (/^(climb|braced|hang-shimmy)/.test(clip || '') ? [.58, 'grip'] :
        ready && action === 'fish' ? [13, 'cast'] : ready && action === 'eat' && clip === 'idle' ? [3, 'bite'] : null);
      if (recurring && time >= nextRepeat && clipTime !== lastCueTime) {
        play(recurring[1], volume * .7, pan);
        nextRepeat = time + recurring[0] * (.8 + Math.random() * .4);
        lastCueTime = clipTime;
      }
      if (lastMail !== undefined && mail > lastMail) {
        chirp(740, 810, time, .16, pan, volume * .12);
        chirp(990, 1050, time + .12, .24, pan, volume * .10);
      }
      lastMail = mail;
      const carrying = JSON.stringify(state.carrying || []);
      if (lastCarrying !== undefined && carrying !== lastCarrying && action !== 'eat') {
        play('rustle', volume, pan);
      }
      lastCarrying = carrying;

      const gift = state.gift;
      const giftCue = giftSoundAt(gift, state.now);
      if (giftCue && gift.at !== lastGift) {
        lastGift = gift.at;
        const [gx, gz] = places[gift.place];
        const distance = Math.hypot(gx - x, gz - z);
        const pan = Math.max(-.85, Math.min(.85, ((gx - x) * right[0] + (gz - z) * right[2]) / Math.max(2, distance)));
        play(giftCue,
          .91 / (1 + (distance / 8) ** 2), pan);
      }
    }
  };
}
