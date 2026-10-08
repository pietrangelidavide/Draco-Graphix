import { useMemo } from 'react';
import { api } from '../../data';
import { Link, usePageTitle } from '../../router';
import { useAdmin } from '../../state/admin';
import { useQuery } from '../../state/useQuery';
import { useAction } from '../../state/ui';
import { PAY_KIND } from '../../components/common';
import { Button, Card, Empty, Icon, Loading, PageHead, Stat } from '../../components/ui';
import { eur, eurShort } from '../../lib/money';
import { PROJECT_STATUS, isOrderOpen, isProjectOpen } from '../../lib/status';
import { timeAgo } from '../../lib/util';
import type { Payment } from '../../lib/types';

interface Todo {
  key: string;
  icon: string;
  title: string;
  text: string;
  to: string;
  weight: number;
  payment?: Payment;
}

const MONTHS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

function RevenueChart({ data }: { data: { label: string; cents: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.cents));
  const W = 360;
  const H = 168;
  const bw = 34;
  const gap = (W - data.length * bw) / (data.length + 1);
  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Incassi degli ultimi ${data.length} mesi: ${data.map((d) => `${d.label} ${eurShort(d.cents)}`).join(', ')}`}>
        <line x1="0" x2={W} y1={H - 26} y2={H - 26} className="chart-axis" />
        {data.map((d, i) => {
          const h = Math.max(d.cents > 0 ? 3 : 0, Math.round((d.cents / max) * (H - 62)));
          const x = gap + i * (bw + gap);
          const y = H - 26 - h;
          return (
            <g key={d.label}>
              {h > 0 && <path d={`M${x} ${H - 26}V${y + 4}Q${x} ${y} ${x + 4} ${y}H${x + bw - 4}Q${x + bw} ${y} ${x + bw} ${y + 4}V${H - 26}Z`} className="chart-bar" />}
              <text x={x + bw / 2} y={y - 6} textAnchor="middle" className="chart-val">
                {d.cents > 0 ? eurShort(d.cents) : '0'}
              </text>
              <text x={x + bw / 2} y={H - 8} textAnchor="middle" className="chart-lab">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

export function DashboardPage() {
  usePageTitle('Panoramica');
  const { orders, projects, quotes, leads, loading } = useAdmin();
  const notes = useQuery(() => api.listNotifications(), []);
  const { run, busy } = useAction();

  const calc = useMemo(() => {
    const now = new Date();
    const payments: (Payment & { ref: string; who: string; to: string })[] = [];
    for (const o of orders) if (o.status !== 'annullato') for (const p of o.payments) payments.push({ ...p, ref: o.number, who: o.customer?.full_name ?? '', to: `/gestionale/ordini/${o.id}` });
    for (const pr of projects) if (pr.status !== 'annullata') for (const p of pr.payments) payments.push({ ...p, ref: pr.number, who: pr.customer?.full_name ?? '', to: `/gestionale/progetti/${pr.id}` });

    const pending = payments.filter((p) => p.status === 'in_attesa');
    const received = payments.filter((p) => p.status === 'ricevuto' && p.paid_at);
    const thisMonth = received.filter((p) => {
      const d = new Date(p.paid_at!);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
    const months: { label: string; cents: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const cents = received.filter((p) => {
        const x = new Date(p.paid_at!);
        return x.getFullYear() === d.getFullYear() && x.getMonth() === d.getMonth();
      }).reduce((t, p) => t + p.amount_cents, 0);
      months.push({ label: MONTHS[d.getMonth()]!, cents });
    }

    const todo: Todo[] = [];
    for (const p of pending) todo.push({ key: `pay-${p.id}`, icon: 'euro', title: `${PAY_KIND[p.kind]} da confermare · ${eur(p.amount_cents)}`, text: `${p.ref} · ${p.who} · ${p.method}`, to: p.to, weight: 1, payment: p });
    for (const pr of projects) {
      if (!isProjectOpen(pr.status)) continue;
      const rec = pr.payments.filter((x) => x.status === 'ricevuto').reduce((t, x) => t + x.amount_cents, 0);
      const link = `/gestionale/progetti/${pr.id}`;
      if (pr.status === 'in_grafica') todo.push({ key: pr.id, icon: 'pen', title: `Prima bozza da fare · ${pr.title}`, text: `${pr.number} · ${pr.customer?.full_name ?? ''}`, to: link, weight: 2 });
      else if (pr.status === 'modifiche') todo.push({ key: pr.id, icon: 'pen', title: `Modifiche da applicare · ${pr.title}`, text: `${pr.number} · ${pr.revisions} ${pr.revisions === 1 ? 'giro' : 'giri'} di modifiche`, to: link, weight: 2 });
      else if (pr.status === 'approvata') {
        const due = pr.total_cents != null ? pr.total_cents - rec : null;
        todo.push({ key: pr.id, icon: 'euro', title: due == null ? `Bozza approvata: imposta il totale · ${pr.title}` : due > 0 ? `Saldo da incassare ${eur(due)} · ${pr.title}` : `Saldo ok: manda in stampa · ${pr.title}`, text: `${pr.number} · ${pr.customer?.full_name ?? ''}`, to: link, weight: 3 });
      } else if (pr.status === 'in_stampa') todo.push({ key: pr.id, icon: 'print', title: `In stampa: da spedire · ${pr.title}`, text: `${pr.number} · ${pr.customer?.full_name ?? ''}`, to: link, weight: 5 });
    }
    for (const o of orders) {
      if (!isOrderOpen(o.status)) continue;
      const link = `/gestionale/ordini/${o.id}`;
      const who = o.customer?.full_name ?? '';
      if (o.status === 'in_preparazione') todo.push({ key: o.id, icon: 'box', title: `Prepara i file · ${o.number}`, text: who, to: link, weight: 4 });
      else if (o.status === 'in_stampa') todo.push({ key: o.id, icon: 'print', title: `In stampa · ${o.number}`, text: `${who} · segna pronto a fine stampa`, to: link, weight: 5 });
      else if (o.status === 'pronto') todo.push({ key: o.id, icon: 'truck', title: `Da spedire · ${o.number}`, text: `${who} · inserisci corriere e tracciamento`, to: link, weight: 3 });
    }
    for (const qt of quotes) {
      if (qt.status === 'nuova') todo.push({ key: qt.id, icon: 'file', title: `Preventivo da preparare · ${qt.team_name}`, text: `${qt.number} · ${qt.riders} piloti`, to: `/gestionale/preventivi/${qt.id}`, weight: 4 });
      if (qt.status === 'accettato') todo.push({ key: qt.id, icon: 'file', title: `Preventivo accettato: crea l’ordine · ${qt.team_name}`, text: `${qt.number} · ${eur(qt.total_cents)}`, to: `/gestionale/preventivi/${qt.id}`, weight: 2 });
    }
    const unhandled = leads.filter((l) => !l.handled && l.kind === 'contatto');
    for (const l of unhandled) todo.push({ key: l.id, icon: 'mail', title: `Messaggio da ${l.name || l.email}`, text: l.message.slice(0, 90), to: '/gestionale/contatti', weight: 6 });
    todo.sort((a, b) => a.weight - b.weight);

    return {
      todo,
      pendingTotal: pending.reduce((t, p) => t + p.amount_cents, 0),
      pendingCount: pending.length,
      month: thisMonth.reduce((t, p) => t + p.amount_cents, 0),
      months,
      openOrders: orders.filter((o) => isOrderOpen(o.status)).length,
      toShip: orders.filter((o) => o.status === 'pronto').length,
      openProjects: projects.filter((p) => isProjectOpen(p.status)).length,
      ourTurn: projects.filter((p) => isProjectOpen(p.status) && PROJECT_STATUS[p.status].turn === 'draco').length,
    };
  }, [orders, projects, quotes, leads]);

  if (loading) return <Loading />;

  return (
    <>
      <PageHead title="Panoramica" sub="Cosa c’è da fare oggi in laboratorio." />
      <div className="stats">
        <Stat label="Ordini da lavorare" value={calc.openOrders} sub={`${calc.toShip} da spedire`} />
        <Stat label="Grafiche in corso" value={calc.openProjects} sub={`${calc.ourTurn} tocca a noi`} />
        <Stat label="Da incassare" value={eur(calc.pendingTotal)} sub={`${calc.pendingCount} ${calc.pendingCount === 1 ? 'pagamento' : 'pagamenti'}`} tone={calc.pendingCount ? 'warn' : undefined} />
        <Stat label="Incassato questo mese" value={eur(calc.month)} tone="ok" />
      </div>

      <div className="dash-grid">
        <Card title={`Da fare ora${calc.todo.length ? ` (${calc.todo.length})` : ''}`}>
          {calc.todo.length === 0 ? (
            <Empty icon="check" title="Tutto in ordine" text="Non c’è niente in attesa. Nuovi ordini e richieste compaiono qui." />
          ) : (
            <ul className="todo todo-admin">
              {calc.todo.slice(0, 14).map((t) => (
                <li key={t.key}>
                  <Link to={t.to}>
                    <Icon name={t.icon} size={20} />
                    <span>
                      <b>{t.title}</b>
                      <small>{t.text}</small>
                    </span>
                    <Icon name="chevron" size={16} />
                  </Link>
                  {t.payment && (
                    <Button size="sm" variant="dark" busy={busy} onClick={() => void run(() => api.confirmPayment(t.payment!.id), 'Pagamento registrato')}>
                      Ricevuto
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <div className="stack">
          <Card title="Incassi degli ultimi 6 mesi">
            <RevenueChart data={calc.months} />
          </Card>
          <Card title="Ultime attività">
            {!notes.data || notes.data.length === 0 ? (
              <p className="muted">Nessuna attività recente.</p>
            ) : (
              <ul className="rowlist">
                {notes.data.slice(0, 7).map((n) => (
                  <li key={n.id}>
                    <Link to={n.link || '/gestionale'}>
                      <span>
                        <b>{n.title}</b>
                        <small>{n.body}</small>
                      </span>
                      <small>{timeAgo(n.created_at)}</small>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
