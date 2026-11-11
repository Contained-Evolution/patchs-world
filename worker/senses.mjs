// What Patch can see, hear and feel. Everything is worked out from the time alone,
// so every visitor and his mind meet the same weather and the same happenings.

import { localMinutes } from './body.mjs';

const MINUTE = 60000, BLOCK = 3 * 60 * MINUTE, SLOT = 20 * MINUTE;

function hash(n) {
  let t = (n ^ 0x9e3779b9) >>> 0;
  t = Math.imul(t ^ (t >>> 16), 0x85ebca6b);
  t = Math.imul(t ^ (t >>> 13), 0xc2b2ae35);
  return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
}

// Weather holds for three-hour spells and leans on the spell before, so rain comes and goes in runs.
const NEXT = { clear: [.62, .26, .1, .02], cloudy: [.35, .35, .24, .06], rain: [.25, .3, .33, .12], storm: [.15, .3, .45, .1] };
const KINDS = ['clear', 'cloudy', 'rain', 'storm'];
export function weatherAt(time) {
  const block = Math.floor(time / BLOCK);
  let weather = 'clear';
  for (let b = block - 8; b <= block; b++) {
    const roll = hash(b * 7 + 1), odds = NEXT[weather];
    let sum = 0;
    weather = KINDS.find((_, i) => roll < (sum += odds[i])) || 'clear';
  }
  return weather;
}
// When the weather next changes, and to what.
export function nextWeather(time) {
  const now = weatherAt(time);
  for (let at = (Math.floor(time / BLOCK) + 1) * BLOCK; at < time + 2 * 86400000; at += BLOCK) if (weatherAt(at) !== now) return { at, weather: weatherAt(at) };
  return null;
}

export function dayPart(time) {
  const m = localMinutes(time);
  return m < 5 * 60 + 30 ? 'night' : m < 7 * 60 ? 'dawn' : m < 12 * 60 ? 'morning' : m < 17 * 60 ? 'afternoon' : m < 20 * 60 + 30 ? 'evening' : 'night';
}

const SURROUNDINGS = {
  hammock: { day: 'Your hammock sways between two trees. The rope shelves creak a little.', night: 'Your hammock is dark and cozy. Frogs are singing somewhere.', tags: ['home', 'sleeping'] },
  shelves: { day: 'Bananas hang on your rope shelves, high off the ground like Mom taught you.', night: 'The shelves are just shadows. Something small rustles below them.', tags: ['food', 'rope', 'banana'] },
  pond: { day: 'The pond is green and still. The little stream gurgles into it.', night: 'The pond is black and full of stars. The stream keeps talking.', tags: ['water', 'river', 'fishing'] },
  'banana-grove': { day: 'Big floppy banana leaves everywhere. It smells sweet.', night: 'The banana leaves swish in the dark.', tags: ['banana', 'food', 'trees'] },
  'tall-trees': { day: 'Tall, tall trees with vines between them. Birds call from the canopy.', night: 'The tall trees creak. You can only see the tops against the sky.', tags: ['trees', 'swinging', 'canopy'] },
  beach: { day: 'Waves roll in and out. Far across the water there is other land.', night: 'The waves whoosh in the dark. The land across the water is gone.', tags: ['ocean', 'big world', 'home'] },
  lookout: { day: 'From up here you can see the whole island, and the sea all around.', night: 'The whole sky is right above you up here.', tags: ['hills', 'big world', 'sky'] },
  'tide-pools': { day: 'Rocky pools full of tiny moving things. It smells salty.', night: 'The rock pools glitter a little in the dark.', tags: ['water', 'exploring'] },
  meadow: { day: 'Open grass and flowers, with lots of sky.', night: 'Open grass under a huge night sky.', tags: ['fields', 'clouds', 'sky'] },
  cave: { day: 'A cool, drafty cave. Your voice comes back to you.', night: 'The cave is very dark and very quiet.', tags: ['cave', 'echo'] },
};
const WEATHER_WORDS = {
  clear: { day: 'The sky is clear and the sun is warm.', night: 'The sky is clear.', tags: ['sky'] },
  cloudy: { day: 'Clouds are drifting over. Some of them look like things.', night: 'Clouds hide most of the stars.', tags: ['clouds'] },
  rain: { day: 'It is raining. Everything is dripping.', night: 'Rain is pattering on the leaves.', tags: ['rain', 'weather'] },
  storm: { day: 'A storm! Thunder booms and the wind pushes the trees.', night: 'A storm in the dark. Lightning flashes, then the thunder booms.', tags: ['storm', 'thunder', 'rain', 'scared'] },
};
// Places with a roof over him.
export const SHELTERED = new Set(['cave']);
// Things lying around that he could pick up, and which of them he can eat.
const FINDS = {
  beach: ['shell', 'driftwood'], 'tide-pools': ['shell', 'pebble'], 'tall-trees': ['feather', 'vine'], 'banana-grove': ['banana'],
  shelves: ['banana'], meadow: ['flower'], cave: ['smooth stone'], pond: ['smooth stone', 'reed'], lookout: ['pebble'], hammock: [],
};
export const FOOD = ['banana', 'coconut'];

// Little things that happen. Each has where it can happen, when, and how often.
const HAPPENINGS = [
  { where: ['beach'], when: ['morning', 'afternoon'], text: 'A crab is walking sideways right past your foot.', tags: ['crab', 'exploring'] },
  { where: ['beach'], when: ['morning', 'afternoon', 'evening'], text: 'A coconut just thumped down onto the sand.', tags: ['coconut', 'food'], find: 'coconut' },
  { where: ['pond'], when: ['dawn', 'morning', 'evening'], text: 'A fish jumped clean out of the pond!', tags: ['fish', 'fishing'] },
  { where: ['pond'], when: ['evening', 'night'], text: 'Fireflies are blinking over the water.', tags: ['lights', 'night'] },
  { where: ['tide-pools'], when: ['morning', 'afternoon'], text: 'A little starfish is stuck to a rock in the pool.', tags: ['stars', 'exploring'] },
  { where: ['tall-trees'], when: ['morning', 'afternoon'], text: 'A big colourful bird is watching you from a branch. One bright feather floats down.', tags: ['birds', 'friends'], find: 'bright feather' },
  { where: ['tall-trees', 'banana-grove'], when: ['morning', 'afternoon', 'evening'], text: 'Some vines are hanging just right for swinging.', tags: ['swinging', 'trees'] },
  { where: ['banana-grove'], when: ['morning', 'afternoon'], text: 'One bunch of bananas has gone perfectly yellow.', tags: ['banana', 'food'] },
  { where: ['cave'], when: ['dawn', 'morning', 'afternoon', 'evening', 'night'], text: 'A cool wind is blowing from deeper in the cave.', tags: ['cave', 'wondering'] },
  { where: ['lookout', 'meadow'], when: ['evening'], text: 'The sun is going down and the whole sky is orange and pink.', tags: ['sky', 'sunset'] },
  { where: ['lookout', 'meadow', 'beach'], when: ['night'], weather: ['clear'], text: 'A shooting star just zipped across the sky!', tags: ['shooting star', 'wishes', 'stars'] },
  { where: ['meadow'], when: ['morning', 'afternoon'], weather: ['cloudy'], text: 'One cloud looks exactly like a banana with legs.', tags: ['clouds', 'banana'] },
  { where: null, when: ['dawn'], text: 'The birds are waking up and singing all at once.', tags: ['birds', 'morning'] },
  { where: null, when: ['night'], weather: ['clear', 'cloudy'], text: 'The moon is out. It seems to be following you again.', tags: ['moon'] },
];

// What he notices right now. Returns { text, tags, weather, sheltered, part, finds }.
export function perceive(place, time) {
  const part = dayPart(time), dark = part === 'night', weather = weatherAt(time), lines = [], tags = [];
  const here = SURROUNDINGS[place];
  if (here) { lines.push(dark ? here.night : here.day); tags.push(...here.tags); }
  const sky = WEATHER_WORDS[weather], sheltered = SHELTERED.has(place);
  lines.push(sheltered && weather !== 'clear' ? `Outside, the weather is ${weather}, but you are under cover.` : dark ? sky.night : sky.day);
  tags.push(...sky.tags);
  const coming = nextWeather(time);
  if (coming && ['rain', 'storm'].includes(coming.weather) && !['rain', 'storm'].includes(weather) && coming.at - time < 40 * MINUTE) {
    lines.push('The birds have gone quiet and the air smells like wet dirt.');
    tags.push('weather', 'birds');
  }
  if (['clear', 'cloudy'].includes(weather) && ['rain', 'storm'].includes(weatherAt(time - BLOCK)) && !dark && time % BLOCK < 60 * MINUTE) {
    lines.push('The rain just stopped. There is a rainbow over the island!');
    tags.push('rainbow', 'rain');
  }
  const finds = [...(FINDS[place] || [])];
  const slot = Math.floor(time / SLOT), options = HAPPENINGS.filter(h => (!h.where || h.where.includes(place)) && h.when.includes(part) && (!h.weather || h.weather.includes(weather)));
  if (options.length && hash(slot * 31 + place.length) < 0.55) {
    const happening = options[Math.floor(hash(slot * 17 + 3) * options.length)];
    lines.push(happening.text);
    tags.push(...happening.tags);
    if (happening.find) finds.push(happening.find);
  }
  return { text: lines.join(' '), tags, weather, sheltered, part, finds };
}
