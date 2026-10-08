import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../data';

export interface Query<T> {
  data: T | undefined;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** Carica dati e li ricarica da soli quando qualcosa cambia (anche in un'altra scheda). Tiene i vecchi dati mentre ricarica. */
export function useQuery<T>(fn: () => Promise<T>, deps: readonly unknown[], opts: { live?: boolean } = {}): Query<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(() => {
    const my = ++seq.current;
    fnRef.current().then(
      (d) => {
        if (my !== seq.current) return;
        setData(d);
        setError(null);
        setLoading(false);
      },
      (e: unknown) => {
        if (my !== seq.current) return;
        setError(e instanceof Error ? e.message : 'Errore');
        setLoading(false);
      },
    );
  }, []);

  useEffect(() => {
    setLoading(true);
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (opts.live === false) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const off = api.subscribe(() => {
      clearTimeout(t);
      t = setTimeout(run, 80);
    });
    return () => {
      clearTimeout(t);
      off();
    };
  }, [run, opts.live]);

  return { data, loading, error, reload: run };
}
