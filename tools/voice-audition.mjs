// Auditions voices for Patch with ElevenLabs Voice Design, and keeps the one Chris picks.
// Needs ELEVENLABS_API_KEY in the environment.
//   node tools/voice-audition.mjs <folder>        writes previews and a page to listen to them in <folder>
//   node tools/voice-audition.mjs keep <preview id>   saves that preview as the "Patch" voice and prints its id for VOICE_ID
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const API = 'https://api.elevenlabs.io/v1';
const KEY = process.env.ELEVENLABS_API_KEY;
const MODEL = 'eleven_multilingual_ttv_v2';

const LINE = `Hi friend! Thank you for your letter, it made my tail curl up all happy! Today I found a shiny shell at the tide pools, and I think a crab used to live in it. Dad always says, "Let's find out!" So tomorrow I'm going to go look. Ooh, and I learned a new word: barnacle! Write back soon, okay? Bye-bye!`;

const VOICES = {
  squeaky: 'A high-pitched, squeaky cartoon monkey boy, about five years old, bouncy and excited, a fast talker full of giggly energy, like the star of an animated kids\' show. Clear American accent, studio quality.',
  cheeky: 'A very high, bright and slightly nasal cartoon voice for a cheeky little monkey who is amazed by everything, with silly upward inflections and playful timing. Studio quality.',
  sweet: 'A sweet, curious young cartoon monkey with a small, slightly raspy voice, warm and gentle but full of wonder, talking a little fast like an excited kid in an animated film. Studio quality.',
  goofy: 'A goofy, sing-song cartoon sidekick monkey with a high, rubbery, very expressive voice, friendly and silly, bouncing up and down in pitch. Studio quality.',
};

async function call(paths, body) {
  for (const path of paths) {
    const response = await fetch(API + path, { method: 'POST', headers: { 'xi-api-key': KEY, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (response.status === 404 || response.status === 405) continue;
    if (!response.ok) throw Error(`ElevenLabs ${response.status}: ${await response.text()}`);
    return response.json();
  }
  throw Error('ElevenLabs has no Voice Design endpoint at these paths.');
}

async function audition(folder) {
  await mkdir(folder, { recursive: true });
  const takes = [];
  for (const [name, description] of Object.entries(VOICES)) {
    const result = await call(['/text-to-voice/design', '/text-to-voice/create-previews'], { voice_description: description, model_id: MODEL, text: LINE });
    result.previews.forEach((preview, n) => {
      takes.push({ file: `${name}-${n + 1}.mp3`, name: `${name} ${n + 1}`, id: preview.generated_voice_id, description, audio: preview.audio_base_64 });
    });
    console.log(`${name}: ${result.previews.length} takes`);
  }
  for (const take of takes) await writeFile(join(folder, take.file), Buffer.from(take.audio, 'base64'));
  const rows = takes.map(take => `<section><h2>${take.name}</h2><audio controls preload="none" src="${take.file}"></audio><code>${take.id}</code></section>`).join('\n');
  await writeFile(join(folder, 'index.html'), `<!doctype html><meta charset="utf-8"><title>Patch voice audition</title>
<style>body{font:16px/1.4 system-ui;max-width:720px;margin:24px auto;padding:0 16px}section{margin:16px 0}audio{width:100%}code{font-size:12px;color:#555}</style>
<h1>Patch voice audition</h1><p>${LINE}</p>${rows}`);
  await writeFile(join(folder, 'takes.json'), JSON.stringify(takes.map(({ audio, ...take }) => take), null, 2));
  console.log(`Listen: ${resolve(folder, 'index.html')}`);
}

async function keep(id) {
  const voice = await call(['/text-to-voice', '/text-to-voice/create-voice-from-preview'], {
    voice_name: 'Patch', voice_description: 'Patch, the cartoon monkey who lives on Patch\'s World island.', generated_voice_id: id,
  });
  console.log(voice.voice_id);
}

if (!KEY) { console.error('Set ELEVENLABS_API_KEY first.'); process.exit(1); }
const [first, second] = process.argv.slice(2);
if (first === 'keep' && second) await keep(second);
else if (first) await audition(first);
else console.error('Usage: node tools/voice-audition.mjs <folder> | keep <preview id>');
