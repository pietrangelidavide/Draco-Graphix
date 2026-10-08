import type { ReactNode } from 'react';
import { api } from '../../data';
import { Link, usePageTitle, usePath } from '../../router';
import { useAuth } from '../../state/auth';
import { useCatalog } from '../../state/catalog';
import { useQuery } from '../../state/useQuery';
import { useAction } from '../../state/ui';
import { AddressText, PaymentBox, PaymentsList, RequireAuth, Timeline, TrackingText } from '../../components/common';
import { Card, Dl, Empty, ErrorBox, Icon, LinkButton, Loading, OrderChip, PageHead, PaymentChip, ProjectChip, QuoteChip, Stepper } from '../../components/ui';
import { eur } from '../../lib/money';
import { configSummary } from '../../lib/pricing';
import { ORDER_FLOW, ORDER_STATUS, PROJECT_STATUS, isOrderOpen, isProjectOpen } from '../../lib/status';
import { fmtDate, timeAgo } from '../../lib/util';
import type { OrderFull } from '../../lib/types';

const TABS = [
  { to: '/account', label: 'Panoramica', exact: true },
  { to: '/account/ordini', label: 'Ordini' },
  { to: '/account/progetti', label: 'Grafiche su misura' },
  { to: '/account/preventivi', label: 'Preventivi' },
  { to: '/account/garage', label: 'Garage' },
  { to: '/account/preferiti', label: 'Preferiti' },
  { to: '/account/profilo', label: 'Profilo' },
];

export function AccountLayout({ children }: { children: ReactNode }) {
  const path = usePath();
  return (
    <RequireAuth>
      <div className="wrap section">
        <nav className="subnav" aria-label="Area clienti">
          {TABS.map((t) => {
            const on = t.exact ? path === t.to : path === t.to || path.startsWith(`${t.to}/`);
            return (
              <Link key={t.to} to={t.to} aria-current={on ? 'page' : undefined} className={on ? 'on' : ''}>
                {t.label}
              </Link>
            );
          })}
        </nav>
        {children}
      </div>
    </RequireAuth>
  );
}

function Data<T>({ q, children }: { q: { data: T | undefined; loading: boolean; error: string | null; reload: () => void }; children: (d: T) => ReactNode }) {
  if (q.error && !q.data) return <ErrorBox message={q.error} onRetry={q.reload} />;
  if (!q.data) return <Loading />;
  return <>{children(q.data)}</>;
}

function itemsText(o: OrderFull) {
  const first = o.items[0]?.name ?? 'Ordine';
  return o.items.length > 1 ? `${first} e altri ${o.items.length - 1}` : first;
}

// ---------- panoramica ----------
export function OverviewPage() {
  usePageTitle('Il mio account');
  const { user } = useAuth();
  const q = useQuery(async () => {
    const [orders, projects, quotes] = await Promise.all([api.listOrders(), api.listProjects(), api.listQuotes()]);
    return { orders, projects, quotes };
  }, []);

  return (
    <>
      <PageHead title={`Ciao, ${user?.full_name.split(' ')[0] ?? ''}`} sub="Qui trovi ordini, bozze da approvare e il tuo garage." />
      <Data q={q}>
        {({ orders, projects, quotes }) => {
          const todo: { key: string; to: string; title: string; text: string }[] = [];
          for (const p of projects) {
            if (isProjectOpen(p.status) && PROJECT_STATUS[p.status].turn === 'cliente') todo.push({ key: p.id, to: `/account/progetti/${p.id}`, title: `${p.title} · ${PROJECT_STATUS[p.status].label}`, text: PROJECT_STATUS[p.status].customer });
          }
          for (const o of orders) {
            if (o.status !== 'annullato' && o.payment_status === 'da_pagare') todo.push({ key: o.id, to: `/account/ordini/${o.id}`, title: `Ordine ${o.number} · da pagare`, text: `Versa ${eur(o.total_cents)} per avviare la produzione.` });
          }
          for (const x of quotes) {
            if (x.status === 'inviato') todo.push({ key: x.id, to: `/account/preventivi/${x.id}`, title: `Preventivo ${x.number} pronto`, text: `${x.team_name}: ${eur(x.total_cents)}. Aprilo per accettarlo.` });
          }
          const openOrders = orders.filter((o) => isOrderOpen(o.status));
          const openProjects = projects.filter((p) => isProjectOpen(p.status));
          return (
            <div className="stack">
              {todo.length > 0 ? (
                <Card title="Tocca a te" tone="warn">
                  <ul className="todo">
                    {todo.map((t) => (
                      <li key={t.key}>
                        <Link to={t.to}>
                          <b>{t.title}</b>
                          <span>{t.text}</span>
                          <Icon name="chevron" size={18} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Card>
              ) : (
                <p className="notice notice-ok"><Icon name="check" size={18} /> Non c’è niente in attesa di te.</p>
              )}

              <div className="two-col">
                <Card title="Ordini in corso" actions={<Link to="/account/ordini" className="more">Tutti</Link>}>
                  {openOrders.length === 0 ? (
                    <p className="muted">Nessun ordine in corso. <Link to="/catalogo">Scegli un kit</Link>.</p>
                  ) : (
                    <ul className="rowlist">
                      {openOrders.slice(0, 4).map((o) => (
                        <li key={o.id}>
                          <Link to={`/account/ordini/${o.id}`}>
                            <span><b>{o.number}</b><small>{itemsText(o)}</small></span>
                            <OrderChip status={o.status} />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
                <Card title="Grafiche su misura" actions={<Link to="/account/progetti" className="more">Tutte</Link>}>
                  {openProjects.length === 0 ? (
                    <p className="muted">Nessun progetto attivo. <Link to="/su-misura">Racconta la tua idea</Link>.</p>
                  ) : (
                    <ul className="rowlist">
                      {openProjects.slice(0, 4).map((p) => (
                        <li key={p.id}>
                          <Link to={`/account/progetti/${p.id}`}>
                            <span><b>{p.title}</b><small>{p.number} · aggiornato {timeAgo(p.updated_at)}</small></span>
                            <ProjectChip status={p.status} />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>
            </div>
          );
        }}
      </Data>
    </>
  );
}

// ---------- ordini ----------
export function OrdersPage() {
  usePageTitle('I miei ordini');
  const q = useQuery(() => api.listOrders(), []);
  return (
    <>
      <PageHead title="I miei ordini" />
      <Data q={q}>
        {(orders) =>
          orders.length === 0 ? (
            <Empty icon="box" title="Non hai ancora ordini" text="Quando ordini un kit lo segui da qui, passo per passo." action={<LinkButton to="/catalogo">Vai al catalogo</LinkButton>} />
          ) : (
            <ul className="cardlist">
              {orders.map((o) => (
                <li key={o.id}>
                  <Link to={`/account/ordini/${o.id}`} className="listcard">
                    <div>
                      <b>{o.number}</b>
                      <span>{itemsText(o)}</span>
                      <small>{fmtDate(o.created_at)}</small>
                    </div>
                    <div className="listcard-side">
                      <strong>{eur(o.total_cents)}</strong>
                      <OrderChip status={o.status} />
                      {o.status !== 'annullato' && o.payment_status !== 'pagato' && <PaymentChip status={o.payment_status} />}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )
        }
      </Data>
    </>
  );
}

export function OrderDetailPage({ id }: { id: string }) {
  const { settings } = useCatalog();
  const q = useQuery(() => api.getOrder(id), [id]);
  usePageTitle(q.data ? `Ordine ${q.data.number}` : 'Ordine');
  if (q.loading && !q.data) return <Loading />;
  const o = q.data;
  if (!o) return <Empty icon="box" title="Ordine non trovato" action={<LinkButton to="/account/ordini">I miei ordini</LinkButton>} />;
  const idx = ORDER_FLOW.indexOf(o.status);
  return (
    <>
      <PageHead
        back={{ to: '/account/ordini', label: 'Ordini' }}
        title={`Ordine ${o.number}`}
        sub={`Del ${fmtDate(o.created_at)}`}
        actions={
          <>
            <OrderChip status={o.status} />
            <PaymentChip status={o.payment_status} />
          </>
        }
      />
      <div className="stack">
        {o.status === 'annullato' ? (
          <p className="notice">{ORDER_STATUS.annullato.customer}</p>
        ) : (
          <Card>
            <Stepper steps={ORDER_FLOW.map((s) => ({ key: s, label: ORDER_STATUS[s].label }))} current={idx} done={o.status === 'consegnato'} />
            <p className="stepper-note">{ORDER_STATUS[o.status].customer}</p>
          </Card>
        )}
        {o.status !== 'annullato' && <PaymentBox payments={o.payments} settings={settings} reference={o.number} />}
        <div className="two-col">
          <Card title="Cosa hai ordinato">
            <ul className="mini-lines">
              {o.items.map((i) => (
                <li key={i.id}>
                  <span>
                    {i.qty} × {i.name}
                    {i.config.length > 0 && <small>{configSummary(i.config)}</small>}
                  </span>
                  <b>{eur(i.unit_price_cents * i.qty)}</b>
                </li>
              ))}
            </ul>
            <Dl rows={[['Spedizione', o.shipping_cents ? eur(o.shipping_cents) : 'Gratis']]} />
            <p className="sum-total">
              <span>Totale</span>
              <strong>{eur(o.total_cents)}</strong>
            </p>
          </Card>
          <div className="stack">
            <Card title="Spedizione">
              <AddressText a={o.shipping_address} />
              <Dl rows={[['Corriere e tracciamento', <TrackingText key="t" courier={o.courier} code={o.tracking_code} />]]} />
            </Card>
            <Card title="Pagamenti">
              <PaymentsList payments={o.payments} />
            </Card>
          </div>
        </div>
        <Card title="Cronologia">
          <Timeline events={o.events} />
        </Card>
        {o.customer_note && (
          <Card title="La tua nota">
            <p>{o.customer_note}</p>
          </Card>
        )}
      </div>
    </>
  );
}

// ---------- preventivi ----------
export function QuotesPage() {
  usePageTitle('I miei preventivi');
  const q = useQuery(() => api.listQuotes(), []);
  return (
    <>
      <PageHead title="Preventivi" actions={<LinkButton to="/team" variant="ghost" size="sm">Nuova richiesta</LinkButton>} />
      <Data q={q}>
        {(list) =>
          list.length === 0 ? (
            <Empty icon="file" title="Nessun preventivo" text="Per team e motoclub prepariamo un prezzo dedicato." action={<LinkButton to="/team">Chiedi un preventivo</LinkButton>} />
          ) : (
            <ul className="cardlist">
              {list.map((x) => (
                <li key={x.id}>
                  <Link to={`/account/preventivi/${x.id}`} className="listcard">
                    <div>
                      <b>{x.number} · {x.team_name}</b>
                      <span>{x.riders} piloti · {x.service}</span>
                      <small>{fmtDate(x.created_at)}</small>
                    </div>
                    <div className="listcard-side">
                      {x.total_cents > 0 && <strong>{eur(x.total_cents)}</strong>}
                      <QuoteChip status={x.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )
        }
      </Data>
    </>
  );
}

export function QuoteDetailPage({ id }: { id: string }) {
  const q = useQuery(() => api.getQuote(id), [id]);
  const [busy, setBusy] = useBusy();
  usePageTitle(q.data ? `Preventivo ${q.data.number}` : 'Preventivo');
  if (q.loading && !q.data) return <Loading />;
  const x = q.data;
  if (!x) return <Empty icon="file" title="Preventivo non trovato" action={<LinkButton to="/account/preventivi">Preventivi</LinkButton>} />;
  const decide = (accept: boolean) => setBusy(() => api.decideQuote(x.id, accept), accept ? 'Preventivo accettato. Ti scriviamo per l’ordine.' : 'Preventivo rifiutato');
  const expired = x.valid_until && new Date(x.valid_until).getTime() < Date.now();
  return (
    <>
      <PageHead back={{ to: '/account/preventivi', label: 'Preventivi' }} title={`Preventivo ${x.number}`} sub={`${x.team_name} · ${x.riders} piloti`} actions={<QuoteChip status={x.status} />} />
      <div className="two-col">
        <Card title="Dettaglio">
          {x.lines.length === 0 ? (
            <p className="muted">Stiamo preparando il preventivo. Ti avvisiamo appena è pronto.</p>
          ) : (
            <>
              <table className="table">
                <thead>
                  <tr><th>Voce</th><th className="num">Q.tà</th><th className="num">Prezzo</th><th className="num">Totale</th></tr>
                </thead>
                <tbody>
                  {x.lines.map((l, i) => (
                    <tr key={i}>
                      <td>{l.description}</td>
                      <td className="num">{l.qty}</td>
                      <td className="num">{eur(l.unit_price_cents)}</td>
                      <td className="num">{eur(l.qty * l.unit_price_cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="sum-total">
                <span>Totale</span>
                <strong>{eur(x.total_cents)}</strong>
              </p>
              {x.valid_until && <p className="muted">Valido fino al {fmtDate(x.valid_until)}{expired ? ' (scaduto)' : ''}.</p>}
            </>
          )}
          {x.status === 'inviato' && !expired && (
            <div className="row-actions">
              <button className="btn btn-primary btn-lg slant" type="button" disabled={busy} onClick={() => decide(true)}>Accetta il preventivo</button>
              <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => decide(false)}>Rifiuta</button>
            </div>
          )}
          {x.status === 'accettato' && <p className="notice notice-ok">Hai accettato. Creiamo l’ordine e ti avvisiamo con le istruzioni di pagamento.</p>}
          {x.status === 'convertito' && x.order_id && <LinkButton to={`/account/ordini/${x.order_id}`}>Vai all’ordine</LinkButton>}
        </Card>
        <Card title="La tua richiesta">
          <Dl rows={[['Tipo di moto', x.bike_type || '—'], ['Servizio', x.service || '—'], ['Richiesta del', fmtDate(x.created_at)]]} />
          {x.message && <p>{x.message}</p>}
        </Card>
      </div>
    </>
  );
}

function useBusy(): [boolean, (fn: () => Promise<unknown>, ok?: string) => Promise<void>] {
  const { run, busy } = useAction();
  return [busy, async (fn, ok) => void (await run(fn, ok))];
}
