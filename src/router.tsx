import { useEffect, useSyncExternalStore } from 'react';
import type { MouseEvent, ReactNode } from 'react';

// Router minimale basato sull'indirizzo dopo "#": funziona su qualsiasi hosting statico, anche senza configurazione.

export type Params = Record<string, string>;
export interface RouteDef {
  path: string;
  render: (params: Params) => ReactNode;
}

// Lo stato del percorso vive qui; l'indirizzo "#..." lo rispecchia. Così la navigazione funziona anche
// dove la modifica dell'indirizzo è bloccata (per esempio dentro un frame isolato).
let current = typeof location !== 'undefined' ? location.hash : '';
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    if (location.hash !== current) {
      current = location.hash;
      emit();
    }
  });
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
const snapshot = () => current;

export function useHash(): string {
  return useSyncExternalStore(subscribe, snapshot, () => '');
}

export function parseHash(hash: string): { path: string; search: URLSearchParams } {
  const raw = hash.replace(/^#/, '') || '/';
  const q = raw.indexOf('?');
  const path = (q >= 0 ? raw.slice(0, q) : raw) || '/';
  return { path: path.startsWith('/') ? path : `/${path}`, search: new URLSearchParams(q >= 0 ? raw.slice(q + 1) : '') };
}

export function usePath(): string {
  return parseHash(useHash()).path;
}

export function useSearch(): [URLSearchParams, (next: Record<string, string | undefined>) => void] {
  const { path, search } = parseHash(useHash());
  const set = (next: Record<string, string | undefined>) => {
    const p = new URLSearchParams(search);
    for (const [k, v] of Object.entries(next)) {
      if (v === undefined || v === '') p.delete(k);
      else p.set(k, v);
    }
    const qs = p.toString();
    navigate(qs ? `${path}?${qs}` : path, { replace: true });
  };
  return [search, set];
}

export function navigate(to: string, opts: { replace?: boolean } = {}) {
  const hash = `#${to}`;
  try {
    if (opts.replace) location.replace(hash);
    else location.hash = to;
  } catch {
    /* indirizzo non modificabile: resta valido lo stato interno */
  }
  current = hash;
  emit();
}

export function matchPath(pattern: string, path: string): Params | null {
  const pp = pattern.split('/').filter(Boolean);
  const xp = path.split('/').filter(Boolean);
  const params: Params = {};
  for (let i = 0; i < pp.length; i++) {
    const seg = pp[i]!;
    if (seg === '*') return params;
    const val = xp[i];
    if (val === undefined) return null;
    if (seg.startsWith(':')) params[seg.slice(1)] = decodeURIComponent(val);
    else if (seg !== val) return null;
  }
  return xp.length === pp.length ? params : null;
}

export function Router({ routes, fallback }: { routes: RouteDef[]; fallback: ReactNode }) {
  const path = usePath();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [path]);
  for (const r of routes) {
    const params = matchPath(r.path, path);
    if (params) return <>{r.render(params)}</>;
  }
  return <>{fallback}</>;
}

export function Link({
  to, children, className, onClick, title, 'aria-label': ariaLabel, 'aria-current': ariaCurrent,
}: {
  to: string;
  children?: ReactNode;
  className?: string;
  title?: string;
  'aria-label'?: string;
  'aria-current'?: 'page' | undefined;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(to);
  };
  return (
    <a href={`#${to}`} className={className} title={title} aria-label={ariaLabel} aria-current={ariaCurrent} onClick={handle}>
      {children}
    </a>
  );
}

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · Draco Graphix` : 'Draco Graphix · Grafiche adesive per moto';
  }, [title]);
}
