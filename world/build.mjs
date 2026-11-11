import { build } from 'esbuild';
import { mkdir, copyFile, cp, rm } from 'node:fs/promises';
await rm('dist', {recursive:true,force:true});
await mkdir('dist', { recursive: true });
await build({ entryPoints: ['src/main.js'], bundle: true, format: 'esm', minify: true, outfile: 'dist/main.js', sourcemap: true });
await build({ entryPoints: ['src/community-page.js'], bundle: true, format: 'esm', outfile: 'dist/community-page.js' });
await build({ entryPoints: ['src/memory-galaxy.js'], bundle: true, format: 'esm', minify: true, outfile: 'dist/memory-galaxy.js' });
for (const name of ['memory.html', 'memory.css', 'index.html', 'community.html', 'community.css', 'style.css', 'Pangolin-Regular.ttf']) await copyFile(name, `dist/${name}`);
await cp('assets', 'dist/assets', { recursive: true });
