import { useState } from 'react';
import { api, isDemo } from '../../data';
import { usePageTitle } from '../../router';
import { useAuth } from '../../state/auth';
import { useCatalog } from '../../state/catalog';
import { useAction } from '../../state/ui';
import { Button, Card, Checkbox, Empty, Input, Loading, PageHead, TextArea } from '../../components/ui';
import { centsToInput, parseEuro } from '../../lib/money';
import type { Settings } from '../../lib/types';

export function AdminSettingsPage() {
  usePageTitle('Impostazioni');
  const { isAdmin } = useAuth();
  const { settings, loading } = useCatalog();
  if (loading) return <Loading />;
  if (!isAdmin) return <Empty icon="cog" title="Solo il titolare" text="Le impostazioni dell’attività le cambia il titolare." />;
  return <Form initial={settings} />;
}

function Form({ initial }: { initial: Settings }) {
  const { run, busy } = useAction();
  const [s, setS] = useState<Settings>(() => JSON.parse(JSON.stringify(initial)) as Settings);
  const [deposit, setDeposit] = useState(centsToInput(initial.deposit_cents));
  const [ship, setShip] = useState(centsToInput(initial.shipping_flat_cents));
  const [free, setFree] = useState(initial.shipping_free_over_cents == null ? '' : centsToInput(initial.shipping_free_over_cents));
  const [couriers, setCouriers] = useState(initial.couriers.join('\n'));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const company = (k: keyof Settings['company']) => (v: string) => setS((c) => ({ ...c, company: { ...c.company, [k]: v } }));

  async function save() {
    const e: Record<string, string> = {};
    const dep = parseEuro(deposit);
    const sh = parseEuro(ship);
    const fr = free.trim() === '' ? null : parseEuro(free);
    if (dep == null) e.deposit = 'Importo non valido';
    if (sh == null) e.ship = 'Importo non valido';
    if (free.trim() !== '' && fr == null) e.free = 'Importo non valido';
    if (!(s.vat_percent >= 0 && s.vat_percent <= 30)) e.vat = 'Da 0 a 30';
    if (!s.payment_methods.some((m) => m.enabled)) e.methods = 'Attiva almeno un metodo di pagamento.';
    if (!s.company.name.trim()) e.name = 'Indica il nome dell’attività';
    setErrors(e);
    if (Object.keys(e).length) return;
    await run(
      () =>
        api.saveSettings({
          ...s,
          deposit_cents: dep!,
          shipping_flat_cents: sh!,
          shipping_free_over_cents: fr,
          couriers: couriers.split('\n').map((c) => c.trim()).filter(Boolean),
        }),
      'Impostazioni salvate',
    );
  }

  return (
    <>
      <PageHead title="Impostazioni" sub="Dati dell’attività, prezzi, pagamenti e testi legali." actions={<Button busy={busy} onClick={() => void save()}>Salva</Button>} />
      <form className="stack" noValidate onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <Card title="Attività">
          <div className="form-grid">
            <Input label="Nome" value={s.company.name} onChange={company('name')} error={errors.name} />
            <Input label="Partita IVA" value={s.company.vat_number} onChange={company('vat_number')} />
            <Input label="Email" type="email" value={s.company.email} onChange={company('email')} />
            <Input label="Telefono" type="tel" value={s.company.phone} onChange={company('phone')} />
            <Input label="Instagram" value={s.company.instagram} onChange={company('instagram')} />
            <Input label="Facebook" value={s.company.facebook} onChange={company('facebook')} />
            <Input className="span-2" label="Indirizzo del laboratorio" value={s.company.address} onChange={company('address')} optional />
          </div>
        </Card>

        <Card title="Prezzi e spedizione">
          <div className="form-grid">
            <Input label="Acconto per le grafiche su misura" prefix="€" value={deposit} onChange={setDeposit} inputMode="decimal" error={errors.deposit} help="Viene scalato dal prezzo finale." />
            <Input label="IVA %" value={String(s.vat_percent)} onChange={(v) => setS({ ...s, vat_percent: Number(v) || 0 })} inputMode="numeric" error={errors.vat} help="I prezzi del catalogo sono IVA inclusa." />
            <Input label="Spedizione" prefix="€" value={ship} onChange={setShip} inputMode="decimal" error={errors.ship} help="Costo fisso per ordine." />
            <Input label="Spedizione gratuita sopra" prefix="€" value={free} onChange={setFree} inputMode="decimal" error={errors.free} optional help="Vuoto = mai gratuita." />
            <TextArea className="span-2" label="Tempi di produzione e consegna" value={s.lead_time} onChange={(v) => setS({ ...s, lead_time: v })} rows={2} help="Compare in home, nelle schede e nel checkout." />
          </div>
        </Card>

        <Card title="Pagamenti">
          {errors.methods && <p className="err" role="alert">{errors.methods}</p>}
          {s.payment_methods.map((m, i) => (
            <div key={m.id} className="method-ed">
              <Checkbox label={`${m.label}${m.enabled ? '' : ' (non attivo)'}`} checked={m.enabled} onChange={(v) => setS({ ...s, payment_methods: s.payment_methods.map((x, j) => (j === i ? { ...x, enabled: v } : x)) })} />
              <TextArea label="Istruzioni mostrate al cliente" value={m.instructions} onChange={(v) => setS({ ...s, payment_methods: s.payment_methods.map((x, j) => (j === i ? { ...x, instructions: v } : x)) })} rows={3} help={m.id === 'bonifico' ? 'Scrivi qui l’IBAN e l’intestatario del conto.' : m.id === 'paypal' ? 'Scrivi qui il link PayPal.Me o l’indirizzo PayPal.' : undefined} />
            </div>
          ))}
          <p className="notice">Il pagamento con carta online arriva con la connessione a Stripe: vedi la guida nella cartella docs.</p>
        </Card>

        <Card title="Corrieri">
          <TextArea label="Un corriere per riga" value={couriers} onChange={setCouriers} rows={5} />
        </Card>

        <Card title="Testi legali">
          <p className="notice">Le bozze sono generiche: fai verificare i testi da un consulente prima di pubblicare il sito.</p>
          <TextArea label="Informativa privacy" value={s.privacy_text} onChange={(v) => setS({ ...s, privacy_text: v })} rows={10} />
          <TextArea label="Condizioni di vendita" value={s.terms_text} onChange={(v) => setS({ ...s, terms_text: v })} rows={10} />
        </Card>

        <div className="row-actions">
          <Button type="submit" busy={busy}>Salva le impostazioni</Button>
          {isDemo && <small className="muted">In demo i dati restano nel tuo browser.</small>}
        </div>
      </form>
    </>
  );
}
