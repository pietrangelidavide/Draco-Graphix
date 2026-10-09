import { useMemo, useState } from 'react';
import { Link, usePageTitle } from '../../router';
import { useCatalog } from '../../state/catalog';
import { BikeCompare } from '../../components/art';
import { ProductCard } from '../../components/common';
import { Icon, LinkButton } from '../../components/ui';
import { eurShort } from '../../lib/money';
import { loadRider, saveRider } from '../../lib/rider';
import { basePrice } from '../../lib/pricing';

const BASES = [
  { v: 'classica', l: 'Classica' },
  { v: 'cromo', l: 'Cromo' },
  { v: 'olografico', l: 'Olografico' },
];
const FINISHES = [
  { v: 'lucido', l: 'Lucido' },
  { v: 'opaco', l: 'Opaco' },
  { v: 'glitter', l: 'Glitter' },
];

function Segmented({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      <span className="seg-label">{label}</span>
      <div>
        {options.map((o) => (
          <button key={o.v} type="button" role="radio" aria-checked={value === o.v} className={value === o.v ? 'on' : ''} onClick={() => onChange(o.v)}>
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );
}

function Hero() {
  const { allProducts } = useCatalog();
  const hero = allProducts.find((p) => p.slug === 'honda-crf-race1') ?? allProducts.find((p) => p.kind === 'kit' && p.active);
  const saved = useMemo(loadRider, []);
  const [number, setNumber] = useState(saved.number || '27');
  const [name, setName] = useState(saved.name);
  const [base, setBase] = useState('classica');
  const [finish, setFinish] = useState('lucido');

  function persist(n: string, nm: string) {
    saveRider({ number: n, name: nm });
  }

  return (
    <section className="hero">
      <div className="wrap hero-grid">
        <div className="hero-copy">
          <h1>
            Metti il tuo numero <span>sulla moto.</span>
          </h1>
          <p className="lead">Kit di grafiche adesive per cross, enduro e supermotard, stampati in Italia. Provalo qui: scrivi il numero e guarda come diventa.</p>
          <div className="hero-fields">
            <div className="field">
              <label htmlFor="h-num">Il tuo numero</label>
              <input
                id="h-num"
                className="input plate-input"
                inputMode="numeric"
                maxLength={3}
                value={number}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9a-zA-Z]/g, '').slice(0, 3);
                  setNumber(v);
                  persist(v, name);
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="h-name">
                Nome o tag Instagram<span className="opt"> · facoltativo</span>
              </label>
              <input
                id="h-name"
                className="input"
                maxLength={18}
                value={name}
                placeholder="es. @tuonome"
                onChange={(e) => {
                  setName(e.target.value);
                  persist(number, e.target.value);
                }}
              />
            </div>
          </div>
          <Segmented label="Base di stampa" value={base} onChange={setBase} options={BASES} />
          <Segmented label="Laminazione" value={finish} onChange={setFinish} options={FINISHES} />
          <div className="hero-cta">
            <LinkButton to="/catalogo" size="lg" className="slant">
              Scegli il tuo kit
            </LinkButton>
            <LinkButton to="/su-misura" size="lg" variant="ghost">
              Grafica su misura
            </LinkButton>
          </div>
        </div>
        <div className="hero-art">
          {hero && <BikeCompare product={hero} number={number} name={name} base={base} finish={finish} />}
          <p className="art-caption">Anteprima indicativa con {hero?.name ?? 'un kit'}. La grafica che ricevi è quella del kit che scegli.</p>
        </div>
      </div>
    </section>
  );
}

export function HomePage() {
  usePageTitle('');
  const { brands, products, settings } = useCatalog();
  const featured = products.filter((p) => p.featured).slice(0, 4);
  const fromPrice = useMemo(() => {
    const kits = products.filter((p) => p.kind === 'kit');
    return kits.length ? Math.min(...kits.map(basePrice)) : 0;
  }, [products]);
  const withBrand = brands.filter((b) => products.some((p) => p.brand_id === b.id));

  return (
    <>
      <Hero />

      <section className="section wrap">
        <div className="section-head">
          <h2>Cerca per marca</h2>
          <Link to="/catalogo" className="more">Tutti i kit</Link>
        </div>
        <ul className="brand-grid">
          {withBrand.map((b) => (
            <li key={b.id}>
              <Link to={`/catalogo?marca=${b.id}`}>{b.name}</Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="section wrap">
        <div className="section-head">
          <h2>Tre modi per avere le tue grafiche</h2>
        </div>
        <div className="ways">
          <article className="way">
            <Icon name="tag" size={26} />
            <h3>Kit del catalogo</h3>
            <p>Scegli la grafica per la tua marca, indica modello e anno, aggiungi nome e numero. {fromPrice > 0 && <>Da {eurShort(fromPrice)}.</>}</p>
            <Link to="/catalogo" className="more">Sfoglia i kit</Link>
          </article>
          <article className="way way-hot">
            <Icon name="pen" size={26} />
            <h3>Grafica su misura</h3>
            <p>La disegniamo da zero con te. Bozza in pochi giorni, modifiche illimitate. L’acconto di {eurShort(settings.deposit_cents)} viene scalato dal totale.</p>
            <Link to="/su-misura" className="more">Racconta la tua idea</Link>
          </article>
          <article className="way">
            <Icon name="users" size={26} />
            <h3>Team e motoclub</h3>
            <p>Più piloti con la stessa grafica? Ti prepariamo un preventivo con prezzo dedicato.</p>
            <Link to="/team" className="more">Chiedi un preventivo</Link>
          </article>
        </div>
      </section>

      {featured.length > 0 && (
        <section className="section wrap">
          <div className="section-head">
            <h2>I più scelti</h2>
            <Link to="/catalogo" className="more">Vedi tutto il catalogo</Link>
          </div>
          <div className="pgrid">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      <section className="section wrap">
        <div className="section-head">
          <h2>Come funziona la grafica su misura</h2>
        </div>
        <ol className="steps4">
          <li>
            <b>Racconti la tua idea</b>
            <span>Moto, colori, sponsor, stile. Puoi allegare logo e foto di riferimento.</span>
          </li>
          <li>
            <b>Versi l’acconto di {eurShort(settings.deposit_cents)}</b>
            <span>Il grafico inizia subito. L’importo è già parte del prezzo finale.</span>
          </li>
          <li>
            <b>Ricevi la bozza</b>
            <span>La vedi nella tua area e chiedi tutte le modifiche che vuoi, senza costi in più.</span>
          </li>
          <li>
            <b>Approvi, stampiamo, spediamo</b>
            <span>Versi il saldo, stampiamo in Italia e consegniamo con corriere.</span>
          </li>
        </ol>
      </section>

      <section className="section wrap">
        <ul className="proof-row">
          <li>
            <strong>Pellicola CRYSTAL 0,4 mm</strong>
            <span>Resiste a fango, lavaggi e cadute.</span>
          </li>
          <li>
            <strong>Colla permanente</strong>
            <span>Ben salda sulle plastiche, anche dopo mesi di gare.</span>
          </li>
          <li>
            <strong>100% Made in Italy</strong>
            <span>Stampa e taglio nel nostro laboratorio.</span>
          </li>
          <li>
            <strong>Tempi</strong>
            <span>{settings.lead_time}</span>
          </li>
        </ul>
      </section>
    </>
  );
}
