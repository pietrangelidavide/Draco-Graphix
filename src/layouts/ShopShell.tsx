import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api, isDemo } from '../data';
import { Link, navigate, usePath } from '../router';
import { useAuth } from '../state/auth';
import { useCart } from '../state/cart';
import { useCatalog } from '../state/catalog';
import { useAction, useUi } from '../state/ui';
import { Button, Icon, Input, Logo } from '../components/ui';
import { NotificationBell } from '../components/Notifications';
import { isEmail } from '../lib/util';

const NAV = [
  { to: '/catalogo', label: 'Kit grafiche' },
  { to: '/su-misura', label: 'Su misura' },
  { to: '/team', label: 'Team e motoclub' },
  { to: '/contatti', label: 'Contatti' },
];

function Newsletter() {
  const { run, busy } = useAction();
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  async function submit() {
    if (!isEmail(email)) {
      setErr('Controlla l’email');
      return;
    }
    setErr('');
    const ok = await run(async () => {
      await api.submitLead({ kind: 'newsletter', name: '', email });
      return true;
    });
    if (ok) setDone(true);
  }
  if (done) return <p className="news-done">Fatto. Ti scriviamo solo per novità sui kit e offerte.</p>;
  return (
    <form
      className="news"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <Input label="La tua email" type="email" value={email} onChange={setEmail} autoComplete="email" error={err} placeholder="nome@email.it" />
      <Button type="submit" busy={busy}>Iscrivimi</Button>
    </form>
  );
}

export function ShopShell({ children }: { children: ReactNode }) {
  const { user, isStaff, signOut, demoLogin } = useAuth();
  const { count } = useCart();
  const { settings } = useCatalog();
  const { theme, setTheme } = useUi();
  const path = usePath();
  const [menu, setMenu] = useState(false);

  useEffect(() => setMenu(false), [path]);

  return (
    <div className="shop">
      <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>
        Vai al contenuto
      </a>
      {isDemo && (
        <div className="demo-bar">
          <span>Versione dimostrativa: i dati sono di prova e restano nel tuo browser.</span>
          {isStaff ? (
            <Link to="/gestionale" className="link-btn">Vai al gestionale</Link>
          ) : (
            <button type="button" className="link-btn" onClick={() => void demoLogin('titolare').then(() => navigate('/gestionale'))}>
              Entra nel gestionale
            </button>
          )}
        </div>
      )}
      <header className="site-head">
        <div className="wrap head-row">
          <Link to="/" className="brand" aria-label="Draco Graphix, home">
            <Logo />
          </Link>
          <nav className={`site-nav ${menu ? 'open' : ''}`} aria-label="Principale">
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} aria-current={path.startsWith(n.to) ? 'page' : undefined}>
                {n.label}
              </Link>
            ))}
            {isStaff && (
              <Link to="/gestionale" className="nav-staff">
                Gestionale
              </Link>
            )}
          </nav>
          <div className="head-tools">
            {user && <NotificationBell />}
            <Link to={user ? '/account' : '/accedi'} className="icon-btn" aria-label={user ? 'Il mio account' : 'Accedi'} title={user ? 'Il mio account' : 'Accedi'}>
              <Icon name="user" />
            </Link>
            <Link to="/carrello" className="icon-btn cart-btn" aria-label={`Carrello, ${count} ${count === 1 ? 'articolo' : 'articoli'}`}>
              <Icon name="cart" />
              {count > 0 && <span className="count-badge">{count}</span>}
            </Link>
            <button type="button" className="icon-btn menu-btn" aria-label={menu ? 'Chiudi il menu' : 'Apri il menu'} aria-expanded={menu} onClick={() => setMenu(!menu)}>
              <Icon name={menu ? 'close' : 'menu'} />
            </button>
          </div>
        </div>
      </header>

      <main id="main" tabIndex={-1}>
        {children}
      </main>

      <footer className="site-foot">
        <div className="cmyk-strip" aria-hidden="true">
          <i /><i /><i /><i />
        </div>
        <div className="wrap foot-grid">
          <div>
            <Logo />
            <p className="foot-about">Grafiche adesive per moto da cross, enduro e supermotard. Stampate e spedite dall’Italia.</p>
            <p className="foot-contact">
              <a href={`mailto:${settings.company.email}`}>{settings.company.email}</a>
              <br />
              {settings.company.phone}
            </p>
          </div>
          <div>
            <h3>Negozio</h3>
            <ul>
              <li><Link to="/catalogo">Kit grafiche</Link></li>
              <li><Link to="/catalogo?tipo=forcella">Adesivi forcella</Link></li>
              <li><Link to="/su-misura">Grafica su misura</Link></li>
              <li><Link to="/team">Team e motoclub</Link></li>
            </ul>
          </div>
          <div>
            <h3>Aiuto</h3>
            <ul>
              <li><Link to="/contatti">Contatti</Link></li>
              <li><Link to="/account/ordini">I miei ordini</Link></li>
              <li><Link to="/privacy">Privacy</Link></li>
              <li><Link to="/condizioni">Condizioni di vendita</Link></li>
              {user && (
                <li>
                  <button type="button" className="link-btn" onClick={() => void signOut()}>
                    Esci
                  </button>
                </li>
              )}
            </ul>
          </div>
          <div>
            <h3>Novità e offerte</h3>
            <Newsletter />
          </div>
        </div>
        <div className="wrap foot-base">
          <span>
            © {new Date().getFullYear()} {settings.company.name} · P.IVA {settings.company.vat_number}
          </span>
          <div className="theme-switch" role="group" aria-label="Tema">
            {([['auto', 'Auto'], ['light', 'Chiaro'], ['dark', 'Scuro']] as const).map(([v, l]) => (
              <button key={v} type="button" aria-pressed={theme === v} className={theme === v ? 'on' : ''} onClick={() => setTheme(v)}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
