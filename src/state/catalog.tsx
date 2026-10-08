import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { api } from '../data';
import { useQuery } from './useQuery';
import { useAuth } from './auth';
import type { Brand, Product, Settings } from '../lib/types';
import { settingsSeed } from '../lib/seed';

interface CatalogValue {
  brands: Brand[];
  /** Prodotti pubblicati. */
  products: Product[];
  /** Tutti i prodotti, bozze comprese (solo gestionale). */
  allProducts: Product[];
  settings: Settings;
  loading: boolean;
  byId: (id: string) => Product | undefined;
}

const Ctx = createContext<CatalogValue | null>(null);
const EMPTY_SETTINGS = settingsSeed();

export function CatalogProvider({ children }: { children: ReactNode }) {
  const { isStaff } = useAuth();
  const q = useQuery(
    async () => {
      const [brands, all, settings] = await Promise.all([api.listBrands(), api.listProducts({ all: isStaff }), api.getSettings()]);
      return { brands, all, settings };
    },
    [isStaff],
  );
  const value = useMemo<CatalogValue>(() => {
    const all = q.data?.all ?? [];
    return {
      brands: q.data?.brands ?? [],
      products: all.filter((p) => p.active),
      allProducts: all,
      settings: q.data?.settings ?? EMPTY_SETTINGS,
      loading: q.loading && !q.data,
      byId: (id) => all.find((p) => p.id === id),
    };
  }, [q.data, q.loading]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCatalog(): CatalogValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('CatalogProvider mancante');
  return v;
}
