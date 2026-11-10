/**
 * fix-admin-theme.mjs
 * Run: node scripts/fix-admin-theme.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();

const TARGETS = [
  'src/app/admin/tenants/tenants-client.tsx',
  'src/app/admin/tenants/[id]/tenant-detail-client.tsx',
  'src/app/admin/plans/plans-client.tsx',
  'src/app/admin/overview-client.tsx',
];

// Structural replacements (safe — always apply)
const STRUCTURAL = [
  [/\bbg-slate-900\b(?!\/)/g, 'adm-card-bg'],
  [/\bbg-slate-950\b(?!\/)/g, 'adm-surface-bg'],
  [/\bbg-slate-800\b(?!\/)/g, 'adm-hover-bg'],
  [/\bborder-slate-800\b(?!\/)/g, 'adm-divider'],
  [/\bborder-slate-700\b/g,    'adm-divider'],
  [/\btext-slate-200\b/g, 'adm-text-secondary'],
  [/\btext-slate-300\b/g, 'adm-text-secondary'],
  [/\btext-slate-400\b/g, 'adm-text-muted'],
  [/\btext-slate-500\b/g, 'adm-text-muted'],
  [/\btext-slate-600\b/g, 'adm-text-faint'],
  [/\bplaceholder-slate-\d00\b/g, ''],
];

// Coloured backgrounds — text-white is intentional here
const COLOURED = /bg-(?:indigo|rose|blue|red|emerald|amber|sky|cyan|violet|green|orange|teal|purple|fuchsia|pink|lime|yellow)-\d{3}|bg-gradient/;

function fixTextWhite(src) {
  // Replace text-white in JSX className strings that don't have a coloured bg
  return src.replace(/className=["']([^"']+)["']/g, (match, classes) => {
    if (!classes.includes('text-white')) return match;
    if (COLOURED.test(classes)) return match;      // intentional: on coloured btn
    if (classes.includes('${')) return match;       // template literal – skip
    return match.replace(/\btext-white\b/g, 'adm-text-primary');
  });
}

for (const rel of TARGETS) {
  const full = join(ROOT, rel.replace(/\//g, '\\'));
  let src;
  try { src = readFileSync(full, 'utf8'); } catch { console.warn('SKIP:', rel); continue; }

  let out = src;
  for (const [pat, rep] of STRUCTURAL) out = out.replace(pat, rep);
  out = fixTextWhite(out);
  out = out.replace(/ {2,}/g, ' ');   // tidy double spaces

  if (out !== src) { writeFileSync(full, out, 'utf8'); console.log('Fixed:', rel); }
  else console.log('No change:', rel);
}
console.log('Done.');
