// Rigenera resources/manifest.json elencando gli SVG nelle cartelle di resources/.
// Uso: node scripts/build-manifest.mjs   (nessuna dipendenza)
import { readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'resources');
const list = dir => {
  try { return readdirSync(join(root, dir)).filter(f => f.toLowerCase().endsWith('.svg')).sort((a, b) => a.localeCompare(b, 'it')); }
  catch { return []; }
};
const manifest = { figure: list('figure'), ornamenti: list('ornamenti') };
writeFileSync(join(root, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`manifest.json: ${manifest.figure.length} figure, ${manifest.ornamenti.length} ornamenti`);
