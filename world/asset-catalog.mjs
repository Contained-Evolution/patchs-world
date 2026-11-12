import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const extensions = /\.(glb|png|jpe?g|webp|avif|ktx2)$/i;

export async function writeAssetCatalog(procedural, definitions = {}) {
  const entries = await readdir('assets', { recursive: true, withFileTypes: true });
  const files = [];
  for (const entry of entries.filter(entry => entry.isFile() && extensions.test(entry.name))) {
    const filename = join(entry.parentPath, entry.name);
    const path = relative('assets', filename).split(sep).join('/');
    const digest = createHash('sha256').update(await readFile(filename)).digest('hex');
    files.push({ path, digest, kind: /\.glb$/i.test(path) ? 'Model' : 'Texture' });
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  await writeFile('dist/asset-catalog.json', JSON.stringify({ files, procedural, definitions }));
}
