import { kitArtUrl, svgDataUrl } from '../lib/art';
import { bikeSvg } from '../lib/bike';
import { BRANDS, catalogSeed, settingsSeed } from '../lib/seed';
import { priceLine, totals } from '../lib/pricing';
import type {
  AppNotification, Bike, Brand, Lead, Order, OrderEvent, OrderItem, OrderStatus, Payment, PaymentMethodSetting, Product, Profile,
  Project, ProjectBrief, ProjectMessage, Proof, Quote, Settings,
} from '../lib/types';

export interface LocalDb {
  v: 1;
  users: Profile[];
  passwords: Record<string, string>;
  sessionUserId: string | null;
  brands: Brand[];
  products: Product[];
  settings: Settings;
  orders: Order[];
  order_items: OrderItem[];
  order_events: OrderEvent[];
  payments: Payment[];
  projects: Project[];
  proofs: Proof[];
  messages: ProjectMessage[];
  quotes: Quote[];
  leads: Lead[];
  notifications: AppNotification[];
  wishlist: { user_id: string; product_id: string }[];
  bikes: Bike[];
  counters: Record<string, number>;
}

const DAY = 86400000;

/** Dati di prova: clienti, ordini in tutti gli stati, progetti, preventivi. Le date sono relative a "adesso". */
export function buildDemoDb(now: Date): LocalDb {
  const ago = (days: number, hours = 0) => new Date(now.getTime() - days * DAY - hours * 3600000).toISOString();
  const year = now.getFullYear();
  const products = catalogSeed();
  const settings = settingsSeed();
  const prod = (slug: string) => products.find((p) => p.slug === slug)!;

  const person = (id: string, role: Profile['role'], full_name: string, email: string, phone: string, extra: Partial<Profile> = {}, days = 60): Profile => ({
    id, role, full_name, email, phone, address: null, billing: {}, newsletter: false, staff_note: '', created_at: ago(days), ...extra,
  });
  const addr = (name: string, street: string, city: string, zip: string, province: string) => ({ name, street, city, zip, province, country: 'IT', phone: '' });

  const users: Profile[] = [
    person('u-titolare', 'admin', 'Titolare Draco', 'titolare@draco.test', '+39 351 8293757', {}, 400),
    person('u-grafico', 'staff', 'Grafico Draco', 'grafico@draco.test', '', {}, 300),
    person('u-marco', 'customer', 'Marco Rossi', 'marco@draco.test', '+39 333 1112233', { address: addr('Marco Rossi', 'Via dei Platani 12', 'Roma', '00178', 'RM'), newsletter: true }, 120),
    person('u-luca', 'customer', 'Luca Bianchi', 'luca@draco.test', '+39 347 5550101', { address: addr('Luca Bianchi', 'Via Garibaldi 4', 'Pescara', '65121', 'PE') }, 200),
    person('u-sara', 'customer', 'Sara Conti', 'sara@draco.test', '+39 338 7776655', { address: addr('Sara Conti', 'Corso Italia 88', 'Perugia', '06121', 'PG') }, 90),
    person('u-andrea', 'customer', 'Andrea Greco', 'andrea@draco.test', '+39 366 2203344', { address: addr('Andrea Greco', 'Via Milano 31', 'Bergamo', '24122', 'BG') }, 20),
    person('u-giulia', 'customer', 'Giulia Neri', 'giulia@draco.test', '+39 320 9081726', {
      address: addr('MTR Team', 'Via dello Sport 7', 'Latina', '04100', 'LT'),
      billing: { business_name: 'MTR Team A.S.D.', vat_number: '01234567890', sdi_code: 'M5UXCR1' },
      staff_note: 'Team supermoto, ordina per tutta la squadra. Preferisce il bonifico.',
    }, 250),
  ];
  const passwords: Record<string, string> = Object.fromEntries(users.map((u) => [u.id, 'demo1234']));

  const bikes: Bike[] = [
    { id: 'b-1', user_id: 'u-marco', brand: 'Honda', model: 'CRF 450R', year: 2022, rider_name: 'Marco R', rider_number: '77', created_at: ago(100) },
    { id: 'b-2', user_id: 'u-marco', brand: 'KTM', model: 'EXC 300', year: 2021, rider_name: 'Marco R', rider_number: '12', created_at: ago(30) },
  ];

  const orders: Order[] = [];
  const order_items: OrderItem[] = [];
  const order_events: OrderEvent[] = [];
  const payments: Payment[] = [];
  let seq = 0;
  const method = (settings.payment_methods[0] as PaymentMethodSetting).id;

  function makeOrder(opts: {
    user: string; days: number; status: OrderStatus; paid: boolean; lines: { slug: string; qty?: number; sel: Record<string, string> }[];
    courier?: string; tracking?: string; note?: string; staffNote?: string; quoteId?: string; shipping?: number;
  }) {
    seq += 1;
    const user = users.find((u) => u.id === opts.user)!;
    const id = `o-${seq}`;
    const resolved = opts.lines.map((l) => ({ ...priceLine(prod(l.slug), l.sel), product: prod(l.slug), qty: l.qty ?? 1 }));
    const t = totals(resolved, settings);
    const shipping = opts.shipping ?? t.shipping_cents;
    const total = t.subtotal_cents + shipping;
    const order: Order = {
      id, number: `DG-${year}-${String(seq).padStart(4, '0')}`, user_id: user.id, status: opts.status, payment_status: opts.paid ? 'pagato' : 'da_pagare', payment_method: method,
      subtotal_cents: t.subtotal_cents, shipping_cents: shipping, total_cents: total,
      shipping_address: user.address ?? addr(user.full_name, '', '', '', ''), billing: user.billing, customer_note: opts.note ?? '', staff_note: opts.staffNote ?? '',
      courier: opts.courier ?? '', tracking_code: opts.tracking ?? '', quote_id: opts.quoteId ?? null, created_at: ago(opts.days), updated_at: ago(Math.max(0, opts.days - 1)),
    };
    orders.push(order);
    resolved.forEach((l, i) =>
      order_items.push({ id: `${id}-i${i}`, order_id: id, product_id: l.product.id, name: l.product.name, kind: l.product.kind, qty: l.qty, unit_price_cents: l.unit_price_cents, config: l.config }),
    );
    payments.push({
      id: `${id}-pay`, order_id: id, project_id: null, kind: 'ordine', amount_cents: total, method, status: opts.paid ? 'ricevuto' : 'in_attesa',
      reference: opts.paid ? 'CRO 0000' : '', paid_at: opts.paid ? ago(opts.days, -2) : null, created_at: ago(opts.days),
    });
    const flow: OrderStatus[] = ['ricevuto', 'in_preparazione', 'in_stampa', 'pronto', 'spedito', 'consegnato'];
    const last = flow.indexOf(opts.status);
    flow.slice(0, last + 1).forEach((s, k) =>
      order_events.push({ id: `${id}-e${k}`, order_id: id, status: s, note: k === 0 ? 'Ordine ricevuto' : '', actor_name: k === 0 ? user.full_name : 'Titolare Draco', created_at: ago(Math.max(0, opts.days - k * 0.6)) }),
    );
    return order;
  }

  const kit = (extra: Record<string, string>) => ({ modello: 'CRF 450R', annata: '2022', base: 'classica', laminazione: 'lucido', ...extra });

  makeOrder({ user: 'u-marco', days: 41, status: 'consegnato', paid: true, courier: 'BRT', tracking: '0591234567890', lines: [{ slug: 'honda-crf-race1', sel: kit({ nome_pilota: 'Marco R', numero_pilota: '77' }) }] });
  makeOrder({ user: 'u-luca', days: 6, status: 'spedito', paid: true, courier: 'GLS', tracking: 'GL98273645', lines: [{ slug: 'beta-rr-300-2t-rr-350-4t-2020-21-grafica-demon', sel: kit({ modello: 'RR 300 2T', annata: '2021', base: 'cromo', laminazione: 'opaco', numero_pilota: '5' }) }] });
  makeOrder({ user: 'u-sara', days: 4, status: 'in_stampa', paid: true, lines: [{ slug: 'adesivi-forcella-kyb-red', sel: { modello: 'Yamaha YZ 250F' } }] });
  makeOrder({ user: 'u-marco', days: 2, status: 'in_preparazione', paid: true, note: 'Il numero va in corsivo, come nell’ultimo kit.', lines: [{ slug: 'grafica-husqvarna-fluo-style', sel: kit({ modello: 'FC 450', annata: '2023', nome_pilota: 'MARCO', numero_pilota: '12', base: 'olografico', laminazione: 'glitter' }) }] });
  makeOrder({ user: 'u-andrea', days: 1, status: 'ricevuto', paid: false, lines: [{ slug: 'honda-transalp-mountain', sel: kit({ modello: 'XL750 Transalp', annata: '2024' }) }] });
  makeOrder({ user: 'u-luca', days: 5, status: 'pronto', paid: true, staffNote: 'Spedire lunedì con BRT.', lines: [{ slug: 'honda-crf-race2', sel: kit({ modello: 'CRF 250R', annata: '2020', numero_pilota: '88', nome_pilota: 'LUCA B' }) }] });
  makeOrder({ user: 'u-giulia', days: 9, status: 'in_stampa', paid: true, shipping: 0, quoteId: 'q-3', lines: [{ slug: 'hm-race-style', qty: 3, sel: kit({ modello: 'CRM 125 R', annata: '2022' }) }] });

  // ---- progetti grafici ----
  const projects: Project[] = [];
  const proofs: Proof[] = [];
  const messages: ProjectMessage[] = [];
  const brief = (b: Partial<ProjectBrief>): ProjectBrief => ({
    brand: '', model: '', year: '', rider_name: '', rider_number: '', colors: '', style: '', sponsors: '', base: 'classica', finish: 'lucido', ...b,
  });
  let mseq = 0;
  const sys = (project_id: string, body: string, d: number): ProjectMessage => ({ id: `m-${++mseq}`, project_id, sender_id: '', sender_role: 'staff', sender_name: 'Draco Graphix', kind: 'system', body, files: [], created_at: ago(d) });
  const say = (project_id: string, from: Profile, body: string, d: number, h = 0): ProjectMessage => ({
    id: `m-${++mseq}`, project_id, sender_id: from.id, sender_role: from.role, sender_name: from.full_name, kind: 'message', body, files: [], created_at: ago(d, h),
  });
  const pay = (project_id: string, kind: 'acconto' | 'saldo', amount: number, received: boolean, d: number): Payment => ({
    id: `${project_id}-${kind}`, order_id: null, project_id, kind, amount_cents: amount, method, status: received ? 'ricevuto' : 'in_attesa', reference: received ? 'CRO 0000' : '', paid_at: received ? ago(d) : null, created_at: ago(d),
  });
  const marco = users[2]!, titolare = users[0]!, grafico = users[1]!;

  // 1) Marco: due bozze, la seconda aspetta la sua risposta
  const art1 = ['#ff6a13', '#101215', '#f2f2f2'];
  // foto "della moto del cliente" e bozze sulla stessa moto: così nell'area clienti il confronto prima/dopo funziona subito
  const bikeUrl = (variant: 'stock' | 'custom', idPrefix: string, extra: Partial<Parameters<typeof bikeSvg>[0]> = {}) =>
    svgDataUrl(bikeSvg({ variant, seedKey: 'drago', colors: art1, idPrefix, stage: true, ...extra }));
  projects.push({
    id: 'pr-1', number: `GP-${year}-0001`, user_id: 'u-marco', title: 'KTM EXC 300 – tema drago', status: 'bozza_inviata',
    brief: brief({ brand: 'KTM', model: 'EXC 300', year: '2021', rider_name: 'MARCO R', rider_number: '12', colors: 'Arancio, nero, un tocco di rosso', style: 'Un drago stilizzato che attraversa le fiancate, linee aggressive, niente di troppo “cartoon”.', sponsors: 'Logo officina “Rossi Moto” sul parafango' }),
    files: [{ path: bikeUrl('stock', 'pf0'), name: 'la-mia-ktm.svg', size: 0, type: 'image/svg+xml' }], deposit_cents: 5000, total_cents: null, revisions: 1, courier: '', tracking_code: '', shipping_address: users[2]!.address, staff_note: '', created_at: ago(8), updated_at: ago(0, 5),
  });
  proofs.push(
    { id: 'pf-1', project_id: 'pr-1', version: 1, file: { path: bikeUrl('custom', 'pf1', { seedKey: 'drago-v1', number: '12', name: 'MARCO R', finish: 'opaco' }), name: 'bozza-v1.svg', size: 0, type: 'image/svg+xml' }, note: 'Prima idea: il drago sale dalla fiancata verso il serbatoio.', status: 'modifiche', customer_comment: 'Il drago mi piace! Lo vorrei più grande sulla fiancata e il numero più grosso.', created_at: ago(5), decided_at: ago(4, 6) },
    { id: 'pf-2', project_id: 'pr-1', version: 2, file: { path: bikeUrl('custom', 'pf2', { seedKey: 'drago-v2', colors: ['#ff6a13', '#0b0c0e', '#ffffff'], number: '12', name: 'MARCO R', finish: 'lucido' }), name: 'bozza-v2.svg', size: 0, type: 'image/svg+xml' }, note: 'Drago ingrandito, numero a 150 pt, aggiunto il logo officina.', status: 'in_attesa', customer_comment: '', created_at: ago(0, 5), decided_at: null },
  );
  messages.push(
    sys('pr-1', 'Brief ricevuto. Appena arriva l’acconto il grafico inizia a lavorare.', 8),
    sys('pr-1', 'Acconto ricevuto: il grafico inizia a lavorare alla prima bozza.', 7),
    say('pr-1', grafico, 'Ciao Marco! Ho letto il brief: parto da un drago stilizzato sulle fiancate, arancio e nero. Ti mando la prima bozza entro un paio di giorni.', 7, 2),
    sys('pr-1', 'Grafico Draco ha caricato la bozza v1.', 5),
    sys('pr-1', 'Marco Rossi ha chiesto modifiche alla bozza v1.', 4),
    say('pr-1', marco, 'Il drago mi piace! Lo vorrei più grande sulla fiancata e il numero più grosso.', 4, 6),
    say('pr-1', grafico, 'Fatto, ti preparo la v2.', 4, 3),
    sys('pr-1', 'Grafico Draco ha caricato la bozza v2.', 0),
  );
  payments.push(pay('pr-1', 'acconto', 5000, true, 8));

  // 2) Sara: l'acconto è arrivato, il grafico sta lavorando
  projects.push({
    id: 'pr-2', number: `GP-${year}-0002`, user_id: 'u-sara', title: 'Yamaha YZ 250F – tutta nera e oro', status: 'in_grafica',
    brief: brief({ brand: 'Yamaha', model: 'YZ 250F', year: '2022', rider_name: 'SARA C', rider_number: '31', colors: 'Nero opaco con dettagli oro', style: 'Minimal, linee sottili, effetto lusso. Base cromo se si può.', base: 'cromo', finish: 'opaco' }),
    files: [], deposit_cents: 5000, total_cents: null, revisions: 0, courier: '', tracking_code: '', shipping_address: users[4]!.address, staff_note: '', created_at: ago(2), updated_at: ago(1),
  });
  messages.push(sys('pr-2', 'Brief ricevuto. Appena arriva l’acconto il grafico inizia a lavorare.', 2), sys('pr-2', 'Acconto ricevuto: il grafico inizia a lavorare alla prima bozza.', 1));
  payments.push(pay('pr-2', 'acconto', 5000, true, 2));

  // 3) Andrea: nuovo, acconto in attesa
  projects.push({
    id: 'pr-3', number: `GP-${year}-0003`, user_id: 'u-andrea', title: 'Husqvarna TC 125 – replica anni ’90', status: 'nuovo',
    brief: brief({ brand: 'Husqvarna', model: 'TC 125', year: '2019', rider_name: '', rider_number: '4', colors: 'Giallo e blu', style: 'Look retrò anni ’90, con le grandi fasce diagonali.', finish: 'lucido' }),
    files: [], deposit_cents: 5000, total_cents: null, revisions: 0, courier: '', tracking_code: '', shipping_address: users[5]!.address, staff_note: '', created_at: ago(0, 3), updated_at: ago(0, 3),
  });
  messages.push(sys('pr-3', 'Brief ricevuto. Appena arriva l’acconto il grafico inizia a lavorare.', 0));
  payments.push(pay('pr-3', 'acconto', 5000, false, 0));

  // 4) Luca: bozza approvata, aspetta il saldo
  projects.push({
    id: 'pr-4', number: `GP-${year}-0004`, user_id: 'u-luca', title: 'Beta RR 350 – grafica team', status: 'approvata',
    brief: brief({ brand: 'Beta', model: 'RR 350 4T', year: '2022', rider_name: 'LUCA B', rider_number: '88', colors: 'Rosso, bianco, nero', style: 'Grafica da team ufficiale, con sponsor sul parafango.', sponsors: 'Bar Sport, Autofficina Greco' }),
    files: [], deposit_cents: 5000, total_cents: 21000, revisions: 2, courier: '', tracking_code: '', shipping_address: users[3]!.address, staff_note: 'Sponsor da fornire in vettoriale: ricevuti.', created_at: ago(14), updated_at: ago(1),
  });
  proofs.push({ id: 'pf-4', project_id: 'pr-4', version: 3, file: { path: kitArtUrl('team-v3', ['#d81f26', '#14161a', '#f4f4f4'], { idPrefix: 'pf4', number: '88', name: 'LUCA B' }), name: 'bozza-v3.svg', size: 0, type: 'image/svg+xml' }, note: 'Versione finale con sponsor.', status: 'approvata', customer_comment: 'Perfetta, approvo!', created_at: ago(2), decided_at: ago(1) });
  messages.push(sys('pr-4', 'Luca Bianchi ha approvato la bozza v3.', 1), sys('pr-4', 'Totale della grafica: 210,00 € (acconto già scalato).', 1), say('pr-4', titolare, 'Grazie Luca! Il totale è 210 €, tolto l’acconto restano 160 €. Appena arriva il saldo andiamo in stampa.', 1, 1));
  payments.push(pay('pr-4', 'acconto', 5000, true, 14), pay('pr-4', 'saldo', 16000, false, 1));

  // ---- preventivi ----
  const quotes: Quote[] = [
    {
      id: 'q-1', number: `PR-${year}-0001`, user_id: 'u-giulia', contact: { name: 'Giulia Neri', email: 'giulia@draco.test', phone: '+39 320 9081726' }, team_name: 'MTR Team', riders: 6, bike_type: 'Supermoto 450',
      service: 'Kit completo + adesivi forcella', message: 'Ci servono 6 kit uguali con il nome di ogni pilota sul parafango, per la prossima stagione.', status: 'inviato',
      lines: [{ description: 'Kit grafica completa su misura (base classica, lucido)', qty: 6, unit_price_cents: 13500 }, { description: 'Nome pilota personalizzato', qty: 6, unit_price_cents: 1000 }, { description: 'Adesivi forcella', qty: 6, unit_price_cents: 3500 }],
      total_cents: 6 * 13500 + 6 * 1000 + 6 * 3500, valid_until: new Date(now.getTime() + 20 * DAY).toISOString().slice(0, 10), staff_note: 'Sconto quantità già applicato.', order_id: null, created_at: ago(6), updated_at: ago(3),
    },
    {
      id: 'q-2', number: `PR-${year}-0002`, user_id: null, contact: { name: 'Paolo Ferri', email: 'paolo@motoclubvaldarno.test', phone: '' }, team_name: 'Motoclub Valdarno', riders: 14, bike_type: 'Enduro e cross',
      service: 'Grafiche per tutti i soci', message: 'Siamo 14 soci, vorremmo una grafica comune con il logo del club. Quanto verrebbe?', status: 'nuova', lines: [], total_cents: 0, valid_until: null, staff_note: '', order_id: null, created_at: ago(0, 6), updated_at: ago(0, 6),
    },
    {
      id: 'q-3', number: `PR-${year}-0003`, user_id: 'u-giulia', contact: { name: 'Giulia Neri', email: 'giulia@draco.test', phone: '+39 320 9081726' }, team_name: 'MTR Team', riders: 3, bike_type: 'Supermoto 125',
      service: 'Kit semi-personalizzati', message: '3 kit HM Race Style per i piloti junior.', status: 'convertito',
      lines: [{ description: 'HM – Race Style (kit completo)', qty: 3, unit_price_cents: 14900 }], total_cents: 3 * 14900, valid_until: null, staff_note: '', order_id: 'o-7', created_at: ago(15), updated_at: ago(9),
    },
  ];
  // ordine 7 nasce da un preventivo: gli importi seguono le righe del preventivo
  const o7 = orders.find((o) => o.id === 'o-7')!;
  o7.subtotal_cents = 3 * 14900;
  o7.total_cents = 3 * 14900;
  const p7 = payments.find((p) => p.id === 'o-7-pay')!;
  p7.amount_cents = o7.total_cents;

  const leads: Lead[] = [
    { id: 'l-1', kind: 'contatto', name: 'Davide P.', email: 'davide@example.test', phone: '', message: 'Fate anche grafiche per scooter 50cc? Ho un Beta RR 50.', handled: false, created_at: ago(0, 9) },
    { id: 'l-2', kind: 'contatto', name: 'Elena T.', email: 'elena@example.test', phone: '+39 340 1112222', message: 'Spedite anche in Svizzera? Quanto costa?', handled: true, created_at: ago(7) },
    { id: 'l-3', kind: 'newsletter', name: '', email: 'fan1@example.test', phone: '', message: '', handled: false, created_at: ago(3) },
    { id: 'l-4', kind: 'newsletter', name: '', email: 'fan2@example.test', phone: '', message: '', handled: false, created_at: ago(1) },
  ];

  const notifications: AppNotification[] = [
    { id: 'n-1', user_id: 'u-marco', audience: 'user', title: `Bozza pronta · GP-${year}-0001`, body: 'È pronta la bozza v2: approvala o chiedi modifiche.', link: '/account/progetti/pr-1', read_at: null, created_at: ago(0, 5) },
    { id: 'n-2', user_id: 'u-marco', audience: 'user', title: `DG-${year}-0004: In preparazione`, body: 'Stiamo preparando i file per la tua moto.', link: '/account/ordini/o-4', read_at: ago(1), created_at: ago(1) },
    { id: 'n-3', user_id: null, audience: 'staff', title: `Nuovo progetto GP-${year}-0003`, body: 'Andrea Greco · Husqvarna TC 125 – replica anni ’90', link: '/gestionale/progetti/pr-3', read_at: null, created_at: ago(0, 3) },
    { id: 'n-4', user_id: null, audience: 'staff', title: `Nuova richiesta di preventivo PR-${year}-0002`, body: 'Motoclub Valdarno · 14 piloti', link: '/gestionale/preventivi/q-2', read_at: null, created_at: ago(0, 6) },
    { id: 'n-5', user_id: null, audience: 'staff', title: `Nuovo ordine DG-${year}-0005`, body: 'Andrea Greco · 208,00 €', link: '/gestionale/ordini/o-5', read_at: null, created_at: ago(1) },
  ];

  return {
    v: 1, users, passwords, sessionUserId: null, brands: BRANDS.map((b) => ({ ...b })), products, settings, orders, order_items, order_events, payments,
    projects, proofs, messages, quotes, leads, notifications,
    wishlist: [{ user_id: 'u-marco', product_id: 'p-honda-crf-race1' }, { user_id: 'u-marco', product_id: 'p-grafica-husqvarna-fluo-style' }],
    bikes, counters: { [`DG-${year}`]: seq, [`GP-${year}`]: 4, [`PR-${year}`]: 3 },
  };
}
