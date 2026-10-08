import { api } from '../../data';
import { Link, usePageTitle } from '../../router';
import { useAdmin } from '../../state/admin';
import { useAction } from '../../state/ui';
import { Button, Empty, Loading, PageHead } from '../../components/ui';
import { ORDER_STATUS, nextOrderStatus } from '../../lib/status';
import type { ConfigEntry, OrderFull, ProjectFull } from '../../lib/types';

/** Dati di stampa in grande: quello che serve a chi prepara il file. */
export function PrintSpec({ config }: { config: ConfigEntry[] }) {
  if (config.length === 0) return null;
  return (
    <dl className="spec">
      {config.map((c) => (
        <div key={c.key} className={c.role === 'rider_number' ? 'spec-number' : ''}>
          <dt>{c.label}</dt>
          <dd>{c.value_label}</dd>
        </div>
      ))}
    </dl>
  );
}

const COLUMNS: { key: string; title: string; hint: string }[] = [
  { key: 'ricevuto', title: 'In attesa di pagamento', hint: 'Il pagamento non è ancora arrivato' },
  { key: 'in_preparazione', title: 'Da preparare', hint: 'Preparare i file di stampa' },
  { key: 'in_stampa', title: 'In stampa', hint: 'In macchina o in taglio' },
  { key: 'pronto', title: 'Pronti da spedire', hint: 'Affidare al corriere' },
];

function OrderCard({ o }: { o: OrderFull }) {
  const { run, busy } = useAction();
  const next = nextOrderStatus(o.status);
  return (
    <article className="job">
      <header>
        <Link to={`/gestionale/ordini/${o.id}`}><b>{o.number}</b></Link>
        <span>{o.customer?.full_name}</span>
      </header>
      {o.items.map((i) => (
        <div key={i.id} className="job-item">
          <p>
            <b>{i.qty} × {i.name}</b>
          </p>
          <PrintSpec config={i.config} />
        </div>
      ))}
      {o.customer_note && <p className="job-note">Nota del cliente: {o.customer_note}</p>}
      {o.status === 'ricevuto' ? (
        <Link to={`/gestionale/ordini/${o.id}`} className="btn btn-ghost btn-sm">Registra il pagamento</Link>
      ) : o.status === 'pronto' ? (
        <Link to={`/gestionale/ordini/${o.id}`} className="btn btn-primary btn-sm">Spedisci</Link>
      ) : next ? (
        <Button size="sm" busy={busy} onClick={() => void run(() => api.setOrderStatus(o.id, next), `${o.number}: ${ORDER_STATUS[next].label}`)}>
          Avanti: {ORDER_STATUS[next].label}
        </Button>
      ) : null}
    </article>
  );
}

function ProjectCard({ p }: { p: ProjectFull }) {
  const b = p.brief;
  return (
    <article className="job job-project">
      <header>
        <Link to={`/gestionale/progetti/${p.id}`}><b>{p.number}</b></Link>
        <span>{p.customer?.full_name}</span>
      </header>
      <p><b>Su misura · {p.title}</b></p>
      <dl className="spec">
        <div><dt>Moto</dt><dd>{[b.brand, b.model, b.year].filter(Boolean).join(' ')}</dd></div>
        {b.rider_number && <div className="spec-number"><dt>Numero</dt><dd>{b.rider_number}</dd></div>}
        {b.rider_name && <div><dt>Nome</dt><dd>{b.rider_name}</dd></div>}
        <div><dt>Base</dt><dd>{b.base}</dd></div>
        <div><dt>Laminazione</dt><dd>{b.finish}</dd></div>
      </dl>
      <Link to={`/gestionale/progetti/${p.id}`} className="btn btn-primary btn-sm">Spedisci</Link>
    </article>
  );
}

export function ProductionPage() {
  usePageTitle('Produzione');
  const { orders, projects, loading } = useAdmin();
  if (loading) return <Loading />;
  const printProjects = projects.filter((p) => p.status === 'in_stampa');
  const total = orders.filter((o) => COLUMNS.some((c) => c.key === o.status)).length + printProjects.length;
  return (
    <>
      <PageHead title="Produzione" sub="Tutto quello che è in laboratorio, per fase. Le schede mostrano modello, anno, nome e numero in grande." />
      {total === 0 ? (
        <Empty icon="print" title="Niente in produzione" text="Quando arrivano ordini pagati li trovi qui." />
      ) : (
        <div className="board">
          {COLUMNS.map((c) => {
            const list = orders.filter((o) => o.status === c.key);
            const extra = c.key === 'in_stampa' ? printProjects : [];
            return (
              <section key={c.key} className="col" aria-label={c.title}>
                <header>
                  <h2>{c.title}</h2>
                  <b>{list.length + extra.length}</b>
                </header>
                <p className="col-hint">{c.hint}</p>
                {list.map((o) => (
                  <OrderCard key={o.id} o={o} />
                ))}
                {extra.map((p) => (
                  <ProjectCard key={p.id} p={p} />
                ))}
                {list.length + extra.length === 0 && <p className="col-empty">Vuoto</p>}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
