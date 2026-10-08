import { useEffect, useState } from 'react';
import { isDemo } from '../../data';
import { Link, navigate, usePageTitle, useSearch } from '../../router';
import { useAuth } from '../../state/auth';
import { useCatalog } from '../../state/catalog';
import { useAction } from '../../state/ui';
import { Button, Card, Empty, Input, LinkButton, PageHead } from '../../components/ui';
import { isEmail } from '../../lib/util';

export function LegalPage({ kind }: { kind: 'privacy' | 'condizioni' }) {
  const { settings } = useCatalog();
  const title = kind === 'privacy' ? 'Informativa privacy' : 'Condizioni di vendita';
  usePageTitle(title);
  const text = kind === 'privacy' ? settings.privacy_text : settings.terms_text;
  return (
    <div className="wrap section narrow">
      <PageHead title={title} />
      <div className="legal">
        {text.split(/\n{2,}/).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </div>
  );
}

export function NotFoundPage() {
  usePageTitle('Pagina non trovata');
  return (
    <div className="wrap section">
      <Empty icon="search" title="Questa pagina non c’è" text="Il link potrebbe essere vecchio. Riparti dal catalogo." action={<LinkButton to="/catalogo">Vai al catalogo</LinkButton>} />
    </div>
  );
}

function useAfterLogin() {
  const [sp] = useSearch();
  const next = sp.get('next');
  return (isStaff: boolean) => navigate(next && next.startsWith('/') ? next : isStaff ? '/gestionale' : '/account', { replace: true });
}

function DemoAccess() {
  const { demoLogin } = useAuth();
  const after = useAfterLogin();
  if (!isDemo) return null;
  return (
    <Card title="Versione dimostrativa" tone="accent">
      <p className="muted">Entra con un account di prova per vedere l’area clienti o il gestionale con dati già pronti.</p>
      <div className="row-actions">
        <Button variant="dark" onClick={async () => { await demoLogin('cliente'); after(false); }}>Entra come cliente</Button>
        <Button variant="ghost" onClick={async () => { await demoLogin('titolare'); after(true); }}>Entra nel gestionale</Button>
      </div>
    </Card>
  );
}

export function LoginPage() {
  usePageTitle('Accedi');
  const { user, signIn, isStaff } = useAuth();
  const { run, busy } = useAction();
  const after = useAfterLogin();
  const [sp] = useSearch();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) after(isStaff);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function submit() {
    setError('');
    if (!isEmail(email) || !password) {
      setError('Inserisci email e password');
      return;
    }
    await run(() => signIn(email, password));
  }

  return (
    <div className="wrap section auth">
      <div className="auth-card">
        <h1>Accedi</h1>
        {sp.get('msg') === 'brief' && <p className="notice">Accedi o registrati per inviare il brief: quello che hai scritto è al sicuro.</p>}
        <form
          className="stack"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Input label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
          <Input label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" error={error} />
          <Button type="submit" size="lg" block busy={busy}>Accedi</Button>
        </form>
        <p className="muted">
          Non hai un account? <Link to={`/registrati${sp.get('next') ? `?next=${encodeURIComponent(sp.get('next')!)}` : ''}`}>Registrati</Link>
        </p>
      </div>
      <DemoAccess />
    </div>
  );
}

export function RegisterPage() {
  usePageTitle('Crea il tuo account');
  const { user, signUp } = useAuth();
  const { run, busy } = useAction();
  const [sp] = useSearch();
  const [f, setF] = useState({ full_name: '', email: '', phone: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((c) => ({ ...c, [k]: v }));

  useEffect(() => {
    if (user) navigate(sp.get('next') ?? '/account', { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function submit() {
    const e: Record<string, string> = {};
    if (!f.full_name.trim()) e.full_name = 'Indica nome e cognome';
    if (!isEmail(f.email)) e.email = 'Email non valida';
    if (f.password.length < 6) e.password = 'Almeno 6 caratteri';
    setErrors(e);
    if (Object.keys(e).length) return;
    const r = await run(() => signUp(f));
    if (r?.needsConfirmation) setConfirm(true);
  }

  if (confirm) {
    return (
      <div className="wrap section auth">
        <div className="auth-card">
          <h1>Controlla la tua email</h1>
          <p className="lead">Ti abbiamo scritto a {f.email}. Apri il link per confermare l’account, poi torna qui ad accedere.</p>
          <LinkButton to="/accedi">Vai all’accesso</LinkButton>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap section auth">
      <div className="auth-card">
        <h1>Crea il tuo account</h1>
        <p className="muted">Con l’account segui gli ordini, approvi le bozze e salvi la tua moto nel garage.</p>
        <form
          className="stack"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Input label="Nome e cognome" value={f.full_name} onChange={set('full_name')} autoComplete="name" error={errors.full_name} />
          <Input label="Email" type="email" value={f.email} onChange={set('email')} autoComplete="email" error={errors.email} />
          <Input label="Telefono" type="tel" value={f.phone} onChange={set('phone')} autoComplete="tel" optional />
          <Input label="Password" type="password" value={f.password} onChange={set('password')} autoComplete="new-password" error={errors.password} help="Almeno 6 caratteri." />
          <Button type="submit" size="lg" block busy={busy}>Crea l’account</Button>
        </form>
        <p className="muted">
          Hai già un account? <Link to={`/accedi${sp.get('next') ? `?next=${encodeURIComponent(sp.get('next')!)}` : ''}`}>Accedi</Link>
        </p>
        <small className="muted">Registrandoti accetti l’<Link to="/privacy">informativa privacy</Link>.</small>
      </div>
    </div>
  );
}
