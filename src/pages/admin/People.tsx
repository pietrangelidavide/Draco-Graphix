import { useEffect, useMemo, useState } from 'react';
import { api } from '../../data';
import { Link, navigate, usePageTitle } from '../../router';
import { useAdmin } from '../../state/admin';
import { useAuth } from '../../state/auth';
import { useAction } from '../../state/ui';
import { AddressText } from '../../components/common';
import { Avatar, Button, Card, Chip, Dl, Empty, Input, Loading, OrderChip, PageHead, ProjectChip, QuoteChip, Select, Tabs, TextArea } from '../../components/ui';
import { eur } from '../../lib/money';
import { fmtDate, fmtDateTime, plural, timeAgo } from '../../lib/util';
import type { Role } from '../../lib/types';

const ROLE: Record<Role, string> = { customer: 'Cliente', staff: 'Staff', admin: 'Titolare' };

export function AdminCustomersPage() {
  usePageTitle('Clienti');
  const { customers, orders, projects, loading } = useAdmin();
  const [q, setQ] = useState('');
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return customers
      .filter((c) => !needle || c.full_name.toLowerCase().includes(needle) || c.email.toLowerCase().includes(needle) || c.phone.includes(needle))
      .map((c) => ({
        c,
        orders: orders.filter((o) => o.user_id === c.id).length,
        projects: projects.filter((p) => p.user_id === c.id).length,
        spent: orders.filter((o) => o.user_id === c.id && o.payment_status === 'pagato').reduce((t, o) => t + o.total_cents, 0),
      }))
      .sort((a, b) => b.c.created_at.localeCompare(a.c.created_at));
  }, [customers, orders, projects, q]);

  if (loading) return <Loading />;
  return (
    <>
      <PageHead title="Clienti" sub={plural(customers.length, 'persona registrata', 'persone registrate')} />
      <div className="filters filters-1">
        <Input label="Cerca per nome, email o telefono" type="search" value={q} onChange={setQ} />
      </div>
      {rows.length === 0 ? (
        <Empty icon="users" title="Nessun cliente trovato" />
      ) : (
        <div className="table-wrap">
          <table className="table table-click">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Contatti</th>
                <th className="num">Ordini</th>
                <th className="num">Grafiche</th>
                <th className="num">Speso</th>
                <th>Iscritto</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ c, orders: no, projects: np, spent }) => (
                <tr key={c.id} onClick={() => navigate(`/gestionale/clienti/${c.id}`)}>
                  <td>
                    <div className="prod-cell">
                      <Avatar name={c.full_name} size={32} />
                      <span>
                        <Link to={`/gestionale/clienti/${c.id}`}><b>{c.full_name}</b></Link>
                        {c.role !== 'customer' && <small>{ROLE[c.role]}</small>}
                      </span>
                    </div>
                  </td>
                  <td>
                    {c.email}
                    <small>{c.phone}</small>
                  </td>
                  <td className="num">{no}</td>
                  <td className="num">{np}</td>
                  <td className="num">{spent ? eur(spent) : '—'}</td>
                  <td>{fmtDate(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export function AdminCustomerDetailPage({ id }: { id: string }) {
  const { customers, orders, projects, quotes, loading } = useAdmin();
  const { user, isAdmin } = useAuth();
  const { run, busy } = useAction();
  const c = customers.find((x) => x.id === id);
  usePageTitle(c?.full_name ?? 'Cliente');
  const [note, setNote] = useState('');
  const [role, setRole] = useState<Role>('customer');
  useEffect(() => {
    if (c) {
      setNote(c.staff_note);
      setRole(c.role);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c?.id, c?.staff_note, c?.role]);

  if (loading) return <Loading />;
  if (!c) return <Empty icon="users" title="Cliente non trovato" />;
  const mine = orders.filter((o) => o.user_id === c.id);
  const myProjects = projects.filter((p) => p.user_id === c.id);
  const myQuotes = quotes.filter((x) => x.user_id === c.id || x.contact.email.toLowerCase() === c.email.toLowerCase());
  const paid = mine.filter((o) => o.payment_status === 'pagato').reduce((t, o) => t + o.total_cents, 0);

  return (
    <>
      <PageHead back={{ to: '/gestionale/clienti', label: 'Clienti' }} title={c.full_name} sub={`Iscritto il ${fmtDate(c.created_at)}`} actions={<Chip tone={c.role === 'customer' ? 'neutral' : 'info'}>{ROLE[c.role]}</Chip>} />
      <div className="detail-grid">
        <div className="stack">
          <Card title="Ordini">
            {mine.length === 0 ? (
              <p className="muted">Nessun ordine.</p>
            ) : (
              <ul className="rowlist">
                {mine.map((o) => (
                  <li key={o.id}>
                    <Link to={`/gestionale/ordini/${o.id}`}>
                      <span><b>{o.number}</b><small>{fmtDate(o.created_at)} · {eur(o.total_cents)}</small></span>
                      <OrderChip status={o.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Grafiche su misura">
            {myProjects.length === 0 ? (
              <p className="muted">Nessun progetto.</p>
            ) : (
              <ul className="rowlist">
                {myProjects.map((p) => (
                  <li key={p.id}>
                    <Link to={`/gestionale/progetti/${p.id}`}>
                      <span><b>{p.title}</b><small>{p.number} · {timeAgo(p.updated_at)}</small></span>
                      <ProjectChip status={p.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {myQuotes.length > 0 && (
            <Card title="Preventivi">
              <ul className="rowlist">
                {myQuotes.map((x) => (
                  <li key={x.id}>
                    <Link to={`/gestionale/preventivi/${x.id}`}>
                      <span><b>{x.number}</b><small>{x.team_name}</small></span>
                      <QuoteChip status={x.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
        <div className="stack">
          <Card title="Contatti">
            <Dl rows={[['Email', <a key="e" href={`mailto:${c.email}`}>{c.email}</a>], ['Telefono', c.phone || '—'], ['Newsletter', c.newsletter ? 'Iscritto' : 'No'], ['Speso (ordini pagati)', paid ? eur(paid) : '—']]} />
            <AddressText a={c.address} />
          </Card>
          <Card title="Nota interna">
            <TextArea label="Visibile solo allo staff" value={note} onChange={setNote} rows={3} />
            <Button variant="ghost" busy={busy} onClick={() => void run(() => api.setCustomerNote(c.id, note), 'Nota salvata')}>Salva la nota</Button>
          </Card>
          {isAdmin && (
            <Card title="Ruolo">
              <Select label="Che accesso ha" value={role} onChange={(v) => setRole(v as Role)} disabled={c.id === user?.id} options={(Object.keys(ROLE) as Role[]).map((r) => ({ value: r, label: ROLE[r] }))} />
              <small className="muted">Lo staff usa il gestionale. Solo il titolare cambia impostazioni e ruoli.</small>
              <Button variant="ghost" busy={busy} disabled={role === c.role || c.id === user?.id} onClick={() => void run(() => api.setRole(c.id, role), 'Ruolo aggiornato')}>Cambia il ruolo</Button>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

export function AdminLeadsPage() {
  usePageTitle('Messaggi');
  const { leads, loading } = useAdmin();
  const { run } = useAction();
  const [tab, setTab] = useState<'da-leggere' | 'gestiti' | 'newsletter'>('da-leggere');
  if (loading) return <Loading />;
  const msgs = leads.filter((l) => l.kind === 'contatto');
  const list = tab === 'newsletter' ? leads.filter((l) => l.kind === 'newsletter') : msgs.filter((l) => (tab === 'gestiti' ? l.handled : !l.handled));
  return (
    <>
      <PageHead title="Messaggi" sub="Dal modulo contatti e dalla newsletter." />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'da-leggere', label: 'Da gestire', count: msgs.filter((l) => !l.handled).length },
          { id: 'gestiti', label: 'Gestiti', count: msgs.filter((l) => l.handled).length },
          { id: 'newsletter', label: 'Iscritti alla newsletter', count: leads.filter((l) => l.kind === 'newsletter').length },
        ]}
      />
      {list.length === 0 ? (
        <Empty icon="mail" title="Niente qui" />
      ) : tab === 'newsletter' ? (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Email</th><th>Iscritto il</th></tr></thead>
            <tbody>
              {list.map((l) => (
                <tr key={l.id}><td><a href={`mailto:${l.email}`}>{l.email}</a></td><td>{fmtDate(l.created_at)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="cardlist">
          {list.map((l) => (
            <li key={l.id} className="listcard listcard-static">
              <div>
                <b>{l.name || l.email}</b>
                <span>{l.message}</span>
                <small>
                  <a href={`mailto:${l.email}`}>{l.email}</a>
                  {l.phone && ` · ${l.phone}`} · {fmtDateTime(l.created_at)}
                </small>
              </div>
              <div className="listcard-side">
                <Button variant={l.handled ? 'ghost' : 'dark'} size="sm" onClick={() => void run(() => api.markLead(l.id, !l.handled))}>
                  {l.handled ? 'Riapri' : 'Segna come gestito'}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
