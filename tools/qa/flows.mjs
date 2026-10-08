// Flussi completi in modalità demo. Uso: node tools/qa/flows.mjs <cartella-output>
import { chromium } from 'playwright';
const out = process.argv[2] ?? 'shots';
const base = 'http://localhost:8099/';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const errors = [];
const notes = [];
async function open(w, h, scheme = 'light') {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, serviceWorkers: 'block' });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const p = await ctx.newPage(); p.setDefaultTimeout(4000);
  p.on('console', (m) => m.type() === 'error' && errors.push(`[${w}] ${m.text()}`));
  p.on('pageerror', (e) => errors.push(`[${w}] PAGEERROR ${e.message}`));
  return p;
}
const go = async (p, hash) => { await p.goto(base + '#' + hash); await p.waitForTimeout(450); };
const shot = (p, name) => p.screenshot({ path: `${out}/${name}.png`, fullPage: true });
const step = async (name, fn) => { try { await fn(); notes.push('ok   ' + name); } catch (e) { notes.push('FAIL ' + name + ' — ' + String(e.message).split('\n')[0]); } };

// ---------- cliente: ordine ----------
const c = await open(1280, 800);
await step('prodotto → carrello', async () => {
  await go(c, '/catalogo');
  const href = await c.locator('a[href^="#/prodotto/"]').nth(1).getAttribute('href');
  await c.goto(base + href); await c.waitForTimeout(400);
  await c.getByLabel('Modello della moto').fill('CRF 450R');
  await c.getByLabel('Annata').selectOption({ index: 2 });
  await c.getByLabel('Numero pilota').fill('27');
  await c.getByRole('button', { name: 'Aggiungi al carrello' }).click();
  await c.waitForTimeout(300);
  await shot(c, 'c1-aggiunto');
});
await step('carrello', async () => { await go(c, '/carrello'); await shot(c, 'c2-carrello'); });
await step('checkout richiede accesso', async () => {
  await c.getByRole('button', { name: 'Vai al pagamento' }).click();
  await c.waitForTimeout(500);
  notes.push('     url dopo "Vai al pagamento": ' + c.url().split('#')[1]);
  await shot(c, 'c3-checkout-o-login');
});
await step('login demo cliente', async () => {
  if (c.url().includes('/accedi')) { await c.getByRole('button', { name: 'Entra come cliente' }).click(); await c.waitForTimeout(600); notes.push('     dopo login: ' + c.url().split('#')[1]); }
});
await step('checkout compilato', async () => {
  if (!c.url().includes('/checkout')) await go(c, '/checkout');
  await shot(c, 'c4-checkout');
  await c.getByLabel('Telefono per il corriere').fill('3331234567').catch(() => {}); await c.getByLabel(/Ho letto/).check();
  await c.getByRole('button', { name: /Conferma l’ordine/ }).first().click();
  await c.waitForTimeout(700);
  notes.push('     dopo ordine: ' + c.url().split('#')[1]);
  await shot(c, 'c5-ordine-fatto');
});
await step('area cliente', async () => { await go(c, '/account'); await shot(c, 'c6-account'); });
await step('ordini', async () => { await go(c, '/account/ordini'); await shot(c, 'c7-ordini'); });
await step('progetti lista', async () => { await go(c, '/account/progetti'); await shot(c, 'c8-progetti'); });
await step('stanza progetto: bozza', async () => {
  const links = c.locator('a[href^="#/account/progetti/"]');
  const n = await links.count();
  for (let i = 0; i < n; i++) {
    const t = (await links.nth(i).innerText()).toLowerCase();
    if (t.includes('bozza')) { await links.nth(i).click(); break; }
  }
  await c.waitForTimeout(500);
  notes.push('     progetto: ' + c.url().split('#')[1]);
  await shot(c, 'c9-progetto-bozza');
});
await step('approva bozza', async () => {
  await c.getByRole('button', { name: /Approva/ }).first().click();
  await c.waitForTimeout(500);
  await shot(c, 'c10-dopo-approva');
});
await step('preventivi/garage/profilo/preferiti', async () => {
  for (const [h, n] of [['/account/preventivi', 'c11-preventivi'], ['/account/garage', 'c12-garage'], ['/account/preferiti', 'c13-preferiti'], ['/account/profilo', 'c14-profilo']]) { await go(c, h); await shot(c, n); }
});
await step('su misura inviato da loggato', async () => {
  await go(c, '/su-misura');
  await c.getByLabel('Marca').selectOption({ index: 1 });
  await c.getByLabel('Modello').fill('EXC 300');
  await c.getByLabel('Annata').selectOption({ index: 2 });
  await c.getByLabel('Descrivi lo stile').fill('Aggressiva, linee diagonali, numero grande.');
  await c.getByLabel(/Accetto/).check();
  await shot(c, 'c15-sumisura-compilata');
  await c.getByRole('button', { name: /Invia il brief|Versa|Paga|Conferma/ }).first().click();
  await c.waitForTimeout(700);
  notes.push('     dopo brief: ' + c.url().split('#')[1]);
  await shot(c, 'c16-sumisura-inviata');
});
await step('team: preventivo', async () => { await go(c, '/team'); await shot(c, 'c17-team'); await go(c, '/contatti'); await shot(c, 'c18-contatti'); });

// ---------- gestionale ----------
const a = await open(1360, 820);
await step('login titolare', async () => { await go(a, '/accedi'); await a.getByRole('button', { name: 'Entra nel gestionale' }).last().click(); await a.waitForTimeout(700); notes.push('     dopo login: ' + a.url().split('#')[1]); await shot(a, 'a1-dashboard'); });
for (const [h, n] of [['/gestionale/ordini', 'a2-ordini'], ['/gestionale/produzione', 'a3-produzione'], ['/gestionale/progetti', 'a4-progetti'], ['/gestionale/preventivi', 'a5-preventivi'], ['/gestionale/catalogo', 'a6-catalogo'], ['/gestionale/clienti', 'a7-clienti'], ['/gestionale/contatti', 'a8-contatti'], ['/gestionale/impostazioni', 'a9-impostazioni']]) {
  await step(n, async () => { await go(a, h); await shot(a, n); });
}
await step('dettaglio ordine', async () => { await go(a, '/gestionale/ordini'); await a.locator('a[href^="#/gestionale/ordini/"]').first().click(); await a.waitForTimeout(500); await shot(a, 'a10-ordine'); });
await step('dettaglio progetto', async () => { await go(a, '/gestionale/progetti'); await a.locator('a[href^="#/gestionale/progetti/"]').first().click(); await a.waitForTimeout(500); await shot(a, 'a11-progetto'); });
await step('dettaglio preventivo', async () => { await go(a, '/gestionale/preventivi'); await a.locator('a[href^="#/gestionale/preventivi/"]').first().click(); await a.waitForTimeout(500); await shot(a, 'a12-preventivo'); });
await step('editor prodotto', async () => { await go(a, '/gestionale/catalogo'); await a.locator('a[href^="#/gestionale/catalogo/"]').first().click(); await a.waitForTimeout(500); await shot(a, 'a13-prodotto'); });
await step('dettaglio cliente', async () => { await go(a, '/gestionale/clienti'); await a.locator('a[href^="#/gestionale/clienti/"]').first().click(); await a.waitForTimeout(500); await shot(a, 'a14-cliente'); });

await browser.close();
console.log(notes.join('\n'));
console.log(errors.length ? '\nERRORI CONSOLE:\n' + [...new Set(errors)].join('\n') : '\nnessun errore console');
