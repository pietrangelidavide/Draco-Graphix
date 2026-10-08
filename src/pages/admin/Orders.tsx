import { useEffect, useMemo, useState } from 'react';
import { api } from '../../data';
import { Link, navigate, usePageTitle } from '../../router';
import { useAdmin } from '../../state/admin';
import { useCatalog } from '../../state/catalog';
import { useQuery } from '../../state/useQuery';
import { useAction } from '../../state/ui';
import { AddressText, PAY_KIND, PaymentsList, Timeline } from '../../components/common';
import { Button, Card, Dl, Empty, Input, Loading, OrderChip, PageHead, PaymentChip, Select, Tabs, TextArea } from '../../components/ui';
import { PrintSpec } from './Production';
import { centsToInput, eur, parseEuro } from '../../lib/money';
import { ORDER_STATUS, ORDER_STATUSES, isOrderOpen, nextOrderStatus } from '../../lib/status';
import { fmtDate, fmtDateTime } from '../../lib/util';
import type { OrderFull, OrderStatus } from '../../lib/types';

type Tab = 'aperti' | 'spedire' | 'pagare' | 'tutti';

export function AdminOrdersPage() {
  usePageTitle('Ordini');
  const { orders, loading } = useAdmin();
  const [tab, setTab] = useState<Tab>('aperti');
  const [q, setQ] = useState('');

  const filters: Record<Tab, (o: OrderFull) => boolean> = {
    aperti: (o) => isOrderOpen(o.status),
    spedire: (o) => o.status === 'pronto',
    pagare: (o) => o.status !== 'annullato' && o.payment_status !== 'pagato',
    tutti: () => true,
  };
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return orders.filter(filters[tab]).filter((o) => !needle || o.number.toLowerCase().includes(needle) || (o.customer?.full_name ?? '').toLowerCase().includes(needle) || o.items.some((i) => i.name.toLowerCase().includes(needle)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, tab, q]);

  if (loading) return <Loading />;
  return (
    <>
      <PageHead title="Ordini" sub={`${orders.length} in totale`} />
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'aperti', label: 'Da lavorare', count: orders.filter(filters.aperti).length },
          { id: 'spedire', label: 'Da spedire', count: orders.filter(filters.spedire).length },
          { id: 'pagare', label: 'Da incassare', count: orders.filter(filters.pagare).length },
          { id: 'tutti', label: 'Tutti', count: orders.length },
        ]}
      />
      <div className="filters filters-1">
        <Input label="Cerca per numero, cliente o prodotto" type="search" value={q} onChange={setQ} />
      </div>
      {list.length === 0 ? (
        <Empty icon="box" title="Nessun ordine" text="Cambia filtro o cerca con altre parole." />
      ) : (
        <div className="table-wrap">
          <table className="table table-click">
            <thead>
              <tr>
                <th>Ordine</th>
                <th>Cliente</th>
                <th>Prodotti</th>
                <th className="num">Totale</th>
                <th>Pagamento</th>
                <th>Stato</th>
              </tr>
            </thead>
            <tbody>
              {list.map((o) => (
                <tr key={o.id} onClick={() => navigate(`/gestionale/ordini/${o.id}`)}>
                  <td>
                    <Link to={`/gestionale/ordini/${o.id}`}><b>{o.number}</b></Link>
                    <small>{fmtDate(o.created_at)}</small>
                  </td>
                  <td>{o.customer?.full_name}</td>
                  <td>
                    {o.items[0]?.name}
                    {o.items.length > 1 && <small> e altri {o.items.length - 1}</small>}
                  </td>
                  <td className="num">{eur(o.total_cents)}</td>
                  <td><PaymentChip status={o.payment_status} /></td>
                  <td><OrderChip status={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export function AdminOrderDetailPage({ id }: { id: string }) {
  const { settings } = useCatalog();
  const q = useQuery(() => api.getOrder(id), [id]);
  const { run, busy } = useAction();
  const o = q.data;
  usePageTitle(o ? `Ordine ${o.number}` : 'Ordine');

  const [status, setStatus] = useState<OrderStatus>('ricevuto');
  const [statusNote, setStatusNote] = useState('');
  const [courier, setCourier] = useState('');
  const [tracking, setTracking] = useState('');
  const [staffNote, setStaffNote] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('bonifico');
  const [payRef, setPayRef] = useState('');

  const sync = o ? `${o.id}|${o.status}|${o.courier}|${o.tracking_code}|${o.staff_note}` : '';
  useEffect(() => {
    if (!o) return;
    setStatus(o.status);
    setCourier(o.courier || settings.couriers[0] || '');
    setTracking(o.tracking_code);
    setStaffNote(o.staff_note);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sync]);
  const paid = o ? o.payments.filter((p) => p.status === 'ricevuto').reduce((t, p) => t + p.amount_cents, 0) : 0;
  const due = o ? Math.max(0, o.total_cents - paid) : 0;
  useEffect(() => {
    setPayAmount(centsToInput(due));
  }, [due]);

  if (q.loading && !o) return <Loading />;
  if (!o) return <Empty icon="box" title="Ordine non trovato" />;
  const next = nextOrderStatus(o.status);
  const pending = o.payments.filter((p) => p.status === 'in_attesa');

  async function saveShipping(markShipped: boolean) {
    await run(async () => {
      await api.updateOrder(o!.id, { courier, tracking_code: tracking.trim() });
      if (markShipped && tracking.trim() && o!.status !== 'spedito' && o!.status !== 'consegnato') await api.setOrderStatus(o!.id, 'spedito', `${courier} ${tracking.trim()}`);
    }, markShipped ? 'Spedizione registrata' : 'Salvato');
  }

  return (
    <>
      <PageHead
        back={{ to: '/gestionale/ordini', label: 'Ordini' }}
        title={`Ordine ${o.number}`}
        sub={`${fmtDateTime(o.created_at)} · ${o.customer?.full_name ?? ''}`}
        actions={
          <>
            <OrderChip status={o.status} />
            <PaymentChip status={o.payment_status} />
            <Button variant="ghost" size="sm" icon="print" onClick={() => window.print()}>Stampa scheda</Button>
            {next && next !== 'spedito' && o.status !== 'ricevuto' && (
              <Button size="sm" busy={busy} onClick={() => void run(() => api.setOrderStatus(o.id, next), ORDER_STATUS[next].label)}>
                Avanti: {ORDER_STATUS[next].label}
              </Button>
            )}
          </>
        }
      />

      <div className="detail-grid">
        <div className="stack">
          <Card title="Da produrre">
            <div className="stack">
              {o.items.map((i) => (
                <div key={i.id} className="job-item">
                  <p>
                    <b>{i.qty} × {i.name}</b> <span className="muted">{eur(i.unit_price_cents)} cad.</span>
                  </p>
                  <PrintSpec config={i.config} />
                </div>
              ))}
            </div>
            {o.customer_note && <p className="job-note">Nota del cliente: {o.customer_note}</p>}
            <Dl rows={[['Spedizione', o.shipping_cents ? eur(o.shipping_cents) : 'Gratis'], ['Totale', <b key="t">{eur(o.total_cents)}</b>]]} />
          </Card>
          <Card title="Cliente e consegna">
            <div className="two-col">
              <div>
                <p>
                  <Link to={`/gestionale/clienti/${o.user_id}`}><b>{o.customer?.full_name}</b></Link>
                  <br />
                  <a href={`mailto:${o.customer?.email}`}>{o.customer?.email}</a>
                  <br />
                  {o.customer?.phone}
                </p>
                {(o.billing.vat_number || o.billing.tax_code) && (
                  <Dl rows={[['Fattura a', o.billing.business_name || '—'], ['P.IVA', o.billing.vat_number || '—'], ['C.F.', o.billing.tax_code || '—'], ['SDI / PEC', [o.billing.sdi_code, o.billing.pec].filter(Boolean).join(' · ') || '—']]} />
                )}
              </div>
              <AddressText a={o.shipping_address} />
            </div>
          </Card>
          <Card title="Cronologia">
            <Timeline events={o.events} />
          </Card>
        </div>

        <div className="stack">
          <Card title="Stato">
            <Select label="Stato dell’ordine" value={status} onChange={(v) => setStatus(v as OrderStatus)} options={ORDER_STATUSES.map((s) => ({ value: s, label: ORDER_STATUS[s].label }))} />
            <Input label="Nota (la vede il cliente)" value={statusNote} onChange={setStatusNote} optional />
            <Button
              busy={busy}
              disabled={status === o.status}
              onClick={() => void run(async () => { await api.setOrderStatus(o.id, status, statusNote); setStatusNote(''); }, 'Stato aggiornato')}
            >
              Aggiorna lo stato
            </Button>
            <small className="muted">Il cliente riceve una notifica a ogni cambio di stato.</small>
          </Card>

          <Card title="Pagamenti" actions={<small className="muted">Da incassare: {eur(due)}</small>}>
            <PaymentsList payments={o.payments} />
            {pending.map((p) => (
              <Button key={p.id} variant="dark" busy={busy} onClick={() => void run(() => api.confirmPayment(p.id), 'Pagamento registrato')}>
                Conferma ricevuto · {PAY_KIND[p.kind]} {eur(p.amount_cents)}
              </Button>
            ))}
            {due > 0 && pending.length === 0 && (
              <div className="stack">
                <div className="form-grid">
                  <Input label="Importo ricevuto" value={payAmount} onChange={setPayAmount} prefix="€" inputMode="decimal" />
                  <Select label="Metodo" value={payMethod} onChange={setPayMethod} options={[...settings.payment_methods.map((m) => ({ value: m.id, label: m.label })), { value: 'contanti', label: 'Contanti' }]} />
                  <Input className="span-2" label="Riferimento (CRO, id transazione)" value={payRef} onChange={setPayRef} optional />
                </div>
                <Button
                  busy={busy}
                  variant="ghost"
                  onClick={() => {
                    const cents = parseEuro(payAmount);
                    if (!cents) return;
                    void run(() => api.recordPayment({ order_id: o.id, kind: 'ordine', amount_cents: cents, method: payMethod, reference: payRef }), 'Pagamento registrato');
                  }}
                >
                  Registra pagamento
                </Button>
              </div>
            )}
          </Card>

          <Card title="Spedizione">
            <Select label="Corriere" value={courier} onChange={setCourier} options={settings.couriers.map((c) => ({ value: c, label: c }))} />
            <Input label="Codice di tracciamento" value={tracking} onChange={setTracking} />
            <div className="row-actions">
              <Button busy={busy} onClick={() => void saveShipping(true)} disabled={!tracking.trim()} icon="truck">
                {o.status === 'spedito' || o.status === 'consegnato' ? 'Aggiorna' : 'Segna come spedito'}
              </Button>
              <Button variant="ghost" busy={busy} onClick={() => void saveShipping(false)}>Solo salva</Button>
            </div>
          </Card>

          <Card title="Nota interna">
            <TextArea label="Visibile solo allo staff" value={staffNote} onChange={setStaffNote} rows={3} />
            <Button variant="ghost" busy={busy} onClick={() => void run(() => api.updateOrder(o.id, { staff_note: staffNote }), 'Nota salvata')}>Salva la nota</Button>
          </Card>
        </div>
      </div>

      <section className="ticket" aria-hidden="true">
        <h1>Scheda lavoro · {o.number}</h1>
        <p>{fmtDateTime(o.created_at)} — {o.customer?.full_name}</p>
        {o.items.map((i) => (
          <div key={i.id} className="ticket-item">
            <h2>{i.qty} × {i.name}</h2>
            <dl>
              {i.config.map((c) => (
                <div key={c.key}>
                  <dt>{c.label}</dt>
                  <dd>{c.value_label}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
        {o.customer_note && <p>Nota del cliente: {o.customer_note}</p>}
        <p>
          Spedire a: {o.shipping_address.name}, {o.shipping_address.street}, {o.shipping_address.zip} {o.shipping_address.city} ({o.shipping_address.province}) · tel. {o.shipping_address.phone}
        </p>
      </section>
    </>
  );
}
