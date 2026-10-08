import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { api } from '../data';
import { useQuery } from './useQuery';
import { isOrderOpen, isProjectOpen, PROJECT_STATUS } from '../lib/status';
import type { Lead, OrderFull, Profile, ProjectFull, Quote } from '../lib/types';

interface AdminValue {
  orders: OrderFull[];
  projects: ProjectFull[];
  quotes: Quote[];
  leads: Lead[];
  customers: Profile[];
  loading: boolean;
  counts: { orders: number; projects: number; quotes: number; leads: number };
}

const Ctx = createContext<AdminValue | null>(null);

/** Elenchi del gestionale: caricati una volta e tenuti aggiornati; le pagine di elenco li leggono da qui. */
export function AdminProvider({ children }: { children: ReactNode }) {
  const q = useQuery(async () => {
    const [orders, projects, quotes, leads, customers] = await Promise.all([api.listOrders(), api.listProjects(), api.listQuotes(), api.listLeads(), api.listCustomers()]);
    return { orders, projects, quotes, leads, customers };
  }, []);
  const value = useMemo<AdminValue>(() => {
    const d = q.data;
    const orders = d?.orders ?? [];
    const projects = d?.projects ?? [];
    const quotes = d?.quotes ?? [];
    const leads = d?.leads ?? [];
    return {
      orders,
      projects,
      quotes,
      leads,
      customers: d?.customers ?? [],
      loading: q.loading && !d,
      counts: {
        orders: orders.filter((o) => isOrderOpen(o.status)).length,
        projects: projects.filter((p) => isProjectOpen(p.status) && PROJECT_STATUS[p.status].turn === 'draco').length,
        quotes: quotes.filter((x) => x.status === 'nuova' || x.status === 'accettato').length,
        leads: leads.filter((l) => !l.handled && l.kind === 'contatto').length,
      },
    };
  }, [q.data, q.loading]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdmin(): AdminValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('AdminProvider mancante');
  return v;
}
