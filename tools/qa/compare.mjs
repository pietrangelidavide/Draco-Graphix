// Prova del cursore prima/dopo: mouse, tastiera, tocco, pulsanti, movimento ridotto, testi in anteprima.
//   node tools/qa/compare.mjs [http://localhost:8099/]
import { chromium } from 'playwright-core';
const base = process.argv[2] ?? 'http://localhost:8099/';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' });
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const val = (p) => p.locator('.cmp-knob').first().getAttribute('aria-valuenow').then(Number);
async function open(w, h, extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', ...extra });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const p = await ctx.newPage(); p.setDefaultTimeout(5000);
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(base + '#/'); await p.addStyleTag({ content: '.demo-bar{display:none!important}' });
  return { p, errs, ctx };
}

// --- desktop
{
  const { p, errs } = await open(1280, 900);
  await p.waitForTimeout(2600); // dopo il piccolo avanti-indietro iniziale
  ok(Math.abs((await val(p)) - 50) <= 1, 'parte al centro dopo la dimostrazione (' + (await val(p)) + ')');
  const box = await p.locator('.cmp').first().boundingBox();
  const y = box.y + box.height * 0.5;
  await p.mouse.move(box.x + box.width * 0.5, y); await p.mouse.down();
  await p.mouse.move(box.x + box.width * 0.2, y, { steps: 6 }); await p.mouse.up();
  const v1 = await val(p);
  ok(Math.abs(v1 - (0.2 * 100 + 4) / 1.08) <= 2, 'il trascinamento col mouse sposta il taglio (' + v1 + ')');
  await p.mouse.move(box.x + box.width * 0.9, y); await p.mouse.down(); await p.mouse.move(box.x + box.width + 300, y, { steps: 4 }); await p.mouse.up();
  ok((await val(p)) === 100, 'oltre il bordo si ferma a 100');
  await p.locator('.cmp-knob').first().focus();
  await p.keyboard.press('Home'); ok((await val(p)) === 0, 'Home porta a 0');
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight'); ok((await val(p)) === 8, 'due frecce = +8 (' + (await val(p)) + ')');
  await p.keyboard.press('End'); ok((await val(p)) === 100, 'End porta a 100');
  await p.getByRole('button', { name: 'Con le grafiche' }).first().click(); ok((await val(p)) === 0, 'pulsante "Con le grafiche" mostra solo la grafica');
  await p.getByRole('button', { name: 'Confronto' }).first().click(); ok((await val(p)) === 50, 'pulsante "Confronto" torna al centro');
  // numero e nome nell'anteprima
  await p.locator('#h-num').fill('99'); await p.locator('#h-name').fill('DAVIDE');
  const html = await p.locator('.cmp-after').first().innerHTML();
  ok(html.includes('>99<') && html.includes('DAVIDE'), 'numero e nome compaiono sulla moto con le grafiche');
  const before = await p.locator('.cmp-before').first().innerHTML();
  ok(!before.includes('>99<'), 'la moto originale resta senza numero');
  ok(errs.length === 0, 'nessun errore in pagina ' + errs.join('|'));
}
// --- movimento ridotto: nessuna dimostrazione
{
  const { p } = await open(1280, 900, { reducedMotion: 'reduce' });
  await p.waitForTimeout(400);
  ok((await val(p)) === 50, 'con "riduci movimento" resta fermo a 50');
}
// --- telefono: trascinamento col dito, la pagina scorre in verticale
{
  const { p, ctx } = await open(390, 844, { hasTouch: true, isMobile: true });
  await p.waitForTimeout(2600);
  const box = await p.locator('.cmp').first().boundingBox();
  const cdp = await ctx.newCDPSession(p);
  const y = Math.round(box.y + box.height / 2);
  const t = (type, x, yy) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: Math.round(x), y: Math.round(yy) }] });
  await t('touchStart', box.x + box.width * 0.5, y);
  for (let i = 1; i <= 8; i++) await t('touchMove', box.x + box.width * (0.5 - i * 0.04), y);
  await t('touchEnd');
  const v = await val(p);
  ok(v < 40, 'il dito sposta il taglio a sinistra (' + v + ')');
  const sy0 = await p.evaluate(() => scrollY);
  await t('touchStart', box.x + box.width * 0.5, y + 100);
  for (let i = 1; i <= 8; i++) await t('touchMove', box.x + box.width * 0.5, y + 100 - i * 25);
  await t('touchEnd'); await p.waitForTimeout(300);
  ok((await p.evaluate(() => scrollY)) > sy0, 'un gesto verticale sopra la moto fa scorrere la pagina');
}
await browser.close();
console.log(fails ? `\n${fails} controlli falliti` : '\nTutto a posto');
process.exit(fails ? 1 : 0);
