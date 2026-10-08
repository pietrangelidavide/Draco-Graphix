import { api } from '../../data';
import { Link, usePageTitle } from '../../router';
import { useAuth } from '../../state/auth';
import { useCatalog } from '../../state/catalog';
import { useQuery } from '../../state/useQuery';
import { AddressText, Chat, FileList, PaymentBox, PaymentsList, ProofViewer, TrackingText } from '../../components/common';
import { Card, Dl, Empty, ErrorBox, Icon, LinkButton, Loading, PageHead, ProjectChip, Stepper } from '../../components/ui';
import { eur } from '../../lib/money';
import { PROJECT_FLOW, PROJECT_STATUS, isProjectOpen } from '../../lib/status';
import { fmtDate, timeAgo } from '../../lib/util';

export function ProjectsPage() {
  usePageTitle('Grafiche su misura');
  const q = useQuery(() => api.listProjects(), []);
  return (
    <>
      <PageHead title="Grafiche su misura" actions={<LinkButton to="/su-misura" size="sm">Nuova grafica</LinkButton>} />
      {q.error && !q.data ? (
        <ErrorBox message={q.error} onRetry={q.reload} />
      ) : !q.data ? (
        <Loading />
      ) : q.data.length === 0 ? (
        <Empty icon="pen" title="Nessuna grafica su misura" text="Racconta la tua idea: il grafico prepara la bozza e tu chiedi tutte le modifiche che vuoi." action={<LinkButton to="/su-misura">Inizia il brief</LinkButton>} />
      ) : (
        <ul className="cardlist">
          {q.data.map((p) => {
            const info = PROJECT_STATUS[p.status];
            return (
              <li key={p.id}>
                <Link to={`/account/progetti/${p.id}`} className="listcard">
                  <div>
                    <b>{p.title}</b>
                    <span>{p.number} · aggiornato {timeAgo(p.updated_at)}</span>
                    <small>{info.customer}</small>
                  </div>
                  <div className="listcard-side">
                    {isProjectOpen(p.status) && info.turn === 'cliente' && <span className="turn">Tocca a te</span>}
                    <ProjectChip status={p.status} />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

export function ProjectDetailPage({ id }: { id: string }) {
  const { user } = useAuth();
  const { settings } = useCatalog();
  const q = useQuery(() => api.getProject(id), [id]);
  usePageTitle(q.data?.title ?? 'Progetto');
  if (q.loading && !q.data) return <Loading />;
  const p = q.data;
  if (!p || !user) return <Empty icon="pen" title="Progetto non trovato" action={<LinkButton to="/account/progetti">Le mie grafiche</LinkButton>} />;

  const info = PROJECT_STATUS[p.status];
  const received = p.payments.filter((x) => x.status === 'ricevuto').reduce((t, x) => t + x.amount_cents, 0);
  const balance = p.total_cents != null ? Math.max(0, p.total_cents - received) : null;
  const open = isProjectOpen(p.status);
  const needsBalance = (p.status === 'approvata' || p.status === 'in_stampa') && balance != null && balance > 0;
  const methods = settings.payment_methods.filter((m) => m.enabled);
  const b = p.brief;

  return (
    <>
      <PageHead back={{ to: '/account/progetti', label: 'Grafiche su misura' }} title={p.title} sub={`${p.number} · iniziato il ${fmtDate(p.created_at)}`} actions={<ProjectChip status={p.status} />} />
      <div className="stack">
        {open && (
          <p className={`notice ${info.turn === 'cliente' ? 'notice-warn' : ''}`}>
            <b>{info.turn === 'cliente' ? 'Tocca a te. ' : info.turn === 'draco' ? 'Tocca a noi. ' : ''}</b>
            {info.customer}
          </p>
        )}
        {p.status !== 'annullata' && (
          <Card>
            <Stepper steps={PROJECT_FLOW} current={info.step} done={p.status === 'consegnata'} />
          </Card>
        )}

        <div className="room">
          <div className="stack">
            <PaymentBox payments={p.payments} settings={settings} reference={p.number} />
            {needsBalance && (
              <div className="paybox">
                <div className="paybox-row">
                  <div>
                    <h3>
                      Saldo da versare: <strong>{eur(balance!)}</strong>
                    </h3>
                    {methods.map((m) => (
                      <p key={m.id}>
                        <b>{m.label}.</b> {m.instructions}
                      </p>
                    ))}
                    <p className="paybox-ref">
                      Causale: <code>{p.number} saldo</code>
                    </p>
                    <p className="muted">Appena riceviamo il saldo ti avvisiamo e passiamo alla stampa.</p>
                  </div>
                </div>
              </div>
            )}
            <Card title="Bozze">
              <ProofViewer
                proofs={p.proofs}
                canDecide={p.status === 'bozza_inviata'}
                onDecide={(proof, decision, comment) => api.decideProof(proof.id, decision, comment)}
              />
            </Card>
            <Card title="Messaggi">
              <Chat messages={p.messages} meId={user.id} folder={`projects/${p.id}`} disabled={!open} onSend={(body, files) => api.sendMessage(p.id, body, files)} placeholder="Scrivi al grafico…" />
            </Card>
          </div>

          <div className="stack">
            <Card title="Pagamenti">
              <Dl
                rows={[
                  ['Acconto', eur(p.deposit_cents)],
                  ['Totale', p.total_cents != null ? eur(p.total_cents) : 'Lo definiamo con la bozza'],
                  ['Già versato', eur(received)],
                  ...(balance != null ? ([['Da versare', balance === 0 ? 'Niente: è tutto saldato' : eur(balance)]] as [string, string][]) : []),
                ]}
              />
              <PaymentsList payments={p.payments} />
            </Card>
            <Card title="Il tuo brief">
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
            <Card title="Spedizione">
              <AddressText a={p.shipping_address} />
              {p.tracking_code && (
                <p>
                  <Icon name="truck" size={16} /> <TrackingText courier={p.courier} code={p.tracking_code} />
                </p>
              )}
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
