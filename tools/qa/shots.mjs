// Giro di prova in demo: screenshot + errori console. Uso: node tools/qa/shots.mjs <cartella-output>
import { chromium } from 'playwright';
const out = process.argv[2] ?? 'shots';
const base = 'http://localhost:8099/';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const errors = [];
async function page(w, h, scheme = 'light') {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, serviceWorkers: 'block' });
  const p = await ctx.newPage();
  p.on('console', (m) => m.type() === 'error' && errors.push(`[${w}] ${m.text()}`));
  p.on('pageerror', (e) => errors.push(`[${w}] PAGEERROR ${e.message}`));
  return p;
}
const go = async (p, hash) => { await p.goto(base + '#' + hash); await p.waitForTimeout(500); };
const shot = (p, name, full = true) => p.screenshot({ path: `${out}/${name}.png`, fullPage: full });

const d = await page(1280, 800);
await go(d, '/'); await shot(d, 'd-home');
await go(d, '/catalogo'); await shot(d, 'd-catalogo');
const first = await d.locator('a[href^="#/prodotto/"]').first().getAttribute('href');
await d.goto(base + first); await d.waitForTimeout(500); await shot(d, 'd-prodotto');
await go(d, '/su-misura'); await shot(d, 'd-sumisura');
await go(d, '/accedi'); await shot(d, 'd-accedi');
await browser.close();
console.log(errors.length ? errors.join('\n') : 'nessun errore console');
