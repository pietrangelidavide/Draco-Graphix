import type { Address, CartLineInput, ConfigEntry, FieldChoice, Product, Settings } from './types';

// Regole di prezzo. La stessa logica vive nel database (funzione create_order di supabase/schema.sql):
// il test tests/parity.test.ts verifica che i due calcoli diano gli stessi importi.

export const MIN_YEAR = 1990;
export const DEFAULT_TEXT_MAX = 60;

/** Prezzo base dopo lo sconto del prodotto. 5000 cent al 12% -> 4400. */
export function basePrice(p: Pick<Product, 'price_cents' | 'discount_percent'>): number {
  return Math.round((p.price_cents * (100 - p.discount_percent)) / 100);
}

export function yearChoices(nowYear = new Date().getFullYear()): FieldChoice[] {
  const out: FieldChoice[] = [];
  for (let y = nowYear + 1; y >= 2005; y--) out.push({ value: String(y), label: String(y), delta_cents: 0 });
  out.push({ value: 'precedente', label: 'Precedente al 2005', delta_cents: 0 });
  return out;
}

export function isValidYear(v: string): boolean {
  if (v === 'precedente') return true;
  return /^\d{4}$/.test(v) && Number(v) >= MIN_YEAR && Number(v) <= 2100;
}

export interface PricedLine {
  unit_price_cents: number;
  config: ConfigEntry[];
  /** Errori per campo (chiave del campo -> messaggio). Vuoto se la configurazione è valida. */
  errors: Record<string, string>;
}

/** Calcola prezzo unitario e configurazione di una riga. Non lancia: restituisce gli errori. */
export function priceLine(product: Product, selections: Record<string, string>): PricedLine {
  const errors: Record<string, string> = {};
  const config: ConfigEntry[] = [];
  let unit = basePrice(product);

  for (const f of product.fields) {
    const v = (selections[f.key] ?? '').trim();
    if (!v) {
      if (f.required) errors[f.key] = 'Campo obbligatorio';
      continue;
    }
    if (f.type === 'text') {
      const max = f.maxLength ?? DEFAULT_TEXT_MAX;
      if (v.length > max) {
        errors[f.key] = `Massimo ${max} caratteri`;
        continue;
      }
      config.push({ key: f.key, label: f.label, value: v, value_label: v, delta_cents: 0, role: f.role });
    } else if (f.type === 'year') {
      if (!isValidYear(v)) {
        errors[f.key] = 'Annata non valida';
        continue;
      }
      config.push({ key: f.key, label: f.label, value: v, value_label: v === 'precedente' ? 'Precedente al 2005' : v, delta_cents: 0, role: f.role });
    } else {
      const c = f.choices?.find((x) => x.value === v);
      if (!c) {
        errors[f.key] = 'Scelta non valida';
        continue;
      }
      unit += c.delta_cents;
      config.push({ key: f.key, label: f.label, value: c.value, value_label: c.label, delta_cents: c.delta_cents, role: f.role });
    }
  }
  return { unit_price_cents: unit, config, errors };
}

export function shippingFor(subtotalCents: number, s: Pick<Settings, 'shipping_flat_cents' | 'shipping_free_over_cents'>): number {
  if (subtotalCents <= 0) return 0;
  if (s.shipping_free_over_cents != null && subtotalCents >= s.shipping_free_over_cents) return 0;
  return s.shipping_flat_cents;
}

export interface Totals {
  subtotal_cents: number;
  shipping_cents: number;
  total_cents: number;
}

export function totals(lines: { unit_price_cents: number; qty: number }[], s: Pick<Settings, 'shipping_flat_cents' | 'shipping_free_over_cents'>): Totals {
  const subtotal = lines.reduce((t, l) => t + l.unit_price_cents * l.qty, 0);
  const shipping = shippingFor(subtotal, s);
  return { subtotal_cents: subtotal, shipping_cents: shipping, total_cents: subtotal + shipping };
}

export interface ResolvedLine extends PricedLine {
  product: Product;
  qty: number;
}

export const MAX_QTY = 20;

/** Risolve le righe del carrello contro il catalogo. Lancia se un prodotto non esiste o la configurazione è invalida. */
export function resolveLines(inputs: CartLineInput[], catalog: Product[]): ResolvedLine[] {
  if (inputs.length === 0) throw new Error('Il carrello è vuoto');
  return inputs.map((i) => {
    const product = catalog.find((p) => p.id === i.product_id && p.active);
    if (!product) throw new Error('Prodotto non disponibile');
    const qty = Math.min(Math.max(Math.trunc(i.qty) || 0, 1), MAX_QTY);
    const priced = priceLine(product, i.selections);
    const bad = Object.values(priced.errors)[0];
    if (bad) throw new Error(`${product.name}: ${bad}`);
    if (product.stock != null && qty > product.stock) throw new Error(`${product.name}: ne restano ${product.stock}`);
    return { ...priced, product, qty };
  });
}

export function addressComplete(a: Partial<Address> | null | undefined): boolean {
  return !!a && !!a.street?.trim() && !!a.city?.trim() && !!a.zip?.trim() && !!a.province?.trim();
}

/** Testo breve della configurazione, per elenchi e schede. */
export function configSummary(config: ConfigEntry[]): string {
  return config.map((c) => `${c.label}: ${c.value_label}`).join(' · ');
}
