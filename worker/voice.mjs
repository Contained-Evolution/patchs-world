// Patch's voice. Each line is recorded once with ElevenLabs and kept, so everyone watching and
// the person he wrote back to hear the same recording and the key isn't used again for it.

import { timingFromAlignment } from '../shared/speech.js';
import { localDate } from './mind.mjs';

const API = 'https://api.elevenlabs.io/v1';
// A bouncy, cartoonish delivery: loose stability lets his excitement through.
export const VOICE_SETTINGS = { stability: .3, similarity_boost: .8, style: .6, use_speaker_boost: true, speed: 1.05 };
// Durable Object values are capped at 2 MB; a 64 kbps line stays well under it.
const MAX_AUDIO = 1_800_000;
// His spoken thoughts stop at this share of the month's characters so letter replies always have room.
const SAYS_SHARE = .6;

export const canSpeak = env => Boolean(env.ELEVENLABS_API_KEY && env.VOICE_ID);

// Characters used this month: { month, chars }.
export function voiceRoom(ledger, env, now, text, kind) {
  const month = localDate(now).slice(0, 7), used = ledger?.month === month ? ledger.chars : 0;
  const cap = Number(env.VOICE_CHARACTERS_A_MONTH) || 0;
  return used + text.length <= cap * (kind === 'reply' ? 1 : SAYS_SHARE);
}

export function countVoice(ledger, now, text) {
  const month = localDate(now).slice(0, 7);
  return { month, chars: (ledger?.month === month ? ledger.chars : 0) + text.length };
}

// Returns { audio: Uint8Array (mp3), timing, ms }.
export async function record(env, text) {
  const response = await fetch(`${API}/text-to-speech/${encodeURIComponent(env.VOICE_ID)}/with-timestamps?output_format=mp3_44100_64`, {
    method: 'POST',
    headers: { 'xi-api-key': env.ELEVENLABS_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ text, model_id: env.VOICE_MODEL || 'eleven_multilingual_v2', voice_settings: VOICE_SETTINGS }),
  });
  if (!response.ok) throw Error(`ElevenLabs ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const result = await response.json();
  const binary = atob(result.audio_base64 || '');
  const audio = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) audio[i] = binary.charCodeAt(i);
  const timing = timingFromAlignment(result.alignment) || timingFromAlignment(result.normalized_alignment);
  if (!audio.length || !timing || audio.length > MAX_AUDIO) throw Error('ElevenLabs returned no usable recording.');
  return { audio, timing, ms: timing.ends.at(-1) + 250 };
}
