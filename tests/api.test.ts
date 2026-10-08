import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createLocalApi } from '../src/data/local';
import type { Api } from '../src/data/api';
import type { Address } from '../src/lib/types';

const addr: Address = { name: 'Test', street: 'Via Roma 1', city: 'Roma', zip: '00100', province: 'RM', country: 'IT' };
const kitSel = { modello: 'CRF 450R', annata: '2022', base: 'classica', laminazione: 'lucido', numero_pilota: '77' };

let api: Api;
beforeEach(() => {
  api = createLocalApi();
});

const loginCustomer = () => api.signIn('marco@draco.test', 'demo1234');
const loginStaff = () => api.signIn('titolare@draco.test', 'demo1234');

test('credenziali sbagliate vengono rifiutate', async () => {
  await assert.rejects(() => api.signIn('marco@draco.test', 'sbagliata'), /non corretti/);
  assert.equal(await api.getSession(), null);
});

test('il cliente vede solo i propri ordini, il gestionale tutti', async () => {
  await loginCustomer();
  const mine = await api.listOrders();
  assert.ok(mine.length >= 2 && mine.every((o) => o.user_id === 'u-marco'));
  await api.signOut();
  await loginStaff();
  const all = await api.listOrders();
  assert.ok(all.length > mine.length);
});

test('le operazioni del gestionale sono vietate ai clienti', async () => {
  await loginCustomer();
  await assert.rejects(() => api.setOrderStatus('o-4', 'in_stampa'), /riservata/);
  await assert.rejects(() => api.listCustomers(), /riservata/);
  await assert.rejects(() => api.recordPayment({ order_id: 'o-4', kind: 'ordine', amount_cents: 100, method: 'bonifico' }), /riservata/);
  assert.equal(await api.getProject('pr-2'), null, 'progetto di un altro cliente');
});

test('ordine: prezzi dal catalogo, pagamento, passaggio a "in preparazione"', async () => {
  await loginCustomer();
  const products = await api.listProducts();
  const race1 = products.find((p) => p.slug === 'honda-crf-race1')!;
  const order = await api.createOrder({
    items: [{ product_id: race1.id, qty: 2, selections: { ...kitSel, base: 'cromo' } }],
    shipping_address: addr, billing: {}, customer_note: 'Grazie', payment_method: 'bonifico',
  });
  assert.equal(order.subtotal_cents, 2 * (14900 + 13900));
  assert.equal(order.shipping_cents, 900);
  assert.equal(order.total_cents, order.subtotal_cents + 900);
  assert.equal(order.status, 'ricevuto');
  assert.equal(order.payment_status, 'da_pagare');
  assert.equal(order.payments[0]!.status, 'in_attesa');
  assert.equal(order.items[0]!.config.find((c) => c.key === 'base')!.value_label, 'Cromo');

  await api.signOut();
  await loginStaff();
  const notes = await api.listNotifications();
  assert.ok(notes.some((n) => n.title.includes(order.number)));
  await api.confirmPayment(order.payments[0]!.id, 'CRO 123');
  const paid = (await api.getOrder(order.id))!;
  assert.equal(paid.payment_status, 'pagato');
  assert.equal(paid.status, 'in_preparazione');
  await api.setOrderStatus(order.id, 'spedito');
  await api.updateOrder(order.id, { courier: 'BRT', tracking_code: 'XYZ' });
  const shipped = (await api.getOrder(order.id))!;
  assert.equal(shipped.tracking_code, 'XYZ');
  assert.deepEqual(shipped.events.map((e) => e.status), ['ricevuto', 'in_preparazione', 'spedito']);

  await api.signOut();
  await loginCustomer();
  assert.ok((await api.listNotifications()).some((n) => n.title.includes('Spedito')));
});

test('ordine: indirizzo mancante o metodo non attivo vengono respinti', async () => {
  await loginCustomer();
  const race1 = (await api.listProducts()).find((p) => p.slug === 'honda-crf-race1')!;
  const items = [{ product_id: race1.id, qty: 1, selections: kitSel }];
  await assert.rejects(() => api.createOrder({ items, shipping_address: { ...addr, street: '' }, billing: {}, customer_note: '', payment_method: 'bonifico' }), /indirizzo/);
  await assert.rejects(() => api.createOrder({ items, shipping_address: addr, billing: {}, customer_note: '', payment_method: 'carta' }), /pagamento/);
  await assert.rejects(() => api.createOrder({ items: [{ ...items[0]!, selections: {} }], shipping_address: addr, billing: {}, customer_note: '', payment_method: 'bonifico' }), /obbligatorio/);
});

test('progetto grafico: brief, acconto, bozze, modifiche, approvazione, saldo', async () => {
  await loginCustomer();
  const brief = { brand: 'Yamaha', model: 'YZ 125', year: '2020', rider_name: 'M', rider_number: '9', colors: 'blu', style: 'sportiva', sponsors: '', base: 'classica', finish: 'lucido' };
  const project = await api.submitProject({ title: '', brief, files: [], shipping_address: addr, payment_method: 'bonifico' });
  assert.equal(project.status, 'nuovo');
  assert.equal(project.deposit_cents, 5000);
  assert.equal(project.payments[0]!.status, 'in_attesa');

  await api.signOut();
  await loginStaff();
  await api.confirmPayment(project.payments[0]!.id);
  assert.equal((await api.getProject(project.id))!.status, 'in_grafica');
  const file = { path: 'data:image/svg+xml;utf8,<svg/>', name: 'v1.svg', size: 1, type: 'image/svg+xml' };
  const v1 = await api.addProof(project.id, file, 'prima idea');
  assert.equal(v1.version, 1);
  assert.equal((await api.getProject(project.id))!.status, 'bozza_inviata');

  await api.signOut();
  await loginCustomer();
  await assert.rejects(() => api.decideProof(v1.id, 'modifiche', '  '), /cosa vuoi cambiare/);
  await api.decideProof(v1.id, 'modifiche', 'Più grande il numero');
  let p = (await api.getProject(project.id))!;
  assert.equal(p.status, 'modifiche');
  assert.equal(p.revisions, 1);
  await assert.rejects(() => api.decideProof(v1.id, 'approvata', ''), /già stata valutata/);

  await api.signOut();
  await loginStaff();
  const v2 = await api.addProof(project.id, file, 'numero ingrandito');
  assert.equal(v2.version, 2);
  await api.signOut();
  await loginCustomer();
  await api.decideProof(v2.id, 'approvata', '');
  p = (await api.getProject(project.id))!;
  assert.equal(p.status, 'approvata');

  await api.signOut();
  await loginStaff();
  await api.updateProject(project.id, { total_cents: 18000 });
  await api.recordPayment({ project_id: project.id, kind: 'saldo', amount_cents: 13000, method: 'bonifico' });
  await api.setProjectStatus(project.id, 'in_stampa');
  p = (await api.getProject(project.id))!;
  assert.equal(p.total_cents, 18000);
  assert.equal(p.status, 'in_stampa');
  assert.ok(p.messages.some((m) => m.kind === 'system' && m.body.includes('Saldo ricevuto')));
});

test('messaggi del progetto: solo i partecipanti, notifica all’altra parte', async () => {
  await loginCustomer();
  await api.sendMessage('pr-1', 'Quando arriva la v3?', []);
  await api.signOut();
  await loginStaff();
  assert.ok((await api.listNotifications()).some((n) => n.title.includes('Marco Rossi')));
  await api.signOut();
  await api.signIn('sara@draco.test', 'demo1234');
  await assert.rejects(() => api.sendMessage('pr-1', 'intruso', []), /non trovato/);
});

test('preventivo: richiesta anonima, offerta, accettazione, conversione in ordine', async () => {
  await api.submitQuote({ contact: { name: 'Giulia Neri', email: 'giulia@draco.test', phone: '' }, team_name: 'MTR Team', riders: 4, bike_type: 'Supermoto', service: 'Kit', message: 'Servono 4 kit' });
  await loginStaff();
  const q = (await api.listQuotes()).find((x) => x.status === 'nuova' && x.team_name === 'MTR Team')!;
  assert.ok(q);
  await assert.rejects(() => api.quoteToOrder(q.id), /nessuna riga|non ha righe/i);
  await api.saveQuote(q.id, { lines: [{ description: 'Kit', qty: 4, unit_price_cents: 12000 }, { description: '', qty: 1, unit_price_cents: 999 }], status: 'inviato' });
  const sent = (await api.getQuote(q.id))!;
  assert.equal(sent.total_cents, 48000);
  assert.equal(sent.lines.length, 1);
  assert.equal(sent.user_id, 'u-giulia', 'collegato per email');
  await api.signOut();
  await api.signIn('giulia@draco.test', 'demo1234');
  await api.decideQuote(q.id, true);
  await api.signOut();
  await loginStaff();
  const order = await api.quoteToOrder(q.id);
  assert.equal(order.total_cents, 48000);
  assert.equal(order.items[0]!.kind, 'altro');
  assert.equal((await api.getQuote(q.id))!.status, 'convertito');
  await assert.rejects(() => api.quoteToOrder(q.id), /già stato convertito/);
});

test('contatti e newsletter: validazione e doppioni', async () => {
  await assert.rejects(() => api.submitLead({ kind: 'contatto', name: 'A', email: 'no', message: 'x' }), /Email/);
  await api.submitLead({ kind: 'newsletter', name: '', email: 'x@y.it' });
  await api.submitLead({ kind: 'newsletter', name: '', email: 'X@y.it' });
  await loginStaff();
  assert.equal((await api.listLeads()).filter((l) => l.kind === 'newsletter' && l.email.toLowerCase() === 'x@y.it').length, 1);
});

test('garage, preferiti e profilo', async () => {
  await loginCustomer();
  const bike = await api.saveBike({ brand: 'Beta', model: 'RR 200', year: 2023, rider_name: 'M', rider_number: '5' });
  assert.ok((await api.listBikes()).some((b) => b.id === bike.id));
  await api.deleteBike(bike.id);
  assert.ok(!(await api.listBikes()).some((b) => b.id === bike.id));
  const before = (await api.listWishlist()).length;
  const after = await api.toggleWishlist('p-grafica-beta-dark');
  assert.equal(after.length, before + 1);
  const prof = await api.updateProfile({ phone: '+39 000' });
  assert.equal(prof.phone, '+39 000');
});

test('solo il titolare cambia ruoli e impostazioni', async () => {
  await api.signIn('grafico@draco.test', 'demo1234');
  const s = await api.getSettings();
  await assert.rejects(() => api.saveSettings(s), /titolare/);
  await assert.rejects(() => api.setRole('u-marco', 'staff'), /titolare/);
  await api.signOut();
  await loginStaff();
  await api.setRole('u-marco', 'staff');
  assert.equal((await api.listCustomers()).find((u) => u.id === 'u-marco')!.role, 'staff');
});
