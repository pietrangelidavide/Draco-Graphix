import type { Brand, FieldChoice, FieldDef, PaymentMethodSetting, Product, Settings } from './types';

// Catalogo iniziale ricavato da dracographix.com (ottobre 2026): marchi, nomi dei kit, prezzi e opzioni
// (base di stampa e laminazione). Le foto non sono incluse: finché non vengono caricate, ogni scheda
// mostra la tavola di stampa generata da src/lib/art.ts.

export const BRANDS: Brand[] = [
  'Aprilia', 'Beta', 'Ducati', 'Fantic', 'Gas Gas', 'HM', 'Honda', 'Husqvarna', 'Kawasaki', 'KTM', 'Suzuki', 'TM', 'Yamaha', 'Stark Varg', 'Talaria',
].map((name, i) => ({ id: name.toLowerCase().replace(/\s+/g, '-'), name, sort: i, active: true }));

const choice = (value: string, label: string, delta_cents = 0): FieldChoice => ({ value, label, delta_cents });

export const KIT_FIELDS: FieldDef[] = [
  { key: 'modello', label: 'Modello della moto', type: 'text', required: true, role: 'model', placeholder: 'es. CRF 450R', maxLength: 40 },
  { key: 'annata', label: 'Annata', type: 'year', required: true, role: 'year' },
  { key: 'nome_pilota', label: 'Nome pilota / Tag Instagram', type: 'text', role: 'rider_name', placeholder: 'facoltativo', maxLength: 18 },
  { key: 'numero_pilota', label: 'Numero pilota', type: 'text', role: 'rider_number', placeholder: 'facoltativo', maxLength: 3 },
  {
    key: 'base', label: 'Base di stampa', type: 'select', required: true, role: 'base',
    choices: [choice('classica', 'Classica'), choice('cromo', 'Cromo', 13900), choice('olografico', 'Olografico', 14900)],
  },
  {
    key: 'laminazione', label: 'Laminazione', type: 'select', required: true, role: 'finish',
    choices: [choice('lucido', 'Lucido'), choice('opaco', 'Opaco', 1000), choice('glitter', 'Glitter', 4900)],
  },
];

export const FORK_FIELDS: FieldDef[] = [
  { key: 'modello', label: 'Moto su cui li monti', type: 'text', role: 'model', placeholder: 'facoltativo', maxLength: 40 },
];

export const SHIRT_FIELDS: FieldDef[] = [
  { key: 'taglia', label: 'Taglia', type: 'select', required: true, choices: ['S', 'M', 'L', 'XL', 'XXL'].map((t) => choice(t, t)) },
];

const KIT_CONTENTS = ['Convogliatori', 'Parafango anteriore', 'Parafango posteriore', 'Airbox', 'Tabella anteriore', 'Tabelle laterali', 'Parasteli', 'Forcellone'];
const KIT_SPECS = ['Pellicola CRYSTAL da 0,4 mm', 'Colla permanente', '100% Made in Italy'];

// Palette indicative per l'anteprima generata (tre colori: dominante, fondo, accento).
const COLORS = {
  honda: ['#d81f26', '#14161a', '#f2f2f2'],
  hondaBlue: ['#1e50d6', '#101a3a', '#f2f2f2'],
  beta: ['#d81f26', '#0f1a3a', '#f4f4f4'],
  husqvarna: ['#f5c400', '#0f2250', '#f4f4f4'],
  hm: ['#e8460f', '#15171b', '#f2f2f2'],
  ducati: ['#c8102e', '#17181b', '#f4f4f4'],
  fluo: ['#d4ff00', '#ff2e93', '#15171b'],
  dark: ['#7a828d', '#0c0d0f', '#d81f26'],
  grey: ['#9aa1ac', '#1b1e23', '#f2f2f2'],
  blue: ['#1e6bff', '#0c1430', '#f2f2f2'],
  red: ['#e0242b', '#17181b', '#f2f2f2'],
  white: ['#e7e9ee', '#1b1e23', '#d81f26'],
  black: ['#1b1e23', '#d81f26', '#f2f2f2'],
  graffiti: ['#ff2e93', '#15171b', '#d4ff00'],
  mountain: ['#2f7d5b', '#101a17', '#f2f2f2'],
  fork: ['#f2f2f2', '#15171b', '#d81f26'],
  forkRed: ['#d81f26', '#15171b', '#f2f2f2'],
  forkGold: ['#d9a928', '#15171b', '#f2f2f2'],
  forkWhite: ['#f2f2f2', '#15171b', '#7a828d'],
};

interface Row {
  slug: string;
  name: string;
  brand: string | null;
  tags: string[];
  colors: string[];
  price?: number;
  featured?: boolean;
  badge?: string;
}

const KITS: Row[] = [
  { slug: 'honda-transalp-mountain', name: 'Honda Transalp – Mountain', brand: 'honda', tags: ['Maxi Enduro'], colors: COLORS.mountain!, price: 19900, featured: true, badge: 'Hot' },
  { slug: 'honda-crf-clean-style-white', name: 'Honda CRF – Clean Style White', brand: 'honda', tags: ['Crf', 'Cross Motard'], colors: COLORS.white! },
  { slug: 'honda-crf-clean-style-black', name: 'Honda CRF – Clean Style Black', brand: 'honda', tags: ['Crf', 'Cross Motard'], colors: COLORS.black! },
  { slug: 'grafica-honda-crf-replica', name: 'Honda CRF – Replica', brand: 'honda', tags: ['Crf', 'Cross Motard'], colors: COLORS.honda!, featured: true },
  { slug: 'honda-crf-race1', name: 'Honda CRF – Race 1', brand: 'honda', tags: ['Crf', 'Cross Motard'], colors: COLORS.honda!, featured: true, badge: 'Hot' },
  { slug: 'honda-crf-race2', name: 'Honda CRF – Race 2', brand: 'honda', tags: ['Crf', 'Cross Motard'], colors: COLORS.hondaBlue! },
  { slug: 'honda-crf-2021-grafica-basic-blu', name: 'Honda CRF 2021 – Basic Blu', brand: 'honda', tags: ['Crf', 'Cross Motard'], colors: COLORS.blue! },
  { slug: 'grafica-beta-clear-style', name: 'Beta – Clear Style', brand: 'beta', tags: ['Cross Motard'], colors: COLORS.white! },
  { slug: 'beta-rr-300-2t-rr-350-4t-2020-21-grafica-demon', name: 'Beta RR 300 2T / RR 350 4T 2020-21 – Demon', brand: 'beta', tags: ['Cross Motard'], colors: COLORS.red!, featured: true },
  { slug: 'grafica-beta-race-1', name: 'Beta – Race 1', brand: 'beta', tags: ['Cross Motard'], colors: COLORS.beta! },
  { slug: 'grafica-beta-dark', name: 'Beta – Dark', brand: 'beta', tags: ['Cross Motard'], colors: COLORS.dark! },
  { slug: 'grafica-beta-blue-style', name: 'Beta – Blue Style', brand: 'beta', tags: ['Cross Motard'], colors: COLORS.blue! },
  { slug: 'grafica-husqvarna-fluo-style', name: 'Husqvarna – Fluo Style', brand: 'husqvarna', tags: ['Cross Motard'], colors: COLORS.fluo!, featured: true },
  { slug: 'husqvarna-te-fe-2020-22-grafica-graffiti', name: 'Husqvarna TE FE 2020/22 – Graffiti', brand: 'husqvarna', tags: ['Cross Motard'], colors: COLORS.graffiti! },
  { slug: 'grafica-husqvarna-grey-style', name: 'Husqvarna – Grey Style', brand: 'husqvarna', tags: ['Cross Motard'], colors: COLORS.grey! },
  { slug: 'grafica-husqvarna-race-1', name: 'Husqvarna – Race 1', brand: 'husqvarna', tags: ['Cross Motard'], colors: COLORS.husqvarna! },
  { slug: 'hm-race-style', name: 'HM – Race Style', brand: 'hm', tags: ['Cross Motard'], colors: COLORS.hm! },
  { slug: 'hm-fast-style-blue', name: 'HM – Fast Style Blue', brand: 'hm', tags: ['Cross Motard'], colors: COLORS.blue! },
  { slug: 'hm-fast-style', name: 'HM – Fast Style Red', brand: 'hm', tags: ['Cross Motard'], colors: COLORS.red! },
  { slug: 'ducati-hypermotard-2013-15-grafica-toro', name: 'Ducati Hypermotard 2013/15 – Toro', brand: 'ducati', tags: ['Naked'], colors: COLORS.ducati!, price: 15900 },
];

const FORKS: Row[] = [
  { slug: 'adesivi-forcella-mrz', name: 'Adesivi forcella MRZ', brand: null, tags: ['Forcelle'], colors: COLORS.fork! },
  { slug: 'adesivi-forcella-sw-white', name: 'Adesivi forcella SW White', brand: null, tags: ['Forcelle'], colors: COLORS.forkWhite! },
  { slug: 'adesivi-forcella-sw-red', name: 'Adesivi forcella SW Red', brand: null, tags: ['Forcelle'], colors: COLORS.forkRed! },
  { slug: 'adesivi-forcella-kyb-white', name: 'Adesivi forcella KYB White', brand: null, tags: ['Forcelle'], colors: COLORS.forkWhite! },
  { slug: 'adesivi-forcella-kyb-red', name: 'Adesivi forcella KYB Red', brand: null, tags: ['Forcelle'], colors: COLORS.forkRed! },
  { slug: 'adesivi-forcella-wp-classic', name: 'Adesivi forcella WP Classic', brand: null, tags: ['Forcelle'], colors: COLORS.fork! },
  { slug: 'adesivi-forcella-wp-white', name: 'Adesivi forcella WP White', brand: null, tags: ['Forcelle'], colors: COLORS.forkWhite! },
  { slug: 'adesivi-forcella-oh-white', name: 'Adesivi forcella OH White', brand: null, tags: ['Forcelle'], colors: COLORS.forkWhite! },
  { slug: 'adesivi-forcella-oh-gold', name: 'Adesivi forcella OH Gold', brand: null, tags: ['Forcelle'], colors: COLORS.forkGold! },
];

const TS = '2026-10-01T09:00:00.000Z';

export function catalogSeed(): Product[] {
  const out: Product[] = [];
  let sort = 0;
  for (const k of KITS) {
    const brandName = BRANDS.find((b) => b.id === k.brand)?.name ?? '';
    out.push({
      id: `p-${k.slug}`, slug: k.slug, name: k.name, kind: 'kit', brand_id: k.brand, tags: k.tags,
      description: `Kit di grafiche adesive${brandName ? ` per ${brandName}` : ''}. Disponibile per tutti i modelli e anni: indica il tuo e adattiamo la grafica.`,
      contents: KIT_CONTENTS, specs: KIT_SPECS, price_cents: k.price ?? 14900, discount_percent: 0,
      images: [], art_colors: k.colors, fields: KIT_FIELDS, badge: k.badge ?? null, featured: !!k.featured, active: true, stock: null, sort: sort++, created_at: TS,
    });
  }
  for (const f of FORKS) {
    out.push({
      id: `p-${f.slug}`, slug: f.slug, name: f.name, kind: 'forcella', brand_id: null, tags: f.tags,
      description: 'Adesivi per gli steli della forcella, in pellicola CRYSTAL con colla permanente.',
      contents: ['Adesivi per forcella'], specs: KIT_SPECS, price_cents: 5000, discount_percent: 12,
      images: [], art_colors: f.colors, fields: FORK_FIELDS, badge: null, featured: false, active: true, stock: null, sort: sort++, created_at: TS,
    });
  }
  // Esempio di accessorio, non pubblicato: mostra come si gestiscono taglie e giacenza.
  out.push({
    id: 'p-maglietta-esempio', slug: 'maglietta-draco-graphix', name: 'Maglietta Draco Graphix (esempio)', kind: 'accessorio', brand_id: null, tags: ['Accessori'],
    description: 'Scheda di esempio: modifica nome, prezzo e foto, poi pubblicala dal gestionale.',
    contents: [], specs: [], price_cents: 2500, discount_percent: 0, images: [], art_colors: ['#14161a', '#d81f26', '#f2f2f2'],
    fields: SHIRT_FIELDS, badge: null, featured: false, active: false, stock: 40, sort: sort++, created_at: TS,
  });
  return out;
}

const PAYMENT_METHODS: PaymentMethodSetting[] = [
  { id: 'bonifico', label: 'Bonifico bancario', instructions: 'Dopo l’ordine ti mostriamo i dati per il bonifico. Appena arriva il pagamento passiamo alla lavorazione.', enabled: true },
  { id: 'paypal', label: 'PayPal', instructions: 'Ti indichiamo il link per pagare con PayPal. Appena riceviamo il pagamento passiamo alla lavorazione.', enabled: true },
  { id: 'carta', label: 'Carta di credito', instructions: 'Pagamento online con carta.', enabled: false },
];

export const PRIVACY_DRAFT = `BOZZA da far verificare prima della pubblicazione.

Titolare del trattamento: Draco Graphix, P.IVA 02314280682, info@dracographix.com.

Dati che raccogliamo: nome, email, telefono, indirizzi di spedizione e dati di fatturazione che inserisci per ordinare; moto, grafiche e file che carichi; messaggi che ci scrivi.
A cosa servono: gestire ordini, progetti e preventivi, spedire, fatturare, risponderti. Se lo scegli, inviarti novità (newsletter).
Per quanto li conserviamo: per il tempo necessario a eseguire il contratto e agli obblighi fiscali.
I tuoi diritti: accesso, rettifica, cancellazione, opposizione e portabilità, scrivendo a info@dracographix.com.
Cookie: l’app usa solo memoria tecnica del browser (accesso, carrello, tema chiaro/scuro).`;

export const TERMS_DRAFT = `BOZZA da far verificare prima della pubblicazione.

Kit semi-personalizzati: realizzati su ordinazione per il modello e l’annata indicati.
Grafiche personalizzate: acconto alla richiesta; la bozza si può modificare fino all’approvazione; il saldo si versa dopo l’approvazione; l’acconto viene scalato dal totale.
Tempi: in media 3–5 giorni per produzione e spedizione, secondo il carico di lavoro.
Recesso e garanzia: prodotti su misura, vedi la normativa sul diritto di recesso per beni personalizzati.`;

export function settingsSeed(): Settings {
  return {
    company: {
      name: 'Draco Graphix',
      vat_number: '02314280682',
      email: 'info@dracographix.com',
      phone: '+39 351 8293757',
      instagram: '@dracographix',
      facebook: 'facebook.com/dracographix',
      address: '',
    },
    deposit_cents: 5000,
    vat_percent: 22,
    shipping_flat_cents: 900,
    shipping_free_over_cents: null,
    lead_time: 'In media 3–5 giorni per produzione e spedizione, secondo il carico di lavoro.',
    payment_methods: PAYMENT_METHODS,
    couriers: ['BRT', 'GLS', 'SDA', 'Poste Italiane', 'DHL', 'UPS', 'Altro'],
    privacy_text: PRIVACY_DRAFT,
    terms_text: TERMS_DRAFT,
  };
}
