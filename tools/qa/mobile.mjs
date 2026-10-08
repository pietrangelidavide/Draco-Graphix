// Telefono (390px) e tema scuro. Uso: node tools/qa/mobile.mjs <cartella>
import { chromium } from 'playwright';
const out = process.argv[2] ?? 'shots';
const base = 'http://localhost:8099/';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const errors = [];
const notes = [];
async function open(w, h, scheme = 'light') {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, serviceWorkers: 'block', deviceScaleFactor: 1, hasTouch: w < 600 });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const p = await ctx.newPage(); p.setDefaultTimeout(4000);
  p.on('pageerror', (e) => errors.push(`[${w}] PAGEERROR ${e.message}`));
  return p;
}
const go = async (p, hash) => { await p.goto(base + '#' + hash); await p.waitForTimeout(450); };
const overflow = async (p, name) => {
  const w = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  if (w.sw > w.cw + 1) {
    const culprit = await p.evaluate(() => { const cw = document.documentElement.clientWidth; return [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > cw + 1).slice(0, 4).map((e) => e.tagName + '.' + e.className + ' ' + Math.round(e.getBoundingClientRect().right)); });
    notes.push(`OVERFLOW ${name}: scrollWidth ${w.sw} > ${w.cw}  ${culprit.join(' | ')}`);
  }
};
const shot = async (p, name) => { await overflow(p, name); await p.screenshot({ path: `${out}/${name}.png`, fullPage: true }); };

const m = await open(390, 800);
for (const [h, n] of [['/', 'm1-home'], ['/catalogo', 'm2-catalogo'], ['/su-misura', 'm4-sumisura'], ['/carrello', 'm5-carrello'], ['/accedi', 'm6-accedi'], ['/team', 'm7-team']]) await go(m, h).then(() => shot(m, n));
await go(m, '/catalogo'); const href = await m.locator('a[href^="#/prodotto/"]').first().getAttribute('href'); await m.goto(base + href); await m.waitForTimeout(400); await shot(m, 'm3-prodotto');
await m.getByLabel('Modello della moto').fill('CRF 450R'); await m.getByLabel('Annata').selectOption({ index: 2 }); await m.getByRole('button', { name: 'Aggiungi al carrello' }).click(); await m.waitForTimeout(300);
await go(m, '/carrello'); await shot(m, 'm5b-carrello-pieno');
await go(m, '/accedi'); await m.getByRole('button', { name: 'Entra come cliente' }).click(); await m.waitForTimeout(600);
for (const [h, n] of [['/account', 'm8-account'], ['/account/progetti/pr-1', 'm9-progetto'], ['/account/ordini', 'm10-ordini'], ['/checkout', 'm11-checkout']]) await go(m, h).then(() => shot(m, n));
await m.locator('.menu-btn').first().click().catch(() => {}); await m.waitForTimeout(300); await m.screenshot({ path: `${out}/m12-menu-aperto.png` });

const ma = await open(390, 800);
await go(ma, '/accedi'); await ma.getByRole('button', { name: 'Entra nel gestionale' }).last().click(); await ma.waitForTimeout(600);
for (const [h, n] of [['/gestionale', 'ma1-dashboard'], ['/gestionale/ordini', 'ma2-ordini'], ['/gestionale/produzione', 'ma3-produzione'], ['/gestionale/progetti/pr-1', 'ma4-progetto'], ['/gestionale/catalogo', 'ma5-catalogo'], ['/gestionale/impostazioni', 'ma6-impostazioni']]) await go(ma, h).then(() => shot(ma, n));
await ma.locator('.admin-top .menu-btn').click().catch(() => {}); await ma.waitForTimeout(300); await ma.screenshot({ path: `${out}/ma7-menu.png` });

const dk = await open(1280, 800, 'dark');
for (const [h, n] of [['/', 'k1-home'], ['/prodotto/' + href.split('/').pop(), 'k2-prodotto'], ['/su-misura', 'k3-sumisura']]) await go(dk, h).then(() => shot(dk, n));
await go(dk, '/accedi'); await dk.getByRole('button', { name: 'Entra come cliente' }).click(); await dk.waitForTimeout(600);
await go(dk, '/account/progetti/pr-1'); await shot(dk, 'k4-progetto');
await go(dk, '/accedi'); await dk.getByRole('button', { name: 'Entra nel gestionale' }).last().click(); await dk.waitForTimeout(600);
for (const [h, n] of [['/gestionale', 'k5-dash'], ['/gestionale/produzione', 'k6-produzione'], ['/gestionale/ordini', 'k7-ordini']]) await go(dk, h).then(() => shot(dk, n));
await browser.close();
console.log(notes.join('\n') || 'nessun overflow orizzontale');
console.log(errors.length ? errors.join('\n') : 'nessun errore pagina');
