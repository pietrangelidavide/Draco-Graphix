import { useMemo, useRef, useState } from 'react';
import { api } from '../../data';
import { Link, navigate, usePageTitle } from '../../router';
import { useCatalog } from '../../state/catalog';
import { useAction, useUi } from '../../state/ui';
import { KitArt, LiveArt } from '../../components/art';
import { ProductCard } from '../../components/common';
import { Button, Card, Checkbox, Chip, Empty, Icon, Input, Loading, Modal, PageHead, Select, Tabs, TextArea } from '../../components/ui';
import { centsToInput, eur, parseEuro } from '../../lib/money';
import { basePrice } from '../../lib/pricing';
import { FORK_FIELDS, KIT_FIELDS, SHIRT_FIELDS } from '../../lib/seed';
import { slugify, uid } from '../../lib/util';
import type { Brand, FieldChoice, FieldDef, FieldRole, Product, ProductKind } from '../../lib/types';

const KIND_LABEL: Record<ProductKind, string> = { kit: 'Kit grafiche', forcella: 'Adesivi forcella', accessorio: 'Accessorio' };
type Tab = 'tutti' | ProductKind | 'bozze';

function BrandsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { brands } = useCatalog();
  const { run } = useAction();
  const [name, setName] = useState('');
  return (
    <Modal open={open} onClose={onClose} title="Marche" footer={<Button onClick={onClose}>Fatto</Button>}>
      <ul className="brandlist">
        {brands.map((b) => (
          <li key={b.id}>
            <Checkbox label={b.name} checked={b.active} onChange={(v) => void run(() => api.saveBrand({ ...b, active: v }))} />
          </li>
        ))}
      </ul>
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          const n = name.trim();
          if (!n) return;
          const b: Brand = { id: slugify(n), name: n, sort: brands.length, active: true };
          void run(async () => {
            await api.saveBrand(b);
            setName('');
          }, 'Marca aggiunta');
        }}
      >
        <Input label="Nuova marca" value={name} onChange={setName} />
        <Button type="submit" variant="ghost">Aggiungi</Button>
      </form>
    </Modal>
  );
}

export function AdminCatalogPage() {
  usePageTitle('Catalogo');
  const { allProducts, brands, loading } = useCatalog();
  const { run } = useAction();
  const [tab, setTab] = useState<Tab>('tutti');
  const [q, setQ] = useState('');
  const [brandsOpen, setBrandsOpen] = useState(false);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return allProducts.filter((p) => (tab === 'tutti' ? true : tab === 'bozze' ? !p.active : p.kind === tab)).filter((p) => !needle || p.name.toLowerCase().includes(needle));
  }, [allProducts, tab, q]);

  if (loading) return <Loading />;
  return (
    <>
      <PageHead
        title="Catalogo"
        sub={`${allProducts.filter((p) => p.active).length} pubblicati · ${allProducts.filter((p) => !p.active).length} in bozza`}
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => setBrandsOpen(true)}>Marche</Button>
            <Button size="sm" icon="plus" onClick={() => navigate('/gestionale/catalogo/nuovo')}>Nuovo prodotto</Button>
          </>
        }
      />
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'tutti', label: 'Tutti', count: allProducts.length },
          { id: 'kit', label: 'Kit', count: allProducts.filter((p) => p.kind === 'kit').length },
          { id: 'forcella', label: 'Forcelle', count: allProducts.filter((p) => p.kind === 'forcella').length },
          { id: 'accessorio', label: 'Accessori', count: allProducts.filter((p) => p.kind === 'accessorio').length },
          { id: 'bozze', label: 'Bozze', count: allProducts.filter((p) => !p.active).length },
        ]}
      />
      <div className="filters filters-1">
        <Input label="Cerca" type="search" value={q} onChange={setQ} />
      </div>
      {list.length === 0 ? (
        <Empty icon="tag" title="Nessun prodotto" />
      ) : (
        <div className="table-wrap">
          <table className="table table-click">
            <thead>
              <tr>
                <th>Prodotto</th>
                <th>Marca</th>
                <th className="num">Prezzo</th>
                <th className="num">Giacenza</th>
                <th>Vetrina</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} onClick={() => navigate(`/gestionale/catalogo/${p.id}`)}>
                  <td>
                    <div className="prod-cell">
                      <span className="thumb"><KitArt product={p} /></span>
                      <span>
                        <Link to={`/gestionale/catalogo/${p.id}`}><b>{p.name}</b></Link>
                        <small>{KIND_LABEL[p.kind]}</small>
                      </span>
                    </div>
                  </td>
                  <td>{brands.find((b) => b.id === p.brand_id)?.name ?? '—'}</td>
                  <td className="num">
                    {eur(basePrice(p))}
                    {p.discount_percent > 0 && <small>−{p.discount_percent}%</small>}
                  </td>
                  <td className="num">{p.stock == null ? '∞' : p.stock}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="chip-btn"
                      title={p.active ? 'Nascondi dalla vetrina' : 'Pubblica in vetrina'}
                      onClick={() => void run(() => api.saveProduct({ ...p, active: !p.active }), p.active ? 'Nascosto dalla vetrina' : 'Pubblicato')}
                    >
                      <Chip tone={p.active ? 'ok' : 'neutral'}>{p.active ? 'Pubblicato' : 'Bozza'}</Chip>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <BrandsModal open={brandsOpen} onClose={() => setBrandsOpen(false)} />
    </>
  );
}

// ---------- editor ----------
const ROLES: { value: '' | FieldRole; label: string }[] = [
  { value: '', label: 'Nessuno' },
  { value: 'model', label: 'Modello della moto' },
  { value: 'year', label: 'Annata' },
  { value: 'rider_name', label: 'Nome pilota' },
  { value: 'rider_number', label: 'Numero pilota' },
  { value: 'base', label: 'Base di stampa (effetto in anteprima)' },
  { value: 'finish', label: 'Laminazione (effetto in anteprima)' },
];

const blank = (): Product => ({
  id: '', slug: '', name: '', kind: 'kit', brand_id: null, tags: [], description: '', contents: [], specs: [], price_cents: 14900, discount_percent: 0,
  images: [], art_colors: ['#d5141c', '#14161a', '#f2f2f2'], fields: JSON.parse(JSON.stringify(KIT_FIELDS)) as FieldDef[], badge: null, featured: false, active: false, stock: null, sort: 0, created_at: new Date().toISOString(),
});

function ChoicesEditor({ choices, onChange }: { choices: FieldChoice[]; onChange: (c: FieldChoice[]) => void }) {
  return (
    <div className="choices-ed">
      {choices.map((c, i) => (
        <div key={i} className="choice-ed">
          <Input label={i === 0 ? 'Voce' : ''} value={c.label} onChange={(v) => onChange(choices.map((x, j) => (j === i ? { ...x, label: v, value: x.value && j < choices.length && x.value !== slugify(x.label) ? x.value : slugify(v) } : x)))} />
          <Input label={i === 0 ? 'In più' : ''} prefix="€" value={centsToInput(c.delta_cents)} onChange={(v) => onChange(choices.map((x, j) => (j === i ? { ...x, delta_cents: parseEuro(v) ?? 0 } : x)))} inputMode="decimal" />
          <button type="button" className="icon-btn" aria-label="Togli la voce" onClick={() => onChange(choices.filter((_, j) => j !== i))}>
            <Icon name="trash" size={16} />
          </button>
        </div>
      ))}
      <Button variant="quiet" size="sm" icon="plus" onClick={() => onChange([...choices, { value: '', label: '', delta_cents: 0 }])}>Aggiungi voce</Button>
    </div>
  );
}

function FieldEditor({ f, onChange, onRemove, onMove }: { f: FieldDef; onChange: (f: FieldDef) => void; onRemove: () => void; onMove: (d: -1 | 1) => void }) {
  return (
    <div className="field-ed">
      <div className="field-ed-top">
        <Input label="Etichetta" value={f.label} onChange={(v) => onChange({ ...f, label: v, key: f.key || slugify(v).replace(/-/g, '_') })} />
        <Select label="Tipo" value={f.type} onChange={(v) => onChange({ ...f, type: v as FieldDef['type'], choices: v === 'select' ? f.choices ?? [{ value: '', label: '', delta_cents: 0 }] : undefined })} options={[{ value: 'text', label: 'Testo libero' }, { value: 'year', label: 'Annata' }, { value: 'select', label: 'Scelta tra voci' }]} />
        <div className="field-ed-tools">
          <button type="button" className="icon-btn" aria-label="Sposta su" onClick={() => onMove(-1)}><Icon name="chevron" size={16} className="rot-up" /></button>
          <button type="button" className="icon-btn" aria-label="Sposta giù" onClick={() => onMove(1)}><Icon name="chevdown" size={16} /></button>
          <button type="button" className="icon-btn" aria-label="Togli il campo" onClick={onRemove}><Icon name="trash" size={16} /></button>
        </div>
      </div>
      <div className="field-ed-row">
        <Checkbox label="Obbligatorio" checked={!!f.required} onChange={(v) => onChange({ ...f, required: v })} />
        <Select label="Collegato a" value={f.role ?? ''} onChange={(v) => onChange({ ...f, role: v ? (v as FieldRole) : undefined })} options={ROLES} />
        {f.type === 'text' && <Input label="Max caratteri" value={String(f.maxLength ?? '')} onChange={(v) => onChange({ ...f, maxLength: Number(v) || undefined })} inputMode="numeric" />}
        <Input label="Codice interno" value={f.key} onChange={(v) => onChange({ ...f, key: v.toLowerCase().replace(/[^a-z0-9_]/g, '_') })} help="Non cambiarlo se ci sono già ordini." />
      </div>
      {f.type === 'select' && <ChoicesEditor choices={f.choices ?? []} onChange={(c) => onChange({ ...f, choices: c })} />}
    </div>
  );
}

export function AdminProductEditPage({ id }: { id: string }) {
  const { allProducts, brands, loading } = useCatalog();
  if (loading) return <Loading />;
  const found = id === 'nuovo' ? blank() : allProducts.find((p) => p.id === id);
  if (!found) return <Empty icon="tag" title="Prodotto non trovato" />;
  return <Editor key={id} initial={found} isNew={id === 'nuovo'} brands={brands} others={allProducts.filter((p) => p.id !== found.id)} />;
}

function Editor({ initial, isNew, brands, others }: { initial: Product; isNew: boolean; brands: Brand[]; others: Product[] }) {
  usePageTitle(isNew ? 'Nuovo prodotto' : initial.name);
  const { run, busy } = useAction();
  const { toast } = useUi();
  const [p, setP] = useState<Product>(initial);
  const [price, setPrice] = useState(centsToInput(initial.price_cents));
  const [tags, setTags] = useState(initial.tags.join(', '));
  const [contents, setContents] = useState(initial.contents.join('\n'));
  const [specs, setSpecs] = useState(initial.specs.join('\n'));
  const [stock, setStock] = useState(initial.stock == null ? '' : String(initial.stock));
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const pick = useRef<HTMLInputElement>(null);

  const set = <K extends keyof Product>(k: K, v: Product[K]) => setP((c) => ({ ...c, [k]: v }));
  const preview: Product = { ...p, price_cents: parseEuro(price) ?? p.price_cents };

  async function addImages(list: FileList | null) {
    if (!list) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const f of Array.from(list)) {
        if (!f.type.startsWith('image/')) throw new Error(`${f.name} non è un’immagine`);
        const ref = await api.uploadFile(f, 'catalog');
        urls.push(ref.path);
      }
      setP((c) => ({ ...c, images: [...c.images, ...urls] }));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Caricamento non riuscito', 'error');
    } finally {
      setUploading(false);
      if (pick.current) pick.current.value = '';
    }
  }

  async function save() {
    const e: Record<string, string> = {};
    const cents = parseEuro(price);
    if (!p.name.trim()) e.name = 'Dai un nome al prodotto';
    const slug = slugify(p.slug || p.name);
    if (!slug) e.slug = 'Indirizzo web non valido';
    else if (others.some((o) => o.slug === slug)) e.slug = 'Esiste già un prodotto con questo indirizzo';
    if (cents == null) e.price = 'Prezzo non valido';
    if (p.discount_percent < 0 || p.discount_percent > 90) e.discount = 'Sconto da 0 a 90';
    const keys = p.fields.map((f) => f.key);
    if (p.fields.some((f) => !f.label.trim() || !f.key)) e.fields = 'Ogni campo ha bisogno di etichetta e codice.';
    else if (new Set(keys).size !== keys.length) e.fields = 'Due campi hanno lo stesso codice interno.';
    else if (p.fields.some((f) => f.type === 'select' && (!f.choices || f.choices.length === 0 || f.choices.some((c) => !c.label.trim())))) e.fields = 'Le scelte devono avere almeno una voce con un nome.';
    setErrors(e);
    if (Object.keys(e).length) {
      toast('Controlla i campi evidenziati', 'error');
      return;
    }
    const stockN = stock.trim() === '' ? null : Math.max(0, Math.trunc(Number(stock)) || 0);
    const next: Product = {
      ...p,
      id: isNew ? `p-${slug}` : p.id,
      slug,
      name: p.name.trim(),
      price_cents: cents!,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      contents: contents.split('\n').map((t) => t.trim()).filter(Boolean),
      specs: specs.split('\n').map((t) => t.trim()).filter(Boolean),
      stock: stockN,
      badge: p.badge?.trim() ? p.badge.trim() : null,
      fields: p.fields.map((f) => ({
        ...f,
        choices: f.type === 'select' ? (f.choices ?? []).map((c) => ({ ...c, value: c.value || slugify(c.label) })) : undefined,
      })),
    };
    const saved = await run(() => api.saveProduct(next), isNew ? 'Prodotto creato' : 'Prodotto salvato');
    if (saved) navigate('/gestionale/catalogo');
  }

  const moveField = (i: number, d: -1 | 1) =>
    setP((c) => {
      const j = i + d;
      if (j < 0 || j >= c.fields.length) return c;
      const fields = [...c.fields];
      [fields[i], fields[j]] = [fields[j]!, fields[i]!];
      return { ...c, fields };
    });

  return (
    <>
      <PageHead
        back={{ to: '/gestionale/catalogo', label: 'Catalogo' }}
        title={isNew ? 'Nuovo prodotto' : p.name}
        actions={
          <>
            {!isNew && <Link to={`/prodotto/${p.slug}`} className="btn btn-ghost btn-sm">Vedi in vetrina</Link>}
            <Button busy={busy} onClick={() => void save()}>Salva</Button>
          </>
        }
      />
      <div className="detail-grid">
        <form className="stack" noValidate onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <Card title="Scheda">
            <div className="form-grid">
              <Input className="span-2" label="Nome" value={p.name} onChange={(v) => { set('name', v); if (!slugTouched) set('slug', slugify(v)); }} error={errors.name} />
              <Select label="Tipo" value={p.kind} onChange={(v) => {
                const kind = v as ProductKind;
                setP((c) => ({ ...c, kind, fields: isNew ? (JSON.parse(JSON.stringify(kind === 'kit' ? KIT_FIELDS : kind === 'forcella' ? FORK_FIELDS : SHIRT_FIELDS)) as FieldDef[]) : c.fields }));
              }} options={(Object.keys(KIND_LABEL) as ProductKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))} />
              <Select label="Marca" value={p.brand_id ?? ''} onChange={(v) => set('brand_id', v || null)} placeholder="Nessuna" options={brands.map((b) => ({ value: b.id, label: b.name }))} />
              <Input label="Indirizzo web" value={p.slug} onChange={(v) => { setSlugTouched(true); set('slug', v.toLowerCase().replace(/[^a-z0-9-]+/g, '-')); }} prefix="/prodotto/" error={errors.slug} />
              <Input label="Categorie" value={tags} onChange={setTags} help="Separate da virgola: Cross Motard, Crf" optional />
              <Input label="Etichetta in evidenza" value={p.badge ?? ''} onChange={(v) => set('badge', v)} placeholder="es. Hot, Novità" optional />
              <div className="field">
                <label>In vetrina</label>
                <Checkbox label="Pubblicato (visibile ai clienti)" checked={p.active} onChange={(v) => set('active', v)} />
                <Checkbox label="Tra i più scelti nella home" checked={p.featured} onChange={(v) => set('featured', v)} />
              </div>
              <TextArea className="span-2" label="Descrizione" value={p.description} onChange={(v) => set('description', v)} rows={4} />
              <TextArea label="Cosa contiene (una voce per riga)" value={contents} onChange={setContents} rows={6} optional />
              <TextArea label="Materiali e caratteristiche (una per riga)" value={specs} onChange={setSpecs} rows={6} optional />
            </div>
          </Card>

          <Card title="Prezzo e disponibilità">
            <div className="form-grid">
              <Input label="Prezzo (IVA inclusa)" prefix="€" value={price} onChange={setPrice} inputMode="decimal" error={errors.price} />
              <Input label="Sconto %" value={String(p.discount_percent)} onChange={(v) => set('discount_percent', Math.max(0, Math.min(100, Math.trunc(Number(v)) || 0)))} inputMode="numeric" error={errors.discount} help={`Prezzo in vetrina: ${eur(basePrice(preview))}`} />
              <Input label="Giacenza" value={stock} onChange={setStock} inputMode="numeric" optional help="Lascia vuoto se produci su ordinazione." />
            </div>
          </Card>

          <Card title="Immagini">
            <p className="muted">Finché non carichi le foto, la scheda mostra la tavola di stampa generata con i colori qui sotto.</p>
            {p.images.length > 0 && (
              <ul className="img-ed">
                {p.images.map((src, i) => (
                  <li key={src.slice(-30) + i}>
                    <img src={src} alt="" />
                    <div>
                      {i > 0 && <button type="button" className="link-btn" onClick={() => set('images', [src, ...p.images.filter((_, j) => j !== i)])}>Rendi principale</button>}
                      <button type="button" className="link-btn" onClick={() => set('images', p.images.filter((_, j) => j !== i))}>Togli</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <input ref={pick} type="file" hidden multiple accept="image/*" onChange={(e) => void addImages(e.target.files)} />
            <Button variant="ghost" icon="upload" busy={uploading} onClick={() => pick.current?.click()}>Carica foto</Button>
            <div className="colors-ed">
              {[0, 1, 2].map((i) => (
                <label key={i}>
                  <span>{['Colore principale', 'Fondo', 'Accento'][i]}</span>
                  <input type="color" value={p.art_colors[i] ?? '#000000'} onChange={(e) => set('art_colors', Object.assign([...p.art_colors, '#000000', '#000000', '#000000'].slice(0, 3), { [i]: e.target.value }))} />
                </label>
              ))}
            </div>
          </Card>

          <Card
            title="Cosa sceglie il cliente"
            actions={
              <Button variant="quiet" size="sm" onClick={() => set('fields', JSON.parse(JSON.stringify(KIT_FIELDS)) as FieldDef[])}>
                Usa i campi dei kit
              </Button>
            }
          >
            <p className="muted">Questi campi compaiono nella scheda prodotto e finiscono nella scheda lavoro. I campi “collegati” cambiano l’anteprima e si precompilano dal garage.</p>
            {p.fields.map((f, i) => (
              <FieldEditor key={i} f={f} onChange={(nf) => set('fields', p.fields.map((x, j) => (j === i ? nf : x)))} onRemove={() => set('fields', p.fields.filter((_, j) => j !== i))} onMove={(d) => moveField(i, d)} />
            ))}
            {errors.fields && <p className="err" role="alert">{errors.fields}</p>}
            <Button variant="ghost" icon="plus" onClick={() => set('fields', [...p.fields, { key: `campo_${uid().slice(0, 4)}`, label: '', type: 'text' }])}>Aggiungi un campo</Button>
          </Card>
          <div className="row-actions">
            <Button type="submit" busy={busy}>Salva</Button>
          </div>
        </form>

        <aside className="stack sticky">
          <Card title="Anteprima">
            <ProductCard product={{ ...preview, id: preview.id || 'anteprima', slug: preview.slug || 'anteprima', name: preview.name || 'Nome del prodotto' }} />
            {p.images.length === 0 && <LiveArt product={{ slug: p.slug || p.name || 'anteprima', art_colors: p.art_colors }} number="27" name="TUO NOME" />}
          </Card>
        </aside>
      </div>
    </>
  );
}
