// Build the world if it exists, then make sure the asset folder carries the Pangolin font.
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { copyFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const world = resolve(root, 'world');
if (existsSync(resolve(world, 'package.json'))) execSync('npm run build', { cwd: world, stdio: 'inherit' });
const assets = resolve(world, 'dist/assets');
await mkdir(assets, { recursive: true });
await copyFile(resolve(root, 'shared/fonts/Pangolin-Regular.ttf'), resolve(assets, 'Pangolin-Regular.ttf'));
await copyFile(resolve(root, 'shared/fonts/OFL.txt'), resolve(assets, 'Pangolin-OFL.txt'));
