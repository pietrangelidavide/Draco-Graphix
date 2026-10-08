import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

type Theme = 'auto' | 'light' | 'dark';
interface Toast {
  id: number;
  text: string;
  kind: 'ok' | 'error';
}
interface UiValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toast: (text: string, kind?: 'ok' | 'error') => void;
}

const Ctx = createContext<UiValue | null>(null);
const THEME_KEY = 'dg-theme';

export function UiProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const t = localStorage.getItem(THEME_KEY);
      return t === 'light' || t === 'dark' ? t : 'auto';
    } catch {
      return 'auto';
    }
  });
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const el = document.documentElement;
    if (theme === 'auto') el.removeAttribute('data-theme');
    else el.setAttribute('data-theme', theme);
    try {
      if (theme === 'auto') localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ok */
    }
  }, [theme]);

  const toast = useCallback((text: string, kind: 'ok' | 'error' = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((cur) => [...cur.slice(-3), { id, text, kind }]);
    setTimeout(() => setToasts((cur) => cur.filter((t) => t.id !== id)), kind === 'error' ? 6000 : 3200);
  }, []);

  const value = useMemo(() => ({ theme, setTheme: setThemeState, toast }), [theme, toast]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useUi(): UiValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('UiProvider mancante');
  return v;
}

/** Esegue un'azione, mostra l'errore come avviso e restituisce se è andata a buon fine. */
export function useAction() {
  const { toast } = useUi();
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async <T,>(fn: () => Promise<T>, okText?: string): Promise<T | undefined> => {
      setBusy(true);
      try {
        const out = await fn();
        if (okText) toast(okText);
        return out;
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Qualcosa è andato storto', 'error');
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [toast],
  );
  return { run, busy };
}
