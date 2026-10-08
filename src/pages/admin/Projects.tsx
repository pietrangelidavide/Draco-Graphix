import { useEffect, useState } from 'react';
import { api } from '../../data';
import { Link, usePageTitle } from '../../router';
import { useAdmin } from '../../state/admin';
import { useAuth } from '../../state/auth';
import { useCatalog } from '../../state/catalog';
import { useQuery } from '../../state/useQuery';
import { useAction } from '../../state/ui';
import { AddressText, Chat, FileInput, FileList, PAY_KIND, PaymentsList, ProofViewer } from '../../components/common';
import { Button, Card, Dl, Empty, Input, Loading, PageHead, ProjectChip, Select, Stepper, TextArea } from '../../components/ui';
import { centsToInput, eur, parseEuro } from '../../lib/money';
import { PROJECT_FLOW, PROJECT_STATUS, PROJECT_STATUSES, isProjectOpen } from '../../lib/status';
import { fmtDate, timeAgo } from '../../lib/util';
import type { FileRef, ProjectFull, ProjectStatus } from '../../lib/types';

const GROUPS: { title: string; hint: string; statuses: ProjectStatus[] }[] = [
  { title: 'Tocca a noi', hint: 'Bozze da fare o modifiche da applicare', statuses: ['in_grafica', 'modifiche'] },
  { title: 'In attesa del cliente', hint: 'Acconto, approvazione o saldo', statuses: ['nuovo', 'bozza_inviata', 'approvata'] },
  { title: 'Stampa e spedizione', hint: 'In stampa o in viaggio', statuses: ['in_stampa', 'spedita'] },
  { title: 'Chiusi', hint: 'Consegnati o annullati', statuses: ['consegnata', 'annullata'] },
];

function Card1({ p }: { p: ProjectFull }) {
  return (
    <Link to={`/gestionale/progetti/${p.id}`} className="job job-link">
      <header>
        <b>{p.number}</b>
        <ProjectChip status={p.status} />
      </header>
      <p><b>{p.title}</b></p>
      <small className="muted">
        {p.customer?.full_name} · aggiornato {timeAgo(p.updated_at)}
        {p.total_cents != null && ` · ${eur(p.total_cents)}`}
      </small>
    </Link>
  );
}

export function AdminProjectsPage() {
  usePageTitle('Grafiche su misura');
  const { projects, loading } = useAdmin();
  if (loading) return <Loading />;
  return (
    <>
      <PageHead title="Grafiche su misura" sub="Dal brief del cliente alla spedizione." />
      {projects.length === 0 ? (
        <Empty icon="pen" title="Nessun progetto" text="Quando un cliente invia un brief lo trovi qui." />
      ) : (
        <div className="board">
          {GROUPS.map((g) => {
            const list = projects.filter((p) => g.statuses.includes(p.status));
            return (
              <section key={g.title} className="col" aria-label={g.title}>
                <header>
                  <h2>{g.title}</h2>
                  <b>{list.length}</b>
                </header>
                <p className="col-hint">{g.hint}</p>
                {list.map((p) => (
                  <Card1 key={p.id} p={p} />
                ))}
                {list.length === 0 && <p className="col-empty">Vuoto</p>}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

export function AdminProjectDetailPage({ id }: { id: string }) {
  const { user } = useAuth();
  const { settings } = useCatalog();
  const q = useQuery(() => api.getProject(id), [id]);
  const { run, busy } = useAction();
  const p = q.data;
  usePageTitle(p?.title ?? 'Progetto');

  const [proofFile, setProofFile] = useState<FileRef[]>([]);
  const [proofNote, setProofNote] = useState('');
  const [total, setTotal] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('nuovo');
  const [courier, setCourier] = useState('');
  const [tracking, setTracking] = useState('');
  const [note, setNote] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('bonifico');

  const sync = p ? `${p.id}|${p.status}|${p.total_cents}|${p.courier}|${p.tracking_code}|${p.staff_note}` : '';
  useEffect(() => {
    if (!p) return;
    setStatus(p.status);
    setTotal(centsToInput(p.total_cents));
    setCourier(p.courier || settings.couriers[0] || '');
    setTracking(p.tracking_code);
    setNote(p.staff_note);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sync]);

  const received = p ? p.payments.filter((x) => x.status === 'ricevuto').reduce((t, x) => t + x.amount_cents, 0) : 0;
  const balance = p && p.total_cents != null ? Math.max(0, p.total_cents - received) : null;
  useEffect(() => {
    setPayAmount(balance != null ? centsToInput(balance) : '');
  }, [balance]);

  if (q.loading && !p) return <Loading />;
  if (!p || !user) return <Empty icon="pen" title="Progetto non trovato" />;
  const info = PROJECT_STATUS[p.status];
  const pending = p.payments.filter((x) => x.status === 'in_attesa');
  const b = p.brief;
  const lastProof = p.proofs[p.proofs.length - 1];

  async function sendProof() {
    const file = proofFile[0];
    if (!file) return;
    const ok = await run(async () => {
      await api.addProof(p!.id, file, proofNote);
      return true;
    }, 'Bozza inviata al cliente');
    if (ok) {
      setProofFile([]);
      setProofNote('');
    }
  }

  async function ship() {
    await run(async () => {
      await api.updateProject(p!.id, { courier, tracking_code: tracking.trim() });
      await api.setProjectStatus(p!.id, 'spedita');
    }, 'Segnata come spedita');
  }

  return (
    <>
      <PageHead
        back={{ to: '/gestionale/progetti', label: 'Grafiche su misura' }}
        title={p.title}
        sub={`${p.number} · ${p.customer?.full_name ?? ''} · iniziato il ${fmtDate(p.created_at)}`}
        actions={<ProjectChip status={p.status} />}
      />
      <div className="stack">
        {p.status !== 'annullata' && (
          <Card>
            <Stepper steps={PROJECT_FLOW} current={info.step} done={p.status === 'consegnata'} />
          </Card>
        )}
        <div className="room">
          <div className="stack">
            <Card title="Bozze">
              <ProofViewer proofs={p.proofs} canDecide={false} />
              {isProjectOpen(p.status) && (
                <div className="stack proof-upload">
                  <h3>{lastProof ? `Carica la bozza v${lastProof.version + 1}` : 'Carica la prima bozza'}</h3>
                  <FileInput label="File della bozza" value={proofFile} onChange={(f) => setProofFile(f.slice(-1))} folder={`proofs/${p.id}`} max={1} accept="image/*,.pdf" help="Immagine (JPG, PNG) o PDF. Il cliente la vede subito e riceve una notifica." />
                  <TextArea label="Nota per il cliente" value={proofNote} onChange={setProofNote} rows={2} optional />
                  <Button busy={busy} disabled={proofFile.length === 0} icon="send" onClick={() => void sendProof()}>
                    Invia la bozza al cliente
                  </Button>
                </div>
              )}
            </Card>
            <Card title="Messaggi">
              <Chat messages={p.messages} meId={user.id} folder={`proofs/${p.id}`} onSend={(body, files) => api.sendMessage(p.id, body, files)} placeholder="Scrivi al cliente…" />
            </Card>
          </div>

          <div className="stack">
            <Card title="Pagamenti">
              <Dl rows={[['Acconto', eur(p.deposit_cents)], ['Totale', p.total_cents != null ? eur(p.total_cents) : 'Da impostare'], ['Incassato', eur(received)], ['Saldo', balance == null ? '—' : balance === 0 ? 'Saldato' : eur(balance)]]} />
              <PaymentsList payments={p.payments} />
              {pending.map((x) => (
                <Button key={x.id} variant="dark" busy={busy} onClick={() => void run(() => api.confirmPayment(x.id), 'Pagamento registrato')}>
                  Conferma ricevuto · {PAY_KIND[x.kind]} {eur(x.amount_cents)}
                </Button>
              ))}
              <div className="form-grid">
                <Input label="Totale della grafica" value={total} onChange={setTotal} prefix="€" inputMode="decimal" help="Prezzo finale, acconto compreso." />
                <div className="field field-end">
                  <Button
                    variant="ghost"
                    busy={busy}
                    onClick={() => {
                      const cents = total.trim() === '' ? null : parseEuro(total);
                      if (total.trim() !== '' && cents == null) return;
                      void run(() => api.updateProject(p.id, { total_cents: cents }), 'Totale salvato');
                    }}
                  >
                    Salva il totale
                  </Button>
                </div>
              </div>
              {balance != null && balance > 0 && (
                <div className="form-grid">
                  <Input label="Saldo ricevuto" value={payAmount} onChange={setPayAmount} prefix="€" inputMode="decimal" />
                  <Select label="Metodo" value={payMethod} onChange={setPayMethod} options={[...settings.payment_methods.map((m) => ({ value: m.id, label: m.label })), { value: 'contanti', label: 'Contanti' }]} />
                  <div className="field span-2">
                    <Button
                      busy={busy}
                      onClick={() => {
                        const cents = parseEuro(payAmount);
                        if (!cents) return;
                        void run(() => api.recordPayment({ project_id: p.id, kind: 'saldo', amount_cents: cents, method: payMethod }), 'Saldo registrato');
                      }}
                    >
                      Registra il saldo
                    </Button>
                  </div>
                </div>
              )}
            </Card>

            <Card title="Stato e spedizione">
              <Select label="Stato" value={status} onChange={(v) => setStatus(v as ProjectStatus)} options={PROJECT_STATUSES.map((s) => ({ value: s, label: PROJECT_STATUS[s].label }))} />
              <Button busy={busy} disabled={status === p.status} onClick={() => void run(() => api.setProjectStatus(p.id, status), 'Stato aggiornato')}>
                Aggiorna lo stato
              </Button>
              {p.status === 'approvata' && balance != null && balance > 0 && <p className="notice notice-warn">Il saldo di {eur(balance)} non risulta ancora ricevuto.</p>}
              <hr />
              <Select label="Corriere" value={courier} onChange={setCourier} options={settings.couriers.map((c) => ({ value: c, label: c }))} />
              <Input label="Codice di tracciamento" value={tracking} onChange={setTracking} />
              <div className="row-actions">
                <Button busy={busy} icon="truck" disabled={!tracking.trim() || p.status === 'spedita' || p.status === 'consegnata'} onClick={() => void ship()}>
                  Segna come spedita
                </Button>
                <Button variant="ghost" busy={busy} onClick={() => void run(() => api.updateProject(p.id, { courier, tracking_code: tracking.trim() }), 'Salvato')}>
                  Solo salva
                </Button>
              </div>
              <AddressText a={p.shipping_address} />
            </Card>

            <Card title="Brief del cliente">
              <Dl
                rows={[
                  ['Moto', [b.brand, b.model, b.year].filter(Boolean).join(' ') || '—'],
                  ['Nome e numero', [b.rider_name, b.rider_number && `#${b.rider_number}`].filter(Boolean).join(' · ') || '—'],
                  ['Colori', b.colors || '—'],
                  ['Sponsor', b.sponsors || '—'],
                  ['Materiali', `${b.base}, ${b.finish}`],
                ]}
              />
              <p className="brief-style">{b.style}</p>
              <FileList files={p.files} />
            </Card>

            <Card title="Nota interna">
              <TextArea label="Visibile solo allo staff" value={note} onChange={setNote} rows={3} />
              <Button variant="ghost" busy={busy} onClick={() => void run(() => api.updateProject(p.id, { staff_note: note }), 'Nota salvata')}>Salva la nota</Button>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
