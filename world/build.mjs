import { build } from 'esbuild';
import { mkdir, copyFile, cp, rm } from 'node:fs/promises';
await rm('dist', {recursive:true,force:true});
await mkdir('dist', { recursive: true });
await build({ entryPoints: ['src/main.js'], bundle: true, format: 'esm', minify: true, outfile: 'dist/main.js', sourcemap: true });
for (const name of ['index.html', 'style.css', 'Pangolin-Regular.ttf']) await copyFile(name, `dist/${name}`);
await cp('assets', 'dist/assets', { recursive: true });
