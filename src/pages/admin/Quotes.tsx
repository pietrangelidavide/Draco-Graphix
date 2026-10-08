import { useEffect, useMemo, useState } from 'react';
import { api } from '../../data';
import { Link, navigate, usePageTitle } from '../../router';
import { useAdmin } from '../../state/admin';
import { useQuery } from '../../state/useQuery';
import { useAction } from '../../state/ui';
import { Button, Card, Dl, Empty, Icon, Input, Loading, PageHead, QuoteChip, Select, Tabs, TextArea } from '../../components/ui';
import { centsToInput, eur, parseEuro } from '../../lib/money';
import { QUOTE_STATUS, QUOTE_STATUSES } from '../../lib/status';
import { fmtDate } from '../../lib/util';
import type { Quote, QuoteStatus } from '../../lib/types';

type Tab = 'aperti' | 'inviati' | 'chiusi' | 'tutti';
const OPEN: QuoteStatus[] = ['nuova', 'in_preparazione', 'accettato'];

export function AdminQuotesPage() {
  usePageTitle('Preventivi');
  const { quotes, loading } = useAdmin();
  const [tab, setTab] = useState<Tab>('aperti');
  const f: Record<Tab, (q: Quote) => boolean> = {
    aperti: (q) => OPEN.includes(q.status),
    inviati: (q) => q.status === 'inviato',
    chiusi: (q) => ['rifiutato', 'scaduto', 'convertito'].includes(q.status),
    tutti: () => true,
  };
  if (loading) return <Loading />;
  const list = quotes.filter(f[tab]);
  return (
    <>
      <PageHead title="Preventivi" sub="Richieste di team e motoclub." />
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'aperti', label: 'Da lavorare', count: quotes.filter(f.aperti).length },
          { id: 'inviati', label: 'Inviati', count: quotes.filter(f.inviati).length },
          { id: 'chiusi', label: 'Chiusi', count: quotes.filter(f.chiusi).length },
          { id: 'tutti', label: 'Tutti', count: quotes.length },
        ]}
      />
      {list.length === 0 ? (
        <Empty icon="file" title="Nessun preventivo" text="Le richieste dalla pagina “Team e motoclub” arrivano qui." />
      ) : (
        <div className="table-wrap">
          <table className="table table-click">
            <thead>
              <tr>
                <th>Richiesta</th>
                <th>Team</th>
                <th className="num">Piloti</th>
                <th className="num">Totale</th>
                <th>Stato</th>
              </tr>
            </thead>
            <tbody>
              {list.map((x) => (
                <tr key={x.id} onClick={() => navigate(`/gestionale/preventivi/${x.id}`)}>
                  <td>
                    <Link to={`/gestionale/preventivi/${x.id}`}><b>{x.number}</b></Link>
                    <small>{fmtDate(x.created_at)}</small>
                  </td>
                  <td>
                    {x.team_name}
                    <small>{x.contact.name}</small>
                  </td>
                  <td className="num">{x.riders}</td>
                  <td className="num">{x.total_cents ? eur(x.total_cents) : '—'}</td>
                  <td><QuoteChip status={x.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

interface LineDraft {
  description: string;
  qty: string;
  price: string;
}

export function AdminQuoteDetailPage({ id }: { id: string }) {
  const q = useQuery(() => api.getQuote(id), [id]);
  const { run, busy } = useAction();
  const x = q.data;
  usePageTitle(x ? `Preventivo ${x.number}` : 'Preventivo');
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [valid, setValid] = useState('');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<QuoteStatus>('nuova');
  const [error, setError] = useState('');

  const sync = x ? `${x.id}|${x.updated_at}` : '';
  useEffect(() => {
    if (!x) return;
    setLines(x.lines.length ? x.lines.map((l) => ({ description: l.description, qty: String(l.qty), price: centsToInput(l.unit_price_cents) })) : [{ description: '', qty: String(x.riders), price: '' }]);
    setValid(x.valid_until ? x.valid_until.slice(0, 10) : '');
    setNote(x.staff_note);
    setStatus(x.status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sync]);

  const parsed = useMemo(
    () =>
      lines.map((l) => ({
        description: l.description.trim(),
        qty: Math.max(0, Math.trunc(Number(l.qty)) || 0),
        unit_price_cents: parseEuro(l.price) ?? 0,
      })),
    [lines],
  );
  const total = parsed.reduce((t, l) => t + l.qty * l.unit_price_cents, 0);

  if (q.loading && !x) return <Loading />;
  if (!x) return <Empty icon="file" title="Preventivo non trovato" />;

  const set = (i: number, patch: Partial<LineDraft>) => setLines((cur) => cur.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const valid_until = valid ? `${valid}T23:59:59.000Z` : null;
  const clean = parsed.filter((l) => l.description);

  function check(): boolean {
    if (clean.length === 0) return setError('Aggiungi almeno una riga con descrizione.'), false;
    if (clean.some((l) => l.qty < 1 || l.unit_price_cents <= 0)) return setError('Ogni riga ha bisogno di quantità e prezzo.'), false;
    setError('');
    return true;
  }

  async function save(next?: QuoteStatus) {
    if (next === 'inviato' && !check()) return;
    await run(
      () => api.saveQuote(x!.id, { lines: clean, valid_until, staff_note: note, status: next ?? (x!.status === 'nuova' ? 'in_preparazione' : undefined) }),
      next === 'inviato' ? 'Preventivo inviato al cliente' : 'Preventivo salvato',
    );
  }

  const editable = x.status !== 'convertito';
  return (
    <>
      <PageHead back={{ to: '/gestionale/preventivi', label: 'Preventivi' }} title={`Preventivo ${x.number}`} sub={`${x.team_name} · richiesto il ${fmtDate(x.created_at)}`} actions={<QuoteChip status={x.status} />} />
      <div className="detail-grid">
        <div className="stack">
          <Card title="Righe del preventivo">
            <div className="qlines">
              {lines.map((l, i) => (
                <div key={i} className="qline">
                  <Input label={i === 0 ? 'Descrizione' : ''} value={l.description} onChange={(v) => set(i, { description: v })} placeholder="es. Kit grafica personalizzata, per pilota" disabled={!editable} />
                  <Input label={i === 0 ? 'Q.tà' : ''} value={l.qty} onChange={(v) => set(i, { qty: v })} inputMode="numeric" disabled={!editable} />
                  <Input label={i === 0 ? 'Prezzo cad.' : ''} value={l.price} onChange={(v) => set(i, { price: v })} prefix="€" inputMode="decimal" disabled={!editable} />
                  <output className="qtot">{eur(parsed[i]!.qty * parsed[i]!.unit_price_cents)}</output>
                  <button type="button" className="icon-btn" aria-label="Togli la riga" disabled={!editable || lines.length === 1} onClick={() => setLines(lines.filter((_, j) => j !== i))}>
                    <Icon name="trash" size={18} />
                  </button>
                </div>
              ))}
            </div>
            {editable && (
              <div className="row-actions">
                <Button variant="ghost" size="sm" icon="plus" onClick={() => setLines([...lines, { description: '', qty: '1', price: '' }])}>Aggiungi una riga</Button>
                <Button variant="quiet" size="sm" onClick={() => setLines([...lines.filter((l) => l.description || l.price), { description: 'Kit grafica personalizzata (per pilota)', qty: String(x.riders), price: '' }])}>
                  Riga “kit per pilota”
                </Button>
              </div>
            )}
            <p className="sum-total">
              <span>Totale (IVA inclusa)</span>
              <strong>{eur(total)}</strong>
            </p>
            {error && <p className="err" role="alert">{error}</p>}
          </Card>
          <Card title="Condizioni">
            <div className="form-grid">
              <Input label="Valido fino al" type="date" value={valid} onChange={setValid} disabled={!editable} optional />
            </div>
            <TextArea label="Nota interna" value={note} onChange={setNote} rows={3} disabled={!editable} />
          </Card>
        </div>

        <div className="stack">
          <Card title="Azioni">
            {x.status === 'convertito' && x.order_id ? (
              <Link to={`/gestionale/ordini/${x.order_id}`} className="btn btn-primary">Apri l’ordine</Link>
            ) : (
              <>
                <Button busy={busy} variant="ghost" onClick={() => void save()}>Salva la bozza</Button>
                <Button busy={busy} icon="send" onClick={() => void save('inviato')}>
                  {x.status === 'inviato' ? 'Invia di nuovo al cliente' : 'Invia al cliente'}
                </Button>
                {x.status === 'accettato' && (
                  <Button
                    busy={busy}
                    variant="dark"
                    onClick={async () => {
                      const o = await run(() => api.quoteToOrder(x.id), 'Ordine creato');
                      if (o) navigate(`/gestionale/ordini/${o.id}`);
                    }}
                  >
                    Crea l’ordine
                  </Button>
                )}
                <hr />
                <Select label="Cambia stato a mano" value={status} onChange={(v) => setStatus(v as QuoteStatus)} options={QUOTE_STATUSES.filter((s) => s !== 'convertito').map((s) => ({ value: s, label: QUOTE_STATUS[s].label }))} />
                <Button variant="quiet" size="sm" busy={busy} disabled={status === x.status} onClick={() => void run(() => api.saveQuote(x.id, { status }), 'Stato aggiornato')}>Aggiorna</Button>
              </>
            )}
          </Card>
          <Card title="Richiesta del cliente">
            <Dl
              rows={[
                ['Referente', x.contact.name],
                ['Email', <a key="m" href={`mailto:${x.contact.email}`}>{x.contact.email}</a>],
                ['Telefono', x.contact.phone || '—'],
                ['Piloti', x.riders],
                ['Moto', x.bike_type || '—'],
                ['Servizio', x.service || '—'],
              ]}
            />
            {x.message && <p className="brief-style">{x.message}</p>}
            {!x.user_id && <p className="notice">Questo cliente non ha ancora un account. Per creare l’ordine deve registrarsi con la stessa email.</p>}
          </Card>
        </div>
      </div>
    </>
  );
}
