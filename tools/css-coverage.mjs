// Confronta le classi usate nei TSX con quelle definite nei CSS.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const css = walk('src/styles').filter((f) => f.endsWith('.css')).map((f) => readFileSync(f, 'utf8')).join('\n');
const defined = new Set([...css.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map((m) => m[1]));
const used = new Map();
for (const f of walk('src').filter((f) => /\.tsx?$/.test(f))) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/class(?:Name)?=(?:"([^"]*)"|\{`([^`]*)`\}|\{'([^']*)'\})/g)) {
    const s = (m[1] ?? m[2] ?? m[3]).replace(/\$\{[^}]*\}/g, ' ');
    for (const c of s.split(/\s+/).filter(Boolean)) if (/^[a-z][\w-]*$/i.test(c)) used.set(c, (used.get(c) ?? new Set()).add(f.replace('src/', '')));
  }
  // stringhe in espressioni condizionali dentro className={...}
  for (const m of src.matchAll(/className=\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g)) {
    for (const s of m[1].matchAll(/'([a-z][\w -]*)'|"([a-z][\w -]*)"/g)) for (const c of (s[1] ?? s[2]).split(/\s+/).filter(Boolean)) used.set(c, (used.get(c) ?? new Set()).add(f.replace('src/', '')));
  }
}
const missing = [...used].filter(([c]) => !defined.has(c));
for (const [c, files] of missing) console.log(c.padEnd(26), [...files].join(', '));
console.log(`\nusate ${used.size}, mancanti ${missing.length}`);
