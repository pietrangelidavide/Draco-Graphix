// Screenshot per la presentazione: stato pulito, senza barra demo né toast. Uso: node tools/qa/deckshots.mjs <cartella>
import { chromium } from 'playwright';
const out = process.argv[2] ?? 'shots';
const base = 'http://localhost:8099/';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const CSS = '.demo-bar{display:none!important}.toasts,.toast{display:none!important}';
async function open(w, h, dpr = 2) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, colorScheme: 'light', serviceWorkers: 'block', hasTouch: w < 600 });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const p = await ctx.newPage(); p.setDefaultTimeout(5000);
  return p;
}
const go = async (p, hash) => { await p.goto(base + '#' + hash); await p.addStyleTag({ content: CSS }); await p.waitForTimeout(500); };
const shot = (p, name, clip) => p.screenshot({ path: `${out}/${name}.png`, ...(clip ? { clip } : {}) });
const login = async (p, who) => { await go(p, '/accedi'); await p.getByRole('button', { name: who === 'c' ? 'Entra come cliente' : 'Entra nel gestionale' }).last().click(); await p.waitForTimeout(600); await p.addStyleTag({ content: CSS }); };

// ---- desktop vetrina
const d = await open(1280, 800);
await go(d, '/'); await shot(d, 'd-home');
await go(d, '/catalogo'); await shot(d, 'd-catalogo');
await go(d, '/catalogo'); const href = await d.locator('a[href^="#/prodotto/"]').first().getAttribute('href');
await d.goto(base + href); await d.addStyleTag({ content: CSS }); await d.waitForTimeout(400);
await d.getByLabel('Modello della moto').fill('CRF 450R'); await d.getByLabel('Annata').selectOption({ index: 2 }); await d.getByLabel('Numero pilota').fill('46'); await d.getByLabel('Nome pilota / Tag Instagram').fill('DAVIDE'); await d.waitForTimeout(300);
await shot(d, 'd-prodotto');
await go(d, '/su-misura'); await d.setViewportSize({ width: 1280, height: 900 }); await shot(d, 'd-sumisura');
await d.setViewportSize({ width: 1280, height: 800 });
// ---- cliente
await login(d, 'c');
await go(d, '/account/progetti/pr-1'); await d.setViewportSize({ width: 1280, height: 1000 }); await d.waitForTimeout(300); await shot(d, 'd-progetto');
await d.setViewportSize({ width: 1280, height: 800 });
await go(d, '/account'); await shot(d, 'd-account');
// ---- gestionale
const a = await open(1360, 820);
await login(a, 'a');
await go(a, '/gestionale'); await shot(a, 'a-dashboard');
await go(a, '/gestionale/produzione'); await shot(a, 'a-produzione');
await go(a, '/gestionale/progetti/pr-1'); await shot(a, 'a-progetto');
await go(a, '/gestionale/catalogo'); await shot(a, 'a-catalogo');
await go(a, '/gestionale/preventivi'); await shot(a, 'a-preventivi');
// ---- telefono
const m = await open(390, 844);
await go(m, '/'); await shot(m, 'm-home');
await m.goto(base + href); await m.addStyleTag({ content: CSS }); await m.waitForTimeout(400); await shot(m, 'm-prodotto');
await login(m, 'c'); await go(m, '/account/progetti/pr-1'); await shot(m, 'm-progetto');
await go(m, '/account'); await shot(m, 'm-account');
const ma = await open(390, 844);
await login(ma, 'a'); await go(ma, '/gestionale'); await shot(ma, 'ma-dashboard');
await browser.close();
console.log('fatto');
