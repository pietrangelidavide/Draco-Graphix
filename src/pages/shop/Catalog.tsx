import { useMemo } from 'react';
import { usePageTitle, useSearch } from '../../router';
import { useCatalog } from '../../state/catalog';
import { ProductCard } from '../../components/common';
import { Empty, Input, Loading, PageHead, Select } from '../../components/ui';
import { basePrice } from '../../lib/pricing';
import { plural } from '../../lib/util';
import type { ProductKind } from '../../lib/types';

const KINDS: { id: ProductKind; label: string }[] = [
  { id: 'kit', label: 'Kit grafiche' },
  { id: 'forcella', label: 'Adesivi forcella' },
  { id: 'accessorio', label: 'Accessori' },
];

const SORTS = [
  { value: 'consigliati', label: 'Consigliati' },
  { value: 'prezzo-asc', label: 'Prezzo: dal più basso' },
  { value: 'prezzo-desc', label: 'Prezzo: dal più alto' },
  { value: 'nome', label: 'Nome A–Z' },
];

export function CatalogPage() {
  usePageTitle('Kit grafiche per moto');
  const { products, brands, loading } = useCatalog();
  const [sp, setSp] = useSearch();
  const tipo = (sp.get('tipo') as ProductKind | null) ?? 'kit';
  const marca = sp.get('marca') ?? '';
  const tag = sp.get('tag') ?? '';
  const q = sp.get('q') ?? '';
  const ordine = sp.get('ordine') ?? 'consigliati';

  const kinds = KINDS.filter((k) => products.some((p) => p.kind === k.id));
  const ofKind = useMemo(() => products.filter((p) => p.kind === tipo), [products, tipo]);
  const tags = useMemo(() => [...new Set(ofKind.flatMap((p) => p.tags))].sort(), [ofKind]);
  const brandOptions = useMemo(() => brands.filter((b) => ofKind.some((p) => p.brand_id === b.id)), [brands, ofKind]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = ofKind.filter(
      (p) =>
        (!marca || p.brand_id === marca) &&
        (!tag || p.tags.includes(tag)) &&
        (!needle || p.name.toLowerCase().includes(needle) || p.tags.some((t) => t.toLowerCase().includes(needle))),
    );
    if (ordine === 'prezzo-asc') out = [...out].sort((a, b) => basePrice(a) - basePrice(b));
    else if (ordine === 'prezzo-desc') out = [...out].sort((a, b) => basePrice(b) - basePrice(a));
    else if (ordine === 'nome') out = [...out].sort((a, b) => a.name.localeCompare(b.name, 'it'));
    else out = [...out].sort((a, b) => Number(b.featured) - Number(a.featured) || a.sort - b.sort);
    return out;
  }, [ofKind, marca, tag, q, ordine]);

  const filtered = !!(marca || tag || q);
  const title = KINDS.find((k) => k.id === tipo)?.label ?? 'Catalogo';

  return (
    <div className="wrap section">
      <PageHead title={title} sub="Scegli la grafica, poi indica modello, anno, nome e numero." />

      {kinds.length > 1 && (
        <div className="tabs" role="tablist" aria-label="Tipo di prodotto">
          {kinds.map((k) => (
            <button key={k.id} type="button" role="tab" aria-selected={tipo === k.id} className={`tab ${tipo === k.id ? 'on' : ''}`} onClick={() => setSp({ tipo: k.id === 'kit' ? undefined : k.id, marca: undefined, tag: undefined })}>
              {k.label}
            </button>
          ))}
        </div>
      )}

      <div className="filters">
        <Input label="Cerca" type="search" value={q} onChange={(v) => setSp({ q: v })} placeholder="es. Race 1, Husqvarna…" />
        {brandOptions.length > 0 && (
          <Select label="Marca" value={marca} onChange={(v) => setSp({ marca: v })} placeholder="Tutte le marche" options={brandOptions.map((b) => ({ value: b.id, label: b.name }))} />
        )}
        <Select label="Ordina per" value={ordine} onChange={(v) => setSp({ ordine: v === 'consigliati' ? undefined : v })} options={SORTS} />
      </div>

      {tags.length > 1 && (
        <div className="tagrow" role="group" aria-label="Categorie">
          <button type="button" className={`pill ${!tag ? 'on' : ''}`} aria-pressed={!tag} onClick={() => setSp({ tag: undefined })}>
            Tutti
          </button>
          {tags.map((t) => (
            <button key={t} type="button" className={`pill ${tag === t ? 'on' : ''}`} aria-pressed={tag === t} onClick={() => setSp({ tag: tag === t ? undefined : t })}>
              {t}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <Loading />
      ) : list.length === 0 ? (
        <Empty
          icon="search"
          title="Nessun prodotto con questi filtri"
          text={filtered ? 'Prova a togliere un filtro. Non trovi la tua moto? Possiamo disegnarti una grafica su misura.' : 'Il catalogo è in aggiornamento.'}
          action={filtered ? <button type="button" className="btn btn-ghost" onClick={() => setSp({ marca: undefined, tag: undefined, q: undefined })}>Azzera i filtri</button> : undefined}
        />
      ) : (
        <>
          <p className="count-line" role="status">
            {plural(list.length, 'prodotto', 'prodotti')}
          </p>
          <div className="pgrid">
            {list.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
