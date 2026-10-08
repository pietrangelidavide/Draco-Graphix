import { test } from 'node:test';
import assert from 'node:assert/strict';
import { basePrice, priceLine, resolveLines, shippingFor, totals, isValidYear } from '../src/lib/pricing';
import { catalogSeed, settingsSeed } from '../src/lib/seed';
import { eur, parseEuro, vatIncluded } from '../src/lib/money';

const catalog = catalogSeed();
const bySlug = (s: string) => catalog.find((p) => p.slug === s)!;
const kitSel = { modello: 'CRF 450R', annata: '2022', base: 'classica', laminazione: 'lucido' };

test('lo sconto del 12% porta le forcelle da 50 a 44 euro', () => {
  assert.equal(basePrice(bySlug('adesivi-forcella-mrz')), 4400);
});

test('il kit Race 1 con cromo e glitter costa 149 + 139 + 49', () => {
  const p = priceLine(bySlug('honda-crf-race1'), { ...kitSel, base: 'cromo', laminazione: 'glitter' });
  assert.deepEqual(p.errors, {});
  assert.equal(p.unit_price_cents, 14900 + 13900 + 4900);
});

test('olografico + opaco: 149 + 149 + 10', () => {
  assert.equal(priceLine(bySlug('honda-crf-race1'), { ...kitSel, base: 'olografico', laminazione: 'opaco' }).unit_price_cents, 14900 + 14900 + 1000);
});

test('i campi obbligatori vengono segnalati', () => {
  const p = priceLine(bySlug('honda-crf-race1'), { base: 'classica' });
  assert.ok(p.errors.modello && p.errors.annata && p.errors.laminazione);
});

test('scelte e testi non validi vengono respinti', () => {
  const p = priceLine(bySlug('honda-crf-race1'), { ...kitSel, base: 'oro', numero_pilota: '12345' });
  assert.ok(p.errors.base);
  assert.ok(p.errors.numero_pilota);
});

test('annate valide', () => {
  assert.ok(isValidYear('2022') && isValidYear('precedente'));
  assert.ok(!isValidYear('1850') && !isValidYear('abc') && !isValidYear('22'));
});

test('spedizione: fissa, gratis sopra soglia, zero se vuoto', () => {
  const s = settingsSeed();
  assert.equal(shippingFor(14900, s), 900);
  assert.equal(shippingFor(0, s), 0);
  assert.equal(shippingFor(30000, { ...s, shipping_free_over_cents: 20000 }), 0);
  assert.deepEqual(totals([{ unit_price_cents: 14900, qty: 2 }], s), { subtotal_cents: 29800, shipping_cents: 900, total_cents: 30700 });
});

test('il carrello rifiuta prodotti non pubblicati o configurazioni invalide', () => {
  assert.throws(() => resolveLines([], catalog), /vuoto/);
  assert.throws(() => resolveLines([{ product_id: 'p-maglietta-esempio', qty: 1, selections: { taglia: 'M' } }], catalog), /non disponibile/);
  assert.throws(() => resolveLines([{ product_id: 'p-honda-crf-race1', qty: 1, selections: {} }], catalog), /obbligatorio/);
  const ok = resolveLines([{ product_id: 'p-honda-crf-race1', qty: 99, selections: kitSel }], catalog);
  assert.equal(ok[0]!.qty, 20);
});

test('formati di importo', () => {
  assert.equal(eur(14900), '149,00\u00a0€');
  assert.equal(parseEuro('149,5'), 14950);
  assert.equal(parseEuro('1.250,00'), 125000);
  assert.equal(parseEuro('abc'), null);
  assert.equal(vatIncluded(12200, 22), 2200);
});

test('il catalogo ha i 29 prodotti del sito più l’esempio non pubblicato', () => {
  assert.equal(catalog.length, 30);
  assert.equal(catalog.filter((p) => p.active).length, 29);
  assert.equal(catalog.filter((p) => p.kind === 'forcella').length, 9);
  assert.ok(catalog.every((p) => p.price_cents > 0 && p.slug && p.name));
  assert.equal(new Set(catalog.map((p) => p.slug)).size, catalog.length);
});
