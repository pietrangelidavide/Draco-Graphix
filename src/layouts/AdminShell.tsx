import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api, isDemo } from '../data';
import { Link, usePath } from '../router';
import { useAuth } from '../state/auth';
import { AdminProvider, useAdmin } from '../state/admin';
import { useAction, useUi } from '../state/ui';
import { Avatar, Button, Icon, Logo } from '../components/ui';
import { NotificationBell } from '../components/Notifications';
import { RequireAuth } from '../components/common';

interface Item {
  to: string;
  label: string;
  icon: string;
  count?: keyof ReturnType<typeof useAdmin>['counts'];
  admin?: boolean;
  exact?: boolean;
}

const ITEMS: Item[] = [
  { to: '/gestionale', label: 'Panoramica', icon: 'home', exact: true },
  { to: '/gestionale/ordini', label: 'Ordini', icon: 'box', count: 'orders' },
  { to: '/gestionale/produzione', label: 'Produzione', icon: 'print' },
  { to: '/gestionale/progetti', label: 'Su misura', icon: 'pen', count: 'projects' },
  { to: '/gestionale/preventivi', label: 'Preventivi', icon: 'file', count: 'quotes' },
  { to: '/gestionale/catalogo', label: 'Catalogo', icon: 'tag' },
  { to: '/gestionale/clienti', label: 'Clienti', icon: 'users' },
  { to: '/gestionale/contatti', label: 'Messaggi', icon: 'mail', count: 'leads' },
  { to: '/gestionale/impostazioni', label: 'Impostazioni', icon: 'cog', admin: true },
];

function Frame({ children }: { children: ReactNode }) {
  const { user, isAdmin, signOut } = useAuth();
  const { counts } = useAdmin();
  const { theme, setTheme } = useUi();
  const { run } = useAction();
  const path = usePath();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);

  return (
    <div className={`admin ${open ? 'nav-open' : ''}`}>
      <aside className="side" aria-label="Gestionale">
        <div className="side-top">
          <Link to="/gestionale" className="brand" aria-label="Gestionale Draco Graphix">
            <Logo />
          </Link>
          <button type="button" className="icon-btn side-close" aria-label="Chiudi il menu" onClick={() => setOpen(false)}>
            <Icon name="close" />
          </button>
        </div>
        <nav>
          {ITEMS.filter((i) => !i.admin || isAdmin).map((i) => {
            const on = i.exact ? path === i.to : path === i.to || path.startsWith(`${i.to}/`);
            const n = i.count ? counts[i.count] : 0;
            return (
              <Link key={i.to} to={i.to} aria-current={on ? 'page' : undefined} className={on ? 'on' : ''}>
                <Icon name={i.icon} size={19} />
                <span>{i.label}</span>
                {n > 0 && <b className="side-count">{n}</b>}
              </Link>
            );
          })}
        </nav>
        <div className="side-foot">
          <Link to="/" className="side-link">
            <Icon name="arrow" size={16} /> Vai al sito
          </Link>
          <div className="theme-switch" role="group" aria-label="Tema">
            {([['auto', 'Auto'], ['light', 'Chiaro'], ['dark', 'Scuro']] as const).map(([v, l]) => (
              <button key={v} type="button" aria-pressed={theme === v} className={theme === v ? 'on' : ''} onClick={() => setTheme(v)}>
                {l}
              </button>
            ))}
          </div>
          {isDemo && (
            <Button variant="quiet" size="sm" onClick={() => void run(async () => { await api.resetDemo?.(); }, 'Dati demo ripristinati')}>
              Ripristina dati demo
            </Button>
          )}
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-top">
          <button type="button" className="icon-btn menu-btn" aria-label="Apri il menu" onClick={() => setOpen(true)}>
            <Icon name="menu" />
          </button>
          <span className="admin-title">Gestionale</span>
          <div className="head-tools">
            <NotificationBell />
            <span className="who">
              <Avatar name={user?.full_name ?? ''} size={32} />
              <span>
                <b>{user?.full_name}</b>
                <small>{isAdmin ? 'Titolare' : 'Staff'}</small>
              </span>
            </span>
            <button type="button" className="icon-btn" aria-label="Esci" title="Esci" onClick={() => void signOut()}>
              <Icon name="logout" />
            </button>
          </div>
        </header>
        <main id="main" tabIndex={-1} className="admin-content">
          {children}
        </main>
      </div>
      {open && <button type="button" className="scrim" aria-label="Chiudi il menu" onClick={() => setOpen(false)} />}
    </div>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <RequireAuth staff>
      <AdminProvider>
        <Frame>{children}</Frame>
      </AdminProvider>
    </RequireAuth>
  );
}
