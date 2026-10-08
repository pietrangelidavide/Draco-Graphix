import { useMemo, useState } from 'react';
import { api } from '../../data';
import { usePageTitle } from '../../router';
import { useAuth } from '../../state/auth';
import { useCatalog } from '../../state/catalog';
import { useQuery } from '../../state/useQuery';
import { useAction } from '../../state/ui';
import { useWishlist } from '../../state/wishlist';
import { AddressForm, ProductCard, emptyAddress } from '../../components/common';
import { Button, Card, Checkbox, Empty, ErrorBox, Icon, Input, LinkButton, Loading, Modal, PageHead, Select } from '../../components/ui';
import { yearChoices } from '../../lib/pricing';
import type { Address, Bike, Billing } from '../../lib/types';

interface BikeDraft {
  id?: string;
  brand: string;
  model: string;
  year: string;
  rider_name: string;
  rider_number: string;
}
const EMPTY: BikeDraft = { brand: '', model: '', year: '', rider_name: '', rider_number: '' };

export function GaragePage() {
  usePageTitle('Il mio garage');
  const { brands } = useCatalog();
  const q = useQuery(() => api.listBikes(), []);
  const [draft, setDraft] = useState<BikeDraft | null>(null);
  const { run, busy } = useAction();
  const years = useMemo(() => yearChoices(), []);
  const set = (k: keyof BikeDraft) => (v: string) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  function edit(b: Bike) {
    setDraft({ id: b.id, brand: b.brand, model: b.model, year: b.year ? String(b.year) : '', rider_name: b.rider_name, rider_number: b.rider_number });
  }

  async function save() {
    if (!draft) return;
    const ok = await run(async () => {
      await api.saveBike({
        id: draft.id, brand: draft.brand, model: draft.model,
        year: /^\d{4}$/.test(draft.year) ? Number(draft.year) : null, rider_name: draft.rider_name, rider_number: draft.rider_number,
      });
      return true;
    }, 'Moto salvata');
    if (ok) setDraft(null);
  }

  return (
    <>
      <PageHead title="Il mio garage" sub="Salva la tua moto: quando ordini un kit compiliamo noi modello, anno, nome e numero." actions={<Button size="sm" icon="plus" onClick={() => setDraft({ ...EMPTY })}>Aggiungi una moto</Button>} />
      {q.error && !q.data ? (
        <ErrorBox message={q.error} onRetry={q.reload} />
      ) : !q.data ? (
        <Loading />
      ) : q.data.length === 0 ? (
        <Empty icon="bike" title="Il garage è vuoto" text="Aggiungi la moto con cui gareggi." action={<Button onClick={() => setDraft({ ...EMPTY })}>Aggiungi una moto</Button>} />
      ) : (
        <ul className="bikes">
          {q.data.map((b) => (
            <li key={b.id} className="bike">
              <Icon name="bike" size={28} />
              <div>
                <b>{[b.brand, b.model].filter(Boolean).join(' ')}</b>
                <span>{b.year ?? 'Anno non indicato'}</span>
                <small>{[b.rider_name, b.rider_number && `#${b.rider_number}`].filter(Boolean).join(' · ') || 'Nessun nome o numero'}</small>
              </div>
              <div className="bike-actions">
                <Button variant="ghost" size="sm" onClick={() => edit(b)}>Modifica</Button>
                <LinkButton to="/catalogo" variant="quiet" size="sm">Trova i kit</LinkButton>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Modal
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? 'Modifica la moto' : 'Aggiungi una moto'}
        footer={
          <>
            {draft?.id && (
              <Button variant="danger" onClick={async () => { if (await run(async () => { await api.deleteBike(draft.id!); return true; }, 'Moto eliminata')) setDraft(null); }}>
                Elimina
              </Button>
            )}
            <Button variant="ghost" onClick={() => setDraft(null)}>Annulla</Button>
            <Button busy={busy} onClick={() => void save()}>Salva</Button>
          </>
        }
      >
        {draft && (
          <div className="form-grid">
            <Select label="Marca" value={draft.brand} onChange={set('brand')} placeholder="Scegli la marca" options={[...brands.map((b) => ({ value: b.name, label: b.name })), { value: 'Altra marca', label: 'Altra marca' }]} />
            <Input label="Modello" value={draft.model} onChange={set('model')} maxLength={40} placeholder="es. CRF 450R" />
            <Select label="Annata" value={draft.year} onChange={set('year')} placeholder="Scegli l’annata" options={years.map((y) => ({ value: y.value, label: y.label }))} />
            <Input label="Numero" value={draft.rider_number} onChange={set('rider_number')} maxLength={3} inputMode="numeric" optional />
            <Input className="span-2" label="Nome o tag Instagram" value={draft.rider_name} onChange={set('rider_name')} maxLength={18} optional />
          </div>
        )}
      </Modal>
    </>
  );
}

export function WishlistPage() {
  usePageTitle('I miei preferiti');
  const { allProducts } = useCatalog();
  const wish = useWishlist();
  const items = allProducts.filter((p) => wish.ids.includes(p.id) && p.active);
  return (
    <>
      <PageHead title="Preferiti" />
      {items.length === 0 ? (
        <Empty icon="heart" title="Nessun preferito" text="Tocca il cuore su un kit per ritrovarlo qui." action={<LinkButton to="/catalogo">Sfoglia i kit</LinkButton>} />
      ) : (
        <div className="pgrid">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </>
  );
}

export function ProfilePage() {
  usePageTitle('Il mio profilo');
  const { user, refresh, signOut } = useAuth();
  const { run, busy } = useAction();
  const [name, setName] = useState(user?.full_name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [addr, setAddr] = useState<Address>(() => ({ ...emptyAddress(), ...(user?.address ?? {}) }));
  const [bill, setBill] = useState<Billing>(() => ({ ...(user?.billing ?? {}) }));
  const [news, setNews] = useState(!!user?.newsletter);
  if (!user) return null;

  async function save() {
    await run(async () => {
      await api.updateProfile({ full_name: name.trim() || user!.full_name, phone, address: addr.street.trim() ? { ...addr, country: 'IT' } : null, billing: bill, newsletter: news });
      await refresh();
    }, 'Profilo salvato');
  }

  return (
    <>
      <PageHead title="Profilo" actions={<Button variant="ghost" size="sm" icon="logout" onClick={() => void signOut()}>Esci</Button>} />
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Card title="I tuoi dati">
          <div className="form-grid">
            <Input label="Nome e cognome" value={name} onChange={setName} autoComplete="name" />
            <Input label="Telefono" type="tel" value={phone} onChange={setPhone} autoComplete="tel" />
            <Input className="span-2" label="Email" value={user.email} onChange={() => undefined} disabled help="L’email è quella con cui accedi." />
          </div>
        </Card>
        <Card title="Indirizzo di spedizione">
          <AddressForm value={addr} onChange={setAddr} />
        </Card>
        <Card title="Dati per la fattura">
          <div className="form-grid">
            <Input className="span-2" label="Ragione sociale o intestatario" value={bill.business_name ?? ''} onChange={(v) => setBill({ ...bill, business_name: v })} optional />
            <Input label="Partita IVA" value={bill.vat_number ?? ''} onChange={(v) => setBill({ ...bill, vat_number: v })} maxLength={11} inputMode="numeric" optional />
            <Input label="Codice fiscale" value={bill.tax_code ?? ''} onChange={(v) => setBill({ ...bill, tax_code: v.toUpperCase() })} maxLength={16} optional />
            <Input label="Codice SDI" value={bill.sdi_code ?? ''} onChange={(v) => setBill({ ...bill, sdi_code: v.toUpperCase() })} maxLength={7} optional />
            <Input label="PEC" type="email" value={bill.pec ?? ''} onChange={(v) => setBill({ ...bill, pec: v })} optional />
          </div>
        </Card>
        <Checkbox label="Voglio ricevere novità e offerte via email" checked={news} onChange={setNews} />
        <div className="row-actions">
          <Button type="submit" busy={busy}>Salva le modifiche</Button>
        </div>
      </form>
    </>
  );
}
