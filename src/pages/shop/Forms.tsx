import { useState } from 'react';
import { api } from '../../data';
import { usePageTitle } from '../../router';
import { useAuth } from '../../state/auth';
import { useCatalog } from '../../state/catalog';
import { useAction } from '../../state/ui';
import { Button, Card, Icon, Input, LinkButton, PageHead, Select, TextArea } from '../../components/ui';
import { isEmail } from '../../lib/util';

/** Campo nascosto: i programmi automatici lo riempiono, le persone no. */
function Honeypot({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="hp" aria-hidden="true">
      <label>
        Non compilare
        <input tabIndex={-1} autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
    </div>
  );
}

export function TeamPage() {
  usePageTitle('Team e motoclub');
  const { user } = useAuth();
  const { run, busy } = useAction();
  const [f, setF] = useState({
    name: user?.full_name ?? '', email: user?.email ?? '', phone: user?.phone ?? '', team_name: '', riders: '5', bike_type: 'Cross', service: 'Kit grafiche complete', message: '', hp: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((c) => ({ ...c, [k]: v }));

  async function submit() {
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = 'Indica il tuo nome';
    if (!isEmail(f.email)) e.email = 'Email non valida';
    if (!f.team_name.trim()) e.team_name = 'Indica il nome del team o del motoclub';
    if (!(Number(f.riders) >= 1)) e.riders = 'Almeno 1 pilota';
    setErrors(e);
    if (Object.keys(e).length) return;
    if (f.hp) {
      setSent(true);
      return;
    }
    const ok = await run(async () => {
      await api.submitQuote({
        contact: { name: f.name, email: f.email, phone: f.phone },
        team_name: f.team_name, riders: Number(f.riders), bike_type: f.bike_type, service: f.service, message: f.message,
      });
      return true;
    });
    if (ok) setSent(true);
  }

  if (sent) {
    return (
      <div className="wrap section narrow">
        <div className="done-head">
          <span className="done-check"><Icon name="check" size={28} /></span>
          <h1>Richiesta inviata</h1>
          <p className="lead">Ti rispondiamo con un preventivo entro un giorno lavorativo, all’indirizzo {f.email}.</p>
          <LinkButton to="/catalogo" variant="ghost">Intanto guarda il catalogo</LinkButton>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap section narrow">
      <PageHead title="Team e motoclub" sub="Stessa grafica per più piloti, prezzo dedicato. Compila la richiesta: ti mandiamo un preventivo." />
      <form
        className="stack"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Card title="Chi sei">
          <div className="form-grid">
            <Input label="Nome e cognome" value={f.name} onChange={set('name')} autoComplete="name" error={errors.name} />
            <Input label="Email" type="email" value={f.email} onChange={set('email')} autoComplete="email" error={errors.email} />
            <Input label="Telefono" type="tel" value={f.phone} onChange={set('phone')} autoComplete="tel" optional />
            <Input label="Nome del team o motoclub" value={f.team_name} onChange={set('team_name')} error={errors.team_name} />
          </div>
        </Card>
        <Card title="Cosa serve">
          <div className="form-grid">
            <Input label="Numero di piloti" type="number" min="1" value={f.riders} onChange={set('riders')} inputMode="numeric" error={errors.riders} />
            <Select label="Tipo di moto" value={f.bike_type} onChange={set('bike_type')} options={['Cross', 'Enduro', 'Supermotard', 'Moto miste'].map((v) => ({ value: v, label: v }))} />
            <Select className="span-2" label="Di cosa hai bisogno" value={f.service} onChange={set('service')} options={['Kit grafiche complete', 'Kit con numeri e nomi diversi per ogni pilota', 'Solo tabelle e numeri', 'Altro'].map((v) => ({ value: v, label: v }))} />
            <TextArea className="span-2" label="Dettagli" value={f.message} onChange={set('message')} rows={4} maxLength={1500} optional placeholder="Colori del team, scadenze, modelli di moto, loghi degli sponsor" />
          </div>
        </Card>
        <Honeypot value={f.hp} onChange={set('hp')} />
        <div className="row-actions">
          <Button type="submit" size="lg" busy={busy} className="slant">Chiedi il preventivo</Button>
          <small className="muted">Nessun impegno. Il preventivo è gratuito.</small>
        </div>
      </form>
    </div>
  );
}

export function ContactPage() {
  usePageTitle('Contatti');
  const { user } = useAuth();
  const { settings } = useCatalog();
  const { run, busy } = useAction();
  const [f, setF] = useState({ name: user?.full_name ?? '', email: user?.email ?? '', phone: user?.phone ?? '', message: '', hp: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((c) => ({ ...c, [k]: v }));
  const c = settings.company;

  async function submit() {
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = 'Indica il tuo nome';
    if (!isEmail(f.email)) e.email = 'Email non valida';
    if (!f.message.trim()) e.message = 'Scrivi un messaggio';
    setErrors(e);
    if (Object.keys(e).length) return;
    if (f.hp) {
      setSent(true);
      return;
    }
    const ok = await run(async () => {
      await api.submitLead({ kind: 'contatto', name: f.name, email: f.email, phone: f.phone, message: f.message });
      return true;
    });
    if (ok) setSent(true);
  }

  return (
    <div className="wrap section">
      <PageHead title="Contatti" sub="Hai dubbi sul modello giusto o sui materiali? Scrivici, rispondiamo noi." />
      <div className="cart-grid">
        {sent ? (
          <div className="done-head">
            <span className="done-check"><Icon name="check" size={28} /></span>
            <h2>Messaggio inviato</h2>
            <p className="lead">Ti rispondiamo appena possibile all’indirizzo {f.email}.</p>
          </div>
        ) : (
          <form
            className="stack"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <Card>
              <div className="form-grid">
                <Input label="Nome" value={f.name} onChange={set('name')} autoComplete="name" error={errors.name} />
                <Input label="Email" type="email" value={f.email} onChange={set('email')} autoComplete="email" error={errors.email} />
                <Input className="span-2" label="Telefono" type="tel" value={f.phone} onChange={set('phone')} autoComplete="tel" optional />
                <TextArea className="span-2" label="Messaggio" value={f.message} onChange={set('message')} rows={6} maxLength={1500} error={errors.message} />
              </div>
              <Honeypot value={f.hp} onChange={set('hp')} />
              <Button type="submit" size="lg" busy={busy} className="slant">Invia il messaggio</Button>
            </Card>
          </form>
        )}
        <Card title="Scrivici o chiamaci" className="summary">
          <ul className="contact-list">
            <li><Icon name="mail" /> <a href={`mailto:${c.email}`}>{c.email}</a></li>
            <li><Icon name="chat" /> {c.phone} <small className="muted">(anche WhatsApp)</small></li>
            {c.instagram && <li><Icon name="heart" /> Instagram {c.instagram}</li>}
            {c.facebook && <li><Icon name="users" /> {c.facebook}</li>}
          </ul>
          <p className="muted">{settings.lead_time}</p>
        </Card>
      </div>
    </div>
  );
}
