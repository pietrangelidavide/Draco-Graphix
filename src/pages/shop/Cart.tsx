import { useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../../data';
import { Link, navigate, usePageTitle } from '../../router';
import { useAuth } from '../../state/auth';
import { useCart } from '../../state/cart';
import { useCatalog } from '../../state/catalog';
import { useQuery } from '../../state/useQuery';
import { useAction } from '../../state/ui';
import { KitArt } from '../../components/art';
import { AddressForm, AddressText, PaymentBox, RequireAuth, emptyAddress } from '../../components/common';
import { Button, Card, Checkbox, ChoiceGroup, Dl, Empty, Icon, Input, Loading, LinkButton, PageHead, TextArea } from '../../components/ui';
import { eur, vatIncluded } from '../../lib/money';
import { addressComplete, configSummary } from '../../lib/pricing';
import { isEmail } from '../../lib/util';
import type { Address, Billing } from '../../lib/types';

function Summary({ cta }: { cta?: ReactNode }) {
  const cart = useCart();
  const { settings } = useCatalog();
  const t = cart.totals;
  const toFree = settings.shipping_free_over_cents != null && t.shipping_cents > 0 ? settings.shipping_free_over_cents - t.subtotal_cents : 0;
  return (
    <Card title="Riepilogo" className="summary">
      <Dl
        rows={[
          ['Prodotti', eur(t.subtotal_cents)],
          ['Spedizione', t.shipping_cents === 0 ? 'Gratis' : eur(t.shipping_cents)],
        ]}
      />
      <p className="sum-total">
        <span>Totale</span>
        <strong>{eur(t.total_cents)}</strong>
      </p>
      <small className="muted">di cui IVA {settings.vat_percent}%: {eur(vatIncluded(t.total_cents, settings.vat_percent))}</small>
      {toFree > 0 && <p className="notice">Ti mancano {eur(toFree)} per la spedizione gratuita.</p>}
      {cta}
    </Card>
  );
}

export function CartPage() {
  usePageTitle('Carrello');
  const cart = useCart();
  const { loading } = useCatalog();
  if (loading) return <div className="wrap section"><Loading /></div>;
  if (cart.lines.length === 0) {
    return (
      <div className="wrap section">
        <PageHead title="Carrello" />
        <Empty icon="cart" title="Il carrello è vuoto" text="Scegli un kit e indica modello, anno, nome e numero." action={<LinkButton to="/catalogo">Vai al catalogo</LinkButton>} />
      </div>
    );
  }
  return (
    <div className="wrap section">
      <PageHead title="Carrello" sub={`${cart.count} ${cart.count === 1 ? 'articolo' : 'articoli'}`} />
      <div className="cart-grid">
        <ul className="cart-lines">
          {cart.lines.map((l) => (
            <li key={l.key}>
              <Link to={`/prodotto/${l.product.slug}`} className="cart-art" aria-label={l.product.name}>
                <KitArt product={l.product} />
              </Link>
              <div className="cart-info">
                <h3>
                  <Link to={`/prodotto/${l.product.slug}`}>{l.product.name}</Link>
                </h3>
                <p className="muted">{configSummary(l.config)}</p>
                <div className="cart-ctl">
                  <div className="qty" role="group" aria-label={`Quantità di ${l.product.name}`}>
                    <button type="button" aria-label="Meno" onClick={() => cart.setQty(l.key, l.qty - 1)} disabled={l.qty <= 1}>
                      <Icon name="minus" size={16} />
                    </button>
                    <output>{l.qty}</output>
                    <button type="button" aria-label="Più" onClick={() => cart.setQty(l.key, l.qty + 1)}>
                      <Icon name="plus" size={16} />
                    </button>
                  </div>
                  <button type="button" className="link-btn" onClick={() => cart.remove(l.key)}>
                    <Icon name="trash" size={16} /> Togli
                  </button>
                </div>
              </div>
              <strong className="cart-price">{eur(l.unit_price_cents * l.qty)}</strong>
            </li>
          ))}
        </ul>
        <Summary
          cta={
            <Button block size="lg" onClick={() => navigate('/checkout')}>
              Vai al pagamento
            </Button>
          }
        />
      </div>
    </div>
  );
}

// ---------- checkout ----------
function CheckoutForm() {
  const { user, refresh } = useAuth();
  const cart = useCart();
  const { settings } = useCatalog();
  const { run, busy } = useAction();
  const methods = settings.payment_methods.filter((m) => m.enabled);

  const [addr, setAddr] = useState<Address>(() => ({ ...emptyAddress(), name: user?.full_name ?? '', phone: user?.phone ?? '', ...(user?.address ?? {}) }));
  const [invoice, setInvoice] = useState(() => !!user?.billing?.vat_number || !!user?.billing?.tax_code);
  const [bill, setBill] = useState<Billing>(() => ({ ...(user?.billing ?? {}) }));
  const [note, setNote] = useState('');
  const [method, setMethod] = useState(methods[0]?.id ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [agree, setAgree] = useState(false);

  function validate() {
    const e: Record<string, string> = {};
    if (!addr.name?.trim()) e.name = 'Indica il destinatario';
    if (!addr.street.trim()) e.street = 'Indica via e numero';
    if (!/^\d{5}$/.test(addr.zip.trim())) e.zip = 'Il CAP ha 5 cifre';
    if (!addr.city.trim()) e.city = 'Indica la città';
    if (!/^[A-Za-z]{2}$/.test(addr.province.trim())) e.province = 'Sigla di 2 lettere';
    if (!addr.phone?.trim()) e.phone = 'Serve per il corriere';
    if (invoice && !bill.vat_number?.trim() && !bill.tax_code?.trim()) e.fiscal = 'Indica partita IVA o codice fiscale';
    if (invoice && bill.pec && !isEmail(bill.pec)) e.pec = 'PEC non valida';
    if (!method) e.method = 'Scegli come pagare';
    if (!agree) e.agree = 'Devi accettare le condizioni';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit() {
    if (!validate() || !addressComplete(addr)) return;
    const order = await run(async () => {
      const o = await api.createOrder({
        items: cart.items.map((i) => ({ product_id: i.product_id, qty: i.qty, selections: i.selections })),
        shipping_address: { ...addr, country: 'IT' },
        billing: invoice ? bill : {},
        customer_note: note,
        payment_method: method,
      });
      if (!user?.address) {
        try {
          await api.updateProfile({ address: { ...addr, country: 'IT' }, phone: user?.phone || addr.phone || '', ...(invoice ? { billing: bill } : {}) });
          await refresh();
        } catch {
          /* il salvataggio dell'indirizzo è un comodo, non blocca l'ordine */
        }
      }
      return o;
    });
    if (order) {
      cart.clear();
      navigate(`/ordine-completato/${order.id}`);
    }
  }

  return (
    <form
      className="cart-grid"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="stack">
        <Card title="Dove spediamo">
          <AddressForm value={addr} onChange={setAddr} errors={errors} />
        </Card>
        <Card title="Fattura">
          <Checkbox label="Mi serve la fattura (partita IVA o team)" checked={invoice} onChange={setInvoice} />
          {invoice && (
            <div className="form-grid">
              <Input className="span-2" label="Ragione sociale o intestatario" value={bill.business_name ?? ''} onChange={(v) => setBill({ ...bill, business_name: v })} />
              <Input label="Partita IVA" value={bill.vat_number ?? ''} onChange={(v) => setBill({ ...bill, vat_number: v })} inputMode="numeric" maxLength={11} error={errors.fiscal} />
              <Input label="Codice fiscale" value={bill.tax_code ?? ''} onChange={(v) => setBill({ ...bill, tax_code: v.toUpperCase() })} maxLength={16} />
              <Input label="Codice SDI" value={bill.sdi_code ?? ''} onChange={(v) => setBill({ ...bill, sdi_code: v.toUpperCase() })} maxLength={7} optional />
              <Input label="PEC" type="email" value={bill.pec ?? ''} onChange={(v) => setBill({ ...bill, pec: v })} error={errors.pec} optional />
            </div>
          )}
        </Card>
        <Card title="Come paghi">
          <ChoiceGroup label="Metodo di pagamento" value={method} onChange={setMethod} error={errors.method} options={methods.map((m) => ({ value: m.id, label: m.label }))} />
          {methods.find((m) => m.id === method) && <p className="muted">{methods.find((m) => m.id === method)!.instructions}</p>}
        </Card>
        <Card title="Note per noi">
          <TextArea label="Messaggio" value={note} onChange={setNote} rows={3} maxLength={500} optional placeholder="Per esempio: orario per il corriere, dettagli sulla grafica" />
        </Card>
      </div>
      <div className="stack">
        <Card title="Il tuo ordine" className="summary">
          <ul className="mini-lines">
            {cart.lines.map((l) => (
              <li key={l.key}>
                <span>
                  {l.qty} × {l.product.name}
                  <small>{configSummary(l.config)}</small>
                </span>
                <b>{eur(l.unit_price_cents * l.qty)}</b>
              </li>
            ))}
          </ul>
          <Dl rows={[['Spedizione', cart.totals.shipping_cents === 0 ? 'Gratis' : eur(cart.totals.shipping_cents)]]} />
          <p className="sum-total">
            <span>Totale</span>
            <strong>{eur(cart.totals.total_cents)}</strong>
          </p>
          <Checkbox checked={agree} onChange={setAgree}>
            Ho letto le <Link to="/condizioni">condizioni di vendita</Link> e l’<Link to="/privacy">informativa privacy</Link>.
          </Checkbox>
          {errors.agree && <p className="err" role="alert">{errors.agree}</p>}
          <Button type="submit" block size="lg" busy={busy}>
            Conferma l’ordine
          </Button>
        </Card>
      </div>
    </form>
  );
}

export function CheckoutPage() {
  usePageTitle('Pagamento');
  const cart = useCart();
  const { loading } = useCatalog();
  return (
    <RequireAuth>
      <div className="wrap section">
        <PageHead title="Pagamento" back={{ to: '/carrello', label: 'Carrello' }} />
        {loading ? <Loading /> : cart.lines.length === 0 ? <Empty icon="cart" title="Il carrello è vuoto" action={<LinkButton to="/catalogo">Vai al catalogo</LinkButton>} /> : <CheckoutForm />}
      </div>
    </RequireAuth>
  );
}

export function OrderDonePage({ id }: { id: string }) {
  usePageTitle('Ordine ricevuto');
  const { settings } = useCatalog();
  const q = useQuery(() => api.getOrder(id), [id]);
  const o = q.data;
  return (
    <RequireAuth>
      <div className="wrap section narrow">
        {q.loading && !o ? (
          <Loading />
        ) : !o ? (
          <Empty icon="box" title="Ordine non trovato" action={<LinkButton to="/account/ordini">I miei ordini</LinkButton>} />
        ) : (
          <>
            <div className="done-head">
              <span className="done-check"><Icon name="check" size={28} /></span>
              <h1>Ordine ricevuto</h1>
              <p className="lead">
                Grazie! Il tuo ordine è <b>{o.number}</b>. {o.payment_status === 'pagato' ? 'Abbiamo ricevuto il pagamento.' : 'Completa il pagamento per avviare la produzione.'}
              </p>
            </div>
            <PaymentBox payments={o.payments} settings={settings} reference={o.number} />
            <Card title="Cosa succede adesso">
              <ol className="steps4 steps-compact">
                <li><b>Pagamento</b><span>Appena lo riceviamo, passiamo alla preparazione dei file.</span></li>
                <li><b>Stampa</b><span>{settings.lead_time}</span></li>
                <li><b>Spedizione</b><span>Ti avvisiamo qui e nelle notifiche con il codice di tracciamento.</span></li>
              </ol>
            </Card>
            <Card title="Spediamo a">
              <AddressText a={o.shipping_address} />
            </Card>
            <div className="row-actions">
              <LinkButton to={`/account/ordini/${o.id}`}>Segui l’ordine</LinkButton>
              <LinkButton to="/catalogo" variant="ghost">Continua a guardare</LinkButton>
            </div>
          </>
        )}
      </div>
    </RequireAuth>
  );
}
