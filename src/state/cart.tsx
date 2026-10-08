import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { MAX_QTY, priceLine, totals } from '../lib/pricing';
import type { Totals } from '../lib/pricing';
import { uid } from '../lib/util';
import { useCatalog } from './catalog';
import type { CartLineInput, ConfigEntry, Product } from '../lib/types';

const KEY = 'dg-cart-v1';

export interface CartItem extends CartLineInput {
  key: string;
}

export interface CartLine extends CartItem {
  product: Product;
  unit_price_cents: number;
  config: ConfigEntry[];
}

interface CartValue {
  items: CartItem[];
  lines: CartLine[];
  count: number;
  totals: Totals;
  add: (line: CartLineInput) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
}

const Ctx = createContext<CartValue | null>(null);

function load(): CartItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as CartItem[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { products, settings, loading } = useCatalog();
  const [items, setItems] = useState<CartItem[]>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {
      /* archiviazione bloccata: il carrello vive finché la pagina è aperta */
    }
  }, [items]);

  // toglie dal carrello i prodotti che non esistono più
  const lines = useMemo<CartLine[]>(() => {
    const out: CartLine[] = [];
    for (const it of items) {
      const product = products.find((p) => p.id === it.product_id);
      if (!product) continue;
      const priced = priceLine(product, it.selections);
      out.push({ ...it, product, unit_price_cents: priced.unit_price_cents, config: priced.config });
    }
    return out;
  }, [items, products]);

  useEffect(() => {
    if (loading || products.length === 0) return;
    const live = new Set(lines.map((l) => l.key));
    if (items.some((i) => !live.has(i.key))) setItems((cur) => cur.filter((i) => live.has(i.key)));
  }, [lines, items, loading, products.length]);

  const add = useCallback((line: CartLineInput) => {
    setItems((cur) => {
      const same = cur.find((i) => i.product_id === line.product_id && JSON.stringify(i.selections) === JSON.stringify(line.selections));
      if (same) return cur.map((i) => (i === same ? { ...i, qty: Math.min(MAX_QTY, i.qty + line.qty) } : i));
      return [...cur, { ...line, key: uid() }];
    });
  }, []);

  const value = useMemo<CartValue>(
    () => ({
      items,
      lines,
      count: lines.reduce((t, l) => t + l.qty, 0),
      totals: totals(lines, settings),
      add,
      setQty: (key, qty) => setItems((cur) => cur.map((i) => (i.key === key ? { ...i, qty: Math.min(MAX_QTY, Math.max(1, qty)) } : i))),
      remove: (key) => setItems((cur) => cur.filter((i) => i.key !== key)),
      clear: () => setItems([]),
    }),
    [items, lines, settings, add],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart(): CartValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('CartProvider mancante');
  return v;
}
