// Contrasto WCAG delle coppie di colori principali, in tema chiaro e scuro.
import { readFileSync } from 'node:fs';
const css = readFileSync('src/styles/tokens.css', 'utf8');
const block = (re) => Object.fromEntries([...css.match(re)[1].matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));
const light = block(/:root \{([\s\S]*?)\n\}/);
const dark = { ...light, ...block(/:root\[data-theme='dark'\] \{([\s\S]*?)\n\}/) };
const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const pairs = [['ink', 'bg', 4.5], ['ink', 'panel', 4.5], ['muted', 'bg', 4.5], ['muted', 'panel', 4.5], ['muted', 'neutral-bg', 4.5], ['accent-ink', 'bg', 4.5], ['accent-ink', 'panel', 4.5], ['on-accent', 'accent', 4.5], ['ok', 'ok-bg', 4.5], ['warn', 'warn-bg', 4.5], ['bad', 'bad-bg', 4.5], ['info', 'info-bg', 4.5], ['ink', 'neutral-bg', 4.5], ['ok', 'panel', 4.5], ['warn', 'panel', 4.5], ['bad', 'panel', 4.5], ['on-bad', 'bad', 4.5], ['hero-ink', 'hero-bg', 4.5], ['hero-muted', 'hero-bg', 4.5], ['side-ink', 'side-bg', 4.5], ['side-muted', 'side-bg', 4.5], ['bubble-me-ink', 'bubble-me-bg', 4.5], ['accent', 'bg', 3], ['accent', 'hero-bg', 3], ['field-line', 'panel', 3], ['field-line', 'bg', 3]];
let fails = 0;
for (const [name, t] of [['CHIARO', light], ['SCURO', dark]]) {
  console.log('\n' + name);
  for (const [f, b, min] of pairs) {
    const r = ratio(t[f], t[b]); const ok = r >= min; if (!ok) fails++;
    console.log(`${ok ? '  ok ' : ' FAIL'} ${f.padEnd(14)} su ${b.padEnd(11)} ${r.toFixed(2)} (min ${min})`);
  }
}
console.log(fails ? `\n${fails} coppie sotto soglia` : '\ntutte le coppie sopra soglia');
