import { useEffect, useMemo, useState } from 'react';
import { api } from '../../data';
import { Link, usePageTitle } from '../../router';
import { useAuth } from '../../state/auth';
import { useCart } from '../../state/cart';
import { useCatalog } from '../../state/catalog';
import { useQuery } from '../../state/useQuery';
import { useUi } from '../../state/ui';
import { useWishlist } from '../../state/wishlist';
import { BikeCompare, LiveArt } from '../../components/art';
import { Price, ProductCard } from '../../components/common';
import { Button, ChoiceGroup, Empty, Icon, Input, Loading, Select } from '../../components/ui';
import { eur, eurShort } from '../../lib/money';
import { MAX_QTY, priceLine, yearChoices } from '../../lib/pricing';
import { loadRider, saveRider } from '../../lib/rider';
import type { FieldDef, FieldRole, Product } from '../../lib/types';

function fieldByRole(p: Product, role: FieldRole): FieldDef | undefined {
  return p.fields.find((f) => f.role === role);
}

export function ProductPage({ slug }: { slug: string }) {
  const { allProducts, brands, settings, loading } = useCatalog();
  const product = allProducts.find((p) => p.slug === slug);
  usePageTitle(product?.name ?? 'Prodotto');
  if (loading) return <div className="wrap section"><Loading /></div>;
  if (!product) {
    return (
      <div className="wrap section">
        <Empty icon="search" title="Prodotto non trovato" text="Forse è stato tolto dal catalogo." action={<Link to="/catalogo" className="btn btn-primary">Torna al catalogo</Link>} />
      </div>
    );
  }
  return <Detail key={product.id} product={product} brandName={brands.find((b) => b.id === product.brand_id)?.name} leadTime={settings.lead_time} />;
}

function Detail({ product, brandName, leadTime }: { product: Product; brandName?: string; leadTime: string }) {
  const { products } = useCatalog();
  const { user, isStaff } = useAuth();
  const cart = useCart();
  const { toast } = useUi();
  const wish = useWishlist();
  const bikes = useQuery(() => (user ? api.listBikes() : Promise.resolve([])), [user?.id]);

  const [sel, setSel] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    const rider = loadRider();
    for (const f of product.fields) {
      if (f.role === 'rider_number' && rider.number) out[f.key] = rider.number;
      else if (f.role === 'rider_name' && rider.name) out[f.key] = rider.name;
      else if (f.type === 'select' && f.required && f.choices?.[0]) out[f.key] = f.choices[0].value;
    }
    return out;
  });
  const [qty, setQty] = useState(1);
  const [showErrors, setShowErrors] = useState(false);
  const [view, setView] = useState(0);
  const [mode, setMode] = useState<'moto' | 'tavola'>('moto');
  const [added, setAdded] = useState(false);

  const priced = useMemo(() => priceLine(product, sel), [product, sel]);
  const set = (k: string) => (v: string) => {
    setSel((cur) => ({ ...cur, [k]: v }));
    setAdded(false);
  };
  const role = (r: FieldRole) => {
    const f = fieldByRole(product, r);
    return f ? sel[f.key] ?? '' : '';
  };
  const soldOut = product.stock != null && product.stock <= 0;
  const maxQty = Math.min(MAX_QTY, product.stock ?? MAX_QTY);
  const years = useMemo(() => yearChoices(), []);
  const related = products.filter((p) => p.id !== product.id && p.kind === product.kind && (product.brand_id ? p.brand_id === product.brand_id : true)).slice(0, 4);

  useEffect(() => {
    setQty((q) => Math.min(q, Math.max(1, maxQty)));
  }, [maxQty]);

  function applyBike(id: string) {
    const b = bikes.data?.find((x) => x.id === id);
    if (!b) return;
    setSel((cur) => {
      const next = { ...cur };
      const put = (r: FieldRole, v: string) => {
        const f = fieldByRole(product, r);
        if (f && v) next[f.key] = v;
      };
      put('model', b.model);
      put('year', b.year ? String(b.year) : '');
      put('rider_name', b.rider_name);
      put('rider_number', b.rider_number);
      return next;
    });
  }

  function add() {
    if (Object.keys(priced.errors).length > 0) {
      setShowErrors(true);
      toast('Completa i campi evidenziati', 'error');
      return;
    }
    cart.add({ product_id: product.id, qty, selections: sel });
    saveRider({ number: role('rider_number'), name: role('rider_name') });
    setAdded(true);
    toast('Aggiunto al carrello');
  }

  const images = product.images;
  const total = priced.unit_price_cents * qty;
  const on = wish.has(product.id);

  return (
    <div className="wrap section">
      <nav className="crumbs" aria-label="Percorso">
        <Link to="/catalogo">Catalogo</Link>
        {brandName && (
          <>
            <Icon name="chevron" size={12} />
            <Link to={`/catalogo?marca=${product.brand_id}`}>{brandName}</Link>
          </>
        )}
      </nav>
      {!product.active && <p className="notice">Bozza: questo prodotto non è visibile ai clienti.{isStaff && <> <Link to={`/gestionale/catalogo/${product.id}`}>Modificalo</Link>.</>}</p>}

      <div className="pdp">
        <div className="pdp-gallery">
          <div className="pdp-main">
            {view === 0 || images.length === 0 ? (
              <>
                <div className="pdp-modes" role="group" aria-label="Come vuoi vederla">
                  <button type="button" className={mode === 'moto' ? 'on' : ''} aria-pressed={mode === 'moto'} onClick={() => setMode('moto')}>Sulla moto</button>
                  <button type="button" className={mode === 'tavola' ? 'on' : ''} aria-pressed={mode === 'tavola'} onClick={() => setMode('tavola')}>Tavola di stampa</button>
                </div>
                {mode === 'moto' ? (
                  <BikeCompare product={product} number={role('rider_number')} name={role('rider_name')} base={role('base') || undefined} finish={role('finish') || undefined} />
                ) : (
                  <LiveArt product={product} number={role('rider_number')} name={role('rider_name')} base={role('base') || undefined} finish={role('finish') || undefined} />
                )}
              </>
            ) : (
              <img className="art" src={images[view - 1]} alt={`${product.name}, foto ${view}`} />
            )}
          </div>
          {images.length > 0 && (
            <div className="pdp-thumbs" role="tablist" aria-label="Immagini">
              <button type="button" role="tab" aria-selected={view === 0} className={view === 0 ? 'on' : ''} onClick={() => setView(0)}>
                Anteprima con i tuoi dati
              </button>
              {images.map((src, i) => (
                <button key={src.slice(-24) + i} type="button" role="tab" aria-selected={view === i + 1} className={view === i + 1 ? 'on' : ''} onClick={() => setView(i + 1)}>
                  <img src={src} alt="" />
                </button>
              ))}
            </div>
          )}
          <p className="art-caption">Anteprima indicativa: trascina il taglio per vedere la moto prima e dopo il kit. Il disegno è quello del kit, nome e numero compaiono sulla tabella.</p>
        </div>

        <div className="pdp-info">
          <p className="pcard-meta">{brandName ?? product.tags.join(' · ')}</p>
          <h1>{product.name}</h1>
          <div className="pdp-price">
            <Price product={product} />
            {product.discount_percent > 0 && <span className="badge badge-sale">−{product.discount_percent}%</span>}
            <small>IVA inclusa, spedizione a parte</small>
          </div>
          <p className="pdp-desc">{product.description}</p>

          {user && bikes.data && bikes.data.length > 0 && fieldByRole(product, 'model') && (
            <Select label="Usa una moto del tuo garage" value="" placeholder="Scegli una moto salvata" onChange={applyBike} options={bikes.data.map((b) => ({ value: b.id, label: `${b.brand} ${b.model}${b.year ? ` ${b.year}` : ''}` }))} />
          )}

          <form
            className="configurator"
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
            noValidate
          >
            {product.fields.map((f) => {
              const err = showErrors ? priced.errors[f.key] : undefined;
              if (f.type === 'text') {
                return <Input key={f.key} label={f.label} value={sel[f.key] ?? ''} onChange={set(f.key)} placeholder={f.placeholder} maxLength={f.maxLength ?? 60} help={f.help} error={err} optional={!f.required} />;
              }
              if (f.type === 'year') {
                return <Select key={f.key} label={f.label} value={sel[f.key] ?? ''} onChange={set(f.key)} placeholder="Scegli l’annata" options={years.map((y) => ({ value: y.value, label: y.label }))} error={err} />;
              }
              const choices = f.choices ?? [];
              if (choices.length <= 4) {
                return (
                  <ChoiceGroup
                    key={f.key}
                    label={f.label}
                    value={sel[f.key] ?? ''}
                    onChange={set(f.key)}
                    required={f.required}
                    error={err}
                    options={choices.map((c) => ({ value: c.value, label: c.label, note: c.delta_cents ? `+ ${eurShort(c.delta_cents)}` : undefined }))}
                  />
                );
              }
              return <Select key={f.key} label={f.label} value={sel[f.key] ?? ''} onChange={set(f.key)} placeholder="Scegli" options={choices.map((c) => ({ value: c.value, label: c.delta_cents ? `${c.label} (+ ${eurShort(c.delta_cents)})` : c.label }))} error={err} />;
            })}

            <div className="buy-row">
              <div className="qty" role="group" aria-label="Quantità">
                <button type="button" aria-label="Meno" onClick={() => setQty(Math.max(1, qty - 1))} disabled={qty <= 1}>
                  <Icon name="minus" size={16} />
                </button>
                <output>{qty}</output>
                <button type="button" aria-label="Più" onClick={() => setQty(Math.min(maxQty, qty + 1))} disabled={qty >= maxQty}>
                  <Icon name="plus" size={16} />
                </button>
              </div>
              <div className="buy-total">
                <span>Totale</span>
                <strong>{eur(total)}</strong>
              </div>
            </div>
            <div className="buy-actions">
              <Button type="submit" size="lg" block disabled={soldOut}>
                {soldOut ? 'Esaurito' : 'Aggiungi al carrello'}
              </Button>
              <button type="button" className={`heart heart-lg ${on ? 'on' : ''}`} aria-pressed={on} aria-label={on ? 'Togli dai preferiti' : 'Aggiungi ai preferiti'} onClick={() => void wish.toggle(product.id)}>
                <Icon name="heart" size={22} />
              </button>
            </div>
            {added && (
              <p className="added" role="status">
                <Icon name="check" size={18} /> Nel carrello. <Link to="/carrello">Vai al carrello</Link> o continua a guardare.
              </p>
            )}
          </form>

          <ul className="facts">
            <li>
              <Icon name="clock" size={18} /> {leadTime}
            </li>
            {product.specs.map((s) => (
              <li key={s}>
                <Icon name="check" size={18} /> {s}
              </li>
            ))}
          </ul>

          {product.contents.length > 0 && (
            <details className="contents" open>
              <summary>Cosa contiene il kit</summary>
              <ul>
                {product.contents.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>{brandName ? `Altri kit ${brandName}` : 'Potrebbero piacerti'}</h2>
          </div>
          <div className="pgrid">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
