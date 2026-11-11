import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { weatherAt, nextWeather, perceive, dayPart } from '../senses.mjs';
import { lightUp } from '../memory-graph.mjs';
import { nextWake } from '../mind.mjs';
import { newBody, view } from '../body.mjs';

const HOUR = 3600000, start = Date.UTC(2026, 5, 1, 4);
const childhood = JSON.parse(readFileSync(new URL('../seed/childhood.json', import.meta.url)));

test('weather is shared, holds for spells, and is mostly fair with some rain and rare storms', () => {
  const count = { clear: 0, cloudy: 0, rain: 0, storm: 0 };
  for (let t = start; t < start + 60 * 24 * HOUR; t += 3 * HOUR) count[weatherAt(t)]++;
  assert.ok(count.clear > count.rain && count.rain > count.storm && count.storm > 0, JSON.stringify(count));
  assert.equal(weatherAt(start + HOUR), weatherAt(start + HOUR));
  assert.equal(weatherAt(start + 10 * 60000), weatherAt(start + 2 * HOUR));
  assert.equal(view(newBody(start, 1), start).clock.weather, weatherAt(start));
});

test('he notices his place, the time of day and the weather, and stays dry in the cave', () => {
  let stormy = start; while (weatherAt(stormy) !== 'storm') stormy += 3 * HOUR;
  const outside = perceive('beach', stormy), inside = perceive('cave', stormy);
  assert.ok(outside.tags.includes('storm'));
  assert.match(inside.text, /under cover/);
  assert.equal(dayPart(Date.UTC(2026, 5, 1, 2)), 'night');
  assert.equal(dayPart(Date.UTC(2026, 5, 1, 14)), 'morning');
});

test('a storm lights up his memory of the thunder storm with Mom', () => {
  const lit = lightUp(childhood, ['storm', 'thunder', 'rain'], {}, start, 3).memories.map(entry => entry.memory.id);
  assert.ok(lit.includes('feel-storm'), lit.join(','));
});

test('the birds go quiet before rain, and incoming rain wakes him', () => {
  let t = start; while (!(nextWeather(t) && ['rain', 'storm'].includes(nextWeather(t).weather) && !['rain', 'storm'].includes(weatherAt(t)))) t += 3 * HOUR;
  const turn = nextWeather(t);
  assert.match(perceive('meadow', turn.at - 20 * 60000).text, /birds have gone quiet/);
  const body = newBody(t, 2);
  body.activity = { ...body.activity, action: 'sit', place: 'meadow', target: null, start: turn.at - 30 * 60000, end: turn.at + 2 * HOUR };
  body.needs = { hunger: 0.8, energy: 0.8, fun: 0.8, comfort: 0.8, social: 0.8 };
  assert.equal(nextWake(body, turn.at - 30 * 60000), turn.at + 60000);
});
