import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { join, relative, sep } from 'node:path';
import { mkdir, copyFile, cp, rm, readdir, readFile, writeFile } from 'node:fs/promises';
await rm('dist', {recursive:true,force:true});
await mkdir('dist', { recursive: true });
await build({ entryPoints: ['src/main.js'], bundle: true, format: 'esm', minify: true, outfile: 'dist/main.js', sourcemap: true });
await build({ entryPoints: ['src/community-page.js'], bundle: true, format: 'esm', outfile: 'dist/community-page.js' });
await build({ entryPoints: ['src/memory-galaxy.js'], bundle: true, format: 'esm', minify: true, outfile: 'dist/memory-galaxy.js' });
for (const name of ['memory.html', 'memory.css', 'index.html', 'community.html', 'community.css', 'style.css', 'Pangolin-Regular.ttf', 'manifest.webmanifest']) await copyFile(name, `dist/${name}`);
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
