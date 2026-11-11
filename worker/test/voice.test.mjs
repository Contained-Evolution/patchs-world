import test from 'node:test';
import assert from 'node:assert/strict';
import { canSpeak, voiceRoom, countVoice, record, VOICE_SETTINGS } from '../voice.mjs';
import { schedule, speechView, estimateMs, SPEECH_LEAD } from '../../shared/speech.js';

const NOW = Date.UTC(2026, 10, 11, 17);
const env = { ELEVENLABS_API_KEY: 'key', VOICE_ID: 'patch', VOICE_CHARACTERS_A_MONTH: '1000' };

test('voice: needs a key and a chosen voice', () => {
  assert.equal(canSpeak(env), true);
  assert.equal(canSpeak({ ELEVENLABS_API_KEY: 'key' }), false);
});

test('voice: spoken thoughts stop before the month runs out so replies still get recorded', () => {
  const ledger = countVoice(null, NOW, 'x'.repeat(590));
  assert.equal(voiceRoom(ledger, env, NOW, 'y'.repeat(20), 'says'), false);
  assert.equal(voiceRoom(ledger, env, NOW, 'y'.repeat(20), 'reply'), true);
  assert.equal(voiceRoom(ledger, env, NOW, 'y'.repeat(500), 'reply'), false);
  assert.equal(voiceRoom({ month: '2026-10', chars: 1000 }, env, NOW, 'hi', 'says'), true, 'a new month starts over');
  assert.equal(voiceRoom(null, { ...env, VOICE_CHARACTERS_A_MONTH: undefined }, NOW, 'hi', 'reply'), false);
});

test('voice: records with timestamps and keeps the character timing', async () => {
  let sent;
  globalThis.fetch = async (url, init) => {
    sent = { url, init };
    return Response.json({
      audio_base64: btoa('ID3fake'),
      alignment: { characters: ['H', 'i', '!'], character_start_times_seconds: [0, .1, .25], character_end_times_seconds: [.1, .25, .4] },
    });
  };
  const clip = await record(env, 'Hi!');
  assert.match(sent.url, /text-to-speech\/patch\/with-timestamps\?output_format=mp3_44100_64$/);
  assert.equal(sent.init.headers['xi-api-key'], 'key');
  assert.deepEqual(JSON.parse(sent.init.body).voice_settings, VOICE_SETTINGS);
  assert.equal(new TextDecoder().decode(clip.audio), 'ID3fake');
  assert.deepEqual(clip.timing, { chars: 'Hi!', starts: [0, 100, 250], ends: [100, 250, 400] });
  assert.equal(clip.ms, 650);
  globalThis.fetch = async () => new Response('quota', { status: 401 });
  await assert.rejects(record(env, 'Hi!'), /ElevenLabs 401/);
});

test('speech: lines play one after another, announced ahead so everyone hears the start', () => {
  const queue = schedule([], [{ text: 'Ooh!', ms: 1000, voice: 'a' }, { text: 'Dear friend', ms: 3000, voice: 'b' }], NOW);
  assert.equal(queue[0].at, NOW + SPEECH_LEAD);
  assert.equal(queue[1].at, queue[0].at + 1000 + 900);
  assert.equal(speechView(queue, NOW).voice, 'a');
  assert.equal(speechView(queue, NOW + SPEECH_LEAD + 1500).text, 'Dear friend');
  assert.equal(speechView(queue, queue[1].at + 3000), null);
  const later = schedule(queue, [{ text: 'More', ms: 500 }], NOW + 1000);
  assert.equal(later.at(-1).at, queue[1].at + 3000 + 900, 'a new line waits for the one being read');
  assert.equal(schedule(queue, [], queue[1].at + 3001).length, 0, 'finished lines are dropped');
  assert.ok(estimateMs('Hi') >= 2000 && estimateMs('x'.repeat(1200)) <= 90000);
});
