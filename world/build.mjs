import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { join, relative, sep } from 'node:path';
import { mkdir, copyFile, cp, rm, readdir, readFile, writeFile } from 'node:fs/promises';
await rm('dist', {recursive:true,force:true});
await mkdir('dist', { recursive: true });
await build({ entryPoints: ['src/main.js'], bundle: true, format: 'esm', minify: true, outfile: 'dist/main.js', sourcemap: true });
await build({ entryPoints: ['src/community-page.js'], bundle: true, format: 'esm', outfile: 'dist/community-page.js' });
await build({ entryPoints: ['src/memory-galaxy.js'], bundle: true, format: 'esm', minify: true, outfile: 'dist/memory-galaxy.js' });
await build({ entryPoints: ['src/valley/world-setup.js'], bundle: true, format: 'esm', minify: true, outfile: 'dist/valley.js' });
for (const name of ['valley.html', 'valley.css', 'journal.html', 'journal.js', 'social-inbox.js', 'gifts.html', 'gifts.js', 'visits.css', 'memory.html', 'memory.css', 'index.html', 'community.html', 'community.css', 'style.css', 'Pangolin-Regular.ttf', 'manifest.webmanifest']) await copyFile(name, `dist/${name}`);
let socialReview = await readFile('journal.html', 'utf8');
for (const filename of ['journal.js', 'social-inbox.js', 'visits.css']) {
  const content = await readFile(filename);
  const hash = createHash('sha256').update(content).digest('hex').slice(0, 12);
  const versioned = 'social-' + hash + '-' + filename;
  await writeFile('dist/' + versioned, content);
  socialReview = socialReview.replace('./' + filename, './' + versioned);
}
await writeFile('dist/social-review.html', socialReview);
await writeFile('dist/tablet.html', socialReview);
const islandScript = await readFile('dist/main.js');
const captureScript = 'camera-' + createHash('sha256').update(islandScript).digest('hex').slice(0, 12) + '.js';
await writeFile('dist/' + captureScript, islandScript);
await writeFile('dist/social-camera.html', (await readFile('index.html', 'utf8')).replace('./main.js', './' + captureScript));
await cp('assets', 'dist/assets', { recursive: true });
await cp('icons', 'dist/icons', { recursive: true });
// The service worker caches every built file except source maps, keyed by content so a deploy only re-downloads what changed.
const files = {};
for (const entry of (await readdir('dist', { recursive: true, withFileTypes: true })).filter(item => item.isFile() && !item.name.endsWith('.map'))) {
  const path = relative('dist', join(entry.parentPath, entry.name)).split(sep).join('/');
  files[path] = createHash('sha256').update(await readFile(`dist/${path}`)).digest('hex').slice(0, 16);
}
const version = createHash('sha256').update(JSON.stringify(Object.entries(files).sort())).digest('hex').slice(0, 12);
await writeFile('dist/sw.js', (await readFile('sw.js', 'utf8')).replace('__VERSION__', version).replace('__FILES__', JSON.stringify(files)));
