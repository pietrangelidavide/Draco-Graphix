import { useEffect, useMemo, useState } from 'react';
import { api } from '../../data';
import { Link, navigate, usePageTitle } from '../../router';
import { useAuth } from '../../state/auth';
import { useCatalog } from '../../state/catalog';
import { useAction } from '../../state/ui';
import { BikeCompare } from '../../components/art';
import { AddressForm, FileInput, emptyAddress } from '../../components/common';
import { Button, Card, Checkbox, ChoiceGroup, Icon, Input, Select, TextArea } from '../../components/ui';
import { parseColors } from '../../lib/colors';
import { eurShort } from '../../lib/money';
import { yearChoices } from '../../lib/pricing';
import { KIT_FIELDS } from '../../lib/seed';
import type { Address, FileRef, ProjectBrief } from '../../lib/types';

const DRAFT = 'dg-brief-draft';
const EMPTY: ProjectBrief = { brand: '', model: '', year: '', rider_name: '', rider_number: '', colors: '', style: '', sponsors: '', base: 'classica', finish: 'lucido' };

function loadDraft(): ProjectBrief {
  try {
    const raw = sessionStorage.getItem(DRAFT);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<ProjectBrief>) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

const NEUTRAL = ['#e9e9e9', '#14161a', '#8b9097'];
const choicesOf = (key: string) => (KIT_FIELDS.find((f) => f.key === key)?.choices ?? []).map((c) => ({ value: c.value, label: c.label }));

export function CustomPage() {
  usePageTitle('Grafica su misura');
  const { user } = useAuth();
  const { brands, settings } = useCatalog();
  const { run, busy } = useAction();
  const [brief, setBrief] = useState<ProjectBrief>(loadDraft);
  const [files, setFiles] = useState<FileRef[]>([]);
  const [addr, setAddr] = useState<Address>(() => ({ ...emptyAddress(), name: user?.full_name ?? '', phone: user?.phone ?? '', ...(user?.address ?? {}) }));
  const methods = settings.payment_methods.filter((m) => m.enabled);
  const [method, setMethod] = useState(methods[0]?.id ?? '');
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const years = useMemo(() => yearChoices(), []);
  const previewColors = useMemo(() => parseColors(brief.colors, NEUTRAL), [brief.colors]);
  const previewProduct = useMemo(() => ({ slug: 'su-misura', art_colors: previewColors }), [previewColors]);

  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT, JSON.stringify(brief));
    } catch {
      /* bozza non salvata */
    }
  }, [brief]);
  useEffect(() => {
    if (user && !addr.street && user.address) setAddr((a) => ({ ...a, ...user.address }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const set = (k: keyof ProjectBrief) => (v: string) => setBrief((b) => ({ ...b, [k]: v }));

  async function submit() {
    const e: Record<string, string> = {};
    if (!brief.model.trim()) e.model = 'Indica il modello della moto';
    if (!brief.style.trim()) e.style = 'Racconta com’è la grafica che immagini';
    if (!method) e.method = 'Scegli come versare l’acconto';
    if (!agree) e.agree = 'Devi accettare le condizioni';
    setErrors(e);
    if (Object.keys(e).length) return;
    if (!user) {
      navigate(`/accedi?next=${encodeURIComponent('/su-misura')}&msg=brief`);
      return;
    }
    const hasAddr = !!addr.street.trim();
    const p = await run(() =>
      api.submitProject({
        title: '',
        brief: { ...brief, brand: brief.brand },
        files,
        shipping_address: hasAddr ? { ...addr, country: 'IT' } : null,
        payment_method: method,
      }),
    );
    if (p) {
      try {
        sessionStorage.removeItem(DRAFT);
      } catch {
        /* ok */
      }
      navigate(`/account/progetti/${p.id}`);
    }
  }

  return (
    <>
      <section className="page-hero">
        <div className="wrap">
          <h1>Una grafica solo tua, disegnata da zero.</h1>
          <p className="lead">Ci racconti la moto e lo stile che hai in testa. Il nostro grafico prepara la bozza, tu chiedi tutte le modifiche che vuoi. Si stampa solo quando sei convinto.</p>
          <ul className="inline-facts">
            <li><Icon name="euro" size={18} /> Acconto di {eurShort(settings.deposit_cents)}, scalato dal totale</li>
            <li><Icon name="pen" size={18} /> Modifiche illimitate</li>
            <li><Icon name="clock" size={18} /> {settings.lead_time}</li>
          </ul>
        </div>
      </section>

      <div className="wrap section">
        <form
          className="cart-grid"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="stack">
            <Card title="La tua moto">
              <div className="form-grid">
                <Select label="Marca" value={brief.brand} onChange={set('brand')} placeholder="Scegli la marca" options={[...brands.map((b) => ({ value: b.name, label: b.name })), { value: 'Altra marca', label: 'Altra marca' }]} />
                <Input label="Modello" value={brief.model} onChange={set('model')} placeholder="es. CRF 450R" maxLength={40} error={errors.model} />
                <Select label="Annata" value={brief.year} onChange={set('year')} placeholder="Scegli l’annata" options={years.map((y) => ({ value: y.value, label: y.label }))} />
              </div>
            </Card>
            <Card title="Nome e numero">
              <div className="form-grid">
                <Input label="Nome pilota o tag Instagram" value={brief.rider_name} onChange={set('rider_name')} maxLength={30} optional />
                <Input label="Numero" value={brief.rider_number} onChange={set('rider_number')} maxLength={3} inputMode="numeric" optional />
              </div>
            </Card>
            <Card title="La grafica che immagini">
              <div className="stack">
                <TextArea label="Descrivi lo stile" value={brief.style} onChange={set('style')} rows={5} maxLength={1500} placeholder="Per esempio: aggressiva, con linee diagonali, il numero grande sulla tabella frontale. Mi piace lo stile dei team ufficiali." error={errors.style} />
                <Input label="Colori" value={brief.colors} onChange={set('colors')} placeholder="es. nero, rosso e bianco" maxLength={120} optional />
                <Input label="Sponsor e loghi da inserire" value={brief.sponsors} onChange={set('sponsors')} placeholder="es. Motul, Fox, il nome del tuo team" maxLength={200} optional />
                <FileInput label="Allegati" value={files} onChange={setFiles} folder="briefs" max={6} help="Loghi (meglio vettoriali: PDF, AI, SVG), foto della moto, grafiche che ti piacciono. Fino a 6 file." />
              </div>
            </Card>
            <Card title="Materiali">
              <div className="stack">
                <ChoiceGroup label="Base di stampa" value={brief.base} onChange={set('base')} options={choicesOf('base')} />
                <ChoiceGroup label="Laminazione" value={brief.finish} onChange={set('finish')} options={choicesOf('laminazione')} />
                <p className="help">Cromo, olografico e glitter hanno un costo in più: lo trovi nel totale che ti comunichiamo con la bozza.</p>
              </div>
            </Card>
            <Card title="Dove spediamo (puoi indicarlo anche dopo)">
              <AddressForm value={addr} onChange={setAddr} />
            </Card>
          </div>

          <div className="stack">
            <Card title="Anteprima" className="preview-card">
              <BikeCompare product={previewProduct} number={brief.rider_number} name={brief.rider_name} base={brief.base} finish={brief.finish} />
              <p className="help">Un’idea di dove vanno numero, nome e colori. La grafica vera la disegna il nostro grafico, partendo dal tuo racconto.</p>
            </Card>
            <Card title="Acconto" className="summary" tone="accent">
              <p className="sum-total">
                <span>Da versare ora</span>
                <strong>{eurShort(settings.deposit_cents)}</strong>
              </p>
              <p className="muted">Serve per far partire il grafico. Il prezzo finale dipende dalla complessità: te lo diciamo con la bozza e l’acconto è già incluso.</p>
              <ChoiceGroup label="Come versi l’acconto" value={method} onChange={setMethod} error={errors.method} options={methods.map((m) => ({ value: m.id, label: m.label }))} />
              <Checkbox checked={agree} onChange={setAgree}>
                Accetto le <Link to="/condizioni">condizioni di vendita</Link> e l’<Link to="/privacy">informativa privacy</Link>.
              </Checkbox>
              {errors.agree && <p className="err" role="alert">{errors.agree}</p>}
              <Button type="submit" size="lg" block busy={busy} className="slant">
                {user ? 'Invia il brief' : 'Accedi e invia il brief'}
              </Button>
              {!user && <p className="help">Ti serve un account gratuito: il brief che hai scritto resta salvato.</p>}
            </Card>
          </div>
        </form>
      </div>
    </>
  );
}
