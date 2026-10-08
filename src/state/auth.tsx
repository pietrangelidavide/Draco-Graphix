import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../data';
import type { SignUpInput } from '../data/api';
import type { Profile, Session } from '../lib/types';

interface AuthValue {
  user: Profile | null;
  loading: boolean;
  isStaff: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  demoLogin: (who: 'cliente' | 'titolare') => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setSession(await api.getSession());
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
    return api.subscribe(() => {
      void refresh();
    });
  }, [refresh]);

  const value = useMemo<AuthValue>(() => {
    const user = session?.user ?? null;
    return {
      user,
      loading,
      isStaff: user?.role === 'staff' || user?.role === 'admin',
      isAdmin: user?.role === 'admin',
      refresh,
      async signIn(email, password) {
        setSession(await api.signIn(email, password));
      },
      async signUp(input) {
        const r = await api.signUp(input);
        if ('session' in r) {
          setSession(r.session);
          return { needsConfirmation: false };
        }
        return { needsConfirmation: true };
      },
      async signOut() {
        await api.signOut();
        setSession(null);
      },
      async demoLogin(who) {
        if (!api.demoLogin) return;
        setSession(await api.demoLogin(who));
      },
    };
  }, [session, loading, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('AuthProvider mancante');
  return v;
}
