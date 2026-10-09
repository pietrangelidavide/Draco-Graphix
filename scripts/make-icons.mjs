// Genera le icone PNG (apple-touch 180, PWA 192/512, maschera 512) da public/favicon.svg.
//   node scripts/make-icons.mjs        (serve Chromium: PLAYWRIGHT_BROWSERS_PATH o CHROMIUM_PATH)
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(join(root, 'public/favicon.svg'), 'utf8');
const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/<circle[^>]*\/>/, '');
const BG = '#0a0a0b';

const page = (size, { bleed, scale }) => `<!doctype html><meta charset="utf8"><style>html,body{margin:0;background:${bleed ? BG : 'transparent'}}svg{display:block}</style>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  ${bleed ? '' : `<rect width="64" height="64" rx="14" fill="${BG}"/>`}
  <g transform="translate(${32 - 32 * scale} ${32 - 32 * scale}) scale(${scale})">${inner}</g>
</svg>`;

const jobs = [
  ['icon-180.png', 180, { bleed: true, scale: 0.84 }],
  ['icon-192.png', 192, { bleed: false, scale: 1 }],
  ['icon-512.png', 512, { bleed: false, scale: 1 }],
  ['icon-maskable-512.png', 512, { bleed: true, scale: 0.7 }],
];

const executablePath = process.env.CHROMIUM_PATH || (process.env.PLAYWRIGHT_BROWSERS_PATH ? join(process.env.PLAYWRIGHT_BROWSERS_PATH, 'chromium') : undefined);
const browser = await chromium.launch(executablePath ? { executablePath } : {});
for (const [name, size, opt] of jobs) {
  const p = await browser.newPage({ viewport: { width: size, height: size } });
  await p.setContent(page(size, opt));
  writeFileSync(join(root, 'public', name), await p.screenshot({ omitBackground: !opt.bleed, clip: { x: 0, y: 0, width: size, height: size } }));
  await p.close();
  console.log('scritta', name);
}
await browser.close();
