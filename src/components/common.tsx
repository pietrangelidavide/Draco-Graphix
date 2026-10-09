import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { api, isDemo } from '../data';
import { Link, navigate, usePath } from '../router';
import { useAuth } from '../state/auth';
import { useCatalog } from '../state/catalog';
import { useAction, useUi } from '../state/ui';
import { useWishlist } from '../state/wishlist';
import { eur } from '../lib/money';
import { basePrice } from '../lib/pricing';
import { fmtDateTime, formatBytes, timeAgo } from '../lib/util';
import type { Address, FileRef, OrderEvent, Payment, Product, ProjectMessage, Proof, Settings } from '../lib/types';
import { ORDER_STATUS } from '../lib/status';
import { KitArt } from './art';
import { CompareSlider } from './compare';
import { Button, Chip, Empty, Icon, Input, Loading, Modal, TextArea } from './ui';

// ---------- accesso richiesto ----------
export function RequireAuth({ children, staff }: { children: ReactNode; staff?: boolean }) {
  const { user, loading, isStaff } = useAuth();
  const path = usePath();
  useEffect(() => {
    if (!loading && !user) navigate(`/accedi?next=${encodeURIComponent(path)}`, { replace: true });
  }, [loading, user, path]);
  if (loading || !user) return <Loading />;
  if (staff && !isStaff) {
    return (
      <div className="wrap section">
        <Empty icon="warn" title="Area riservata" text="Questa sezione è per chi lavora in Draco Graphix." action={<Link to="/" className="btn btn-ghost">Torna al sito</Link>} />
      </div>
    );
  }
  return <>{children}</>;
}

// ---------- file ----------
export function useFileUrl(ref: FileRef | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const key = ref?.path;
  useEffect(() => {
    let off = false;
    if (!ref) {
      setUrl(null);
      return;
    }
    api.fileUrl(ref).then(
      (u) => !off && setUrl(u),
      () => !off && setUrl(null),
    );
    return () => {
      off = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return url;
}

export const isImage = (f: FileRef) => f.type.startsWith('image/');

export function FileThumb({ file, large }: { file: FileRef; large?: boolean }) {
  const url = useFileUrl(file);
  if (isImage(file)) {
    return (
      <a className={`file-thumb ${large ? 'file-thumb-lg' : ''}`} href={url ?? undefined} target="_blank" rel="noreferrer" title={file.name}>
        {url ? <img src={url} alt={file.name} loading="lazy" /> : <span className="file-ph" />}
      </a>
    );
  }
  return (
    <a className="file-chip" href={url ?? undefined} download={file.name} target="_blank" rel="noreferrer">
      <Icon name="file" size={16} />
      <span>{file.name}</span>
      <small>{formatBytes(file.size)}</small>
    </a>
  );
}

export function FileList({ files }: { files: FileRef[] }) {
  if (files.length === 0) return null;
  return (
    <div className="file-list">
      {files.map((f) => (
        <FileThumb key={f.path} file={f} />
      ))}
    </div>
  );
}

const MAX_FILE = 15 * 1024 * 1024;

export function FileInput({ label, value, onChange, folder, max = 6, accept = 'image/*,.pdf,.ai,.eps,.svg,.psd', help }: {
  label: string; value: FileRef[]; onChange: (v: FileRef[]) => void; folder: string; max?: number; accept?: string; help?: string;
}) {
  const { toast } = useUi();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);

  async function add(list: FileList | File[]) {
    const files = Array.from(list);
    if (files.length === 0) return;
    if (value.length + files.length > max) {
      toast(`Puoi allegare al massimo ${max} file`, 'error');
      return;
    }
    setBusy(true);
    const added: FileRef[] = [];
    try {
      for (const f of files) {
        if (f.size > MAX_FILE) throw new Error(`${f.name} supera i 15 MB`);
        added.push(await api.uploadFile(f, folder));
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Caricamento non riuscito', 'error');
    } finally {
      setBusy(false);
      if (added.length) onChange([...value, ...added]);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div className="field">
      <label>{label}</label>
      <div
        className={`dropzone ${over ? 'over' : ''} ${busy ? 'is-busy' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void add(e.dataTransfer.files);
        }}
      >
        <Icon name="upload" size={22} />
        <span>{busy ? 'Caricamento…' : 'Trascina qui i file o'}</span>
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => input.current?.click()}>
          Scegli dal dispositivo
        </Button>
        <input ref={input} type="file" hidden multiple accept={accept} onChange={(e) => e.target.files && void add(e.target.files)} />
      </div>
      {help && <p className="help">{help}</p>}
      {value.length > 0 && (
        <ul className="upload-list">
          {value.map((f) => (
            <li key={f.path}>
              <FileThumb file={f} />
              <span className="upload-name">
                {f.name}
                <small>{formatBytes(f.size)}</small>
              </span>
              <button type="button" className="icon-btn" aria-label={`Rimuovi ${f.name}`} onClick={() => onChange(value.filter((x) => x.path !== f.path))}>
                <Icon name="close" size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------- indirizzo ----------
export const emptyAddress = (): Address => ({ name: '', street: '', city: '', zip: '', province: '', country: 'IT', phone: '' });

export function AddressForm({ value, onChange, errors = {}, withName = true }: { value: Address; onChange: (a: Address) => void; errors?: Record<string, string>; withName?: boolean }) {
  const set = (k: keyof Address) => (v: string) => onChange({ ...value, [k]: v });
  return (
    <div className="form-grid">
      {withName && <Input className="span-2" label="Nome e cognome del destinatario" value={value.name ?? ''} onChange={set('name')} autoComplete="name" error={errors.name} />}
      <Input className="span-2" label="Via e numero civico" value={value.street} onChange={set('street')} autoComplete="street-address" error={errors.street} />
      <Input label="CAP" value={value.zip} onChange={set('zip')} inputMode="numeric" maxLength={5} autoComplete="postal-code" error={errors.zip} />
      <Input label="Città" value={value.city} onChange={set('city')} autoComplete="address-level2" error={errors.city} />
      <Input label="Provincia" value={value.province} onChange={(v) => set('province')(v.toUpperCase())} maxLength={2} placeholder="RM" autoComplete="address-level1" error={errors.province} />
      <Input label="Telefono per il corriere" type="tel" value={value.phone ?? ''} onChange={set('phone')} autoComplete="tel" error={errors.phone} />
    </div>
  );
}

export function AddressText({ a }: { a: Address | null | undefined }) {
  if (!a || !a.street) return <span className="muted">Non indicato</span>;
  return (
    <address>
      {a.name && <>{a.name}<br /></>}
      {a.street}<br />
      {a.zip} {a.city} ({a.province}){a.phone && <><br />{a.phone}</>}
    </address>
  );
}

// ---------- prodotti ----------
export function Price({ product }: { product: Pick<Product, 'price_cents' | 'discount_percent'> }) {
  const now = basePrice(product);
  return (
    <span className="price">
      {product.discount_percent > 0 && <s>{eur(product.price_cents)}</s>}
      <strong>{eur(now)}</strong>
    </span>
  );
}

export function ProductCard({ product }: { product: Product }) {
  const { brands } = useCatalog();
  const wish = useWishlist();
  const brand = brands.find((b) => b.id === product.brand_id)?.name;
  const on = wish.has(product.id);
  const soldOut = product.stock != null && product.stock <= 0;
  return (
    <article className="pcard">
      <Link to={`/prodotto/${product.slug}`} className="pcard-art" aria-label={product.name}>
        <KitArt product={product} />
        {product.badge && <span className="badge">{product.badge}</span>}
        {product.discount_percent > 0 && <span className="badge badge-sale">−{product.discount_percent}%</span>}
        {soldOut && <span className="badge badge-off">Esaurito</span>}
      </Link>
      <button type="button" className={`heart ${on ? 'on' : ''}`} aria-pressed={on} aria-label={on ? 'Togli dai preferiti' : 'Aggiungi ai preferiti'} onClick={() => void wish.toggle(product.id)}>
        <Icon name="heart" size={18} />
      </button>
      <div className="pcard-body">
        <p className="pcard-meta">{brand ?? product.tags[0] ?? ''}</p>
        <h3>
          <Link to={`/prodotto/${product.slug}`}>{product.name}</Link>
        </h3>
        <Price product={product} />
      </div>
    </article>
  );
}

// ---------- ordini e messaggi ----------
export function Timeline({ events }: { events: OrderEvent[] }) {
  return (
    <ol className="timeline">
      {[...events].reverse().map((e) => (
        <li key={e.id}>
          <span className="tl-dot" />
          <div>
            <strong>{ORDER_STATUS[e.status].label}</strong>
            {e.note && <span className="tl-note"> · {e.note}</span>}
            <small>
              {fmtDateTime(e.created_at)}
              {e.actor_name ? ` · ${e.actor_name}` : ''}
            </small>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function Chat({ messages, meId, onSend, folder, disabled, placeholder }: {
  messages: ProjectMessage[]; meId: string; onSend: (body: string, files: FileRef[]) => Promise<unknown>; folder: string; disabled?: boolean; placeholder?: string;
}) {
  const { toast } = useUi();
  const [text, setText] = useState('');
  const [files, setFiles] = useState<FileRef[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const log = useRef<HTMLDivElement>(null);
  const pick = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = log.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  async function send() {
    if (!text.trim() && files.length === 0) return;
    setBusy(true);
    try {
      await onSend(text, files);
      setText('');
      setFiles([]);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Messaggio non inviato', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function attach(list: FileList | null) {
    if (!list) return;
    setUploading(true);
    try {
      const added: FileRef[] = [];
      for (const f of Array.from(list)) {
        if (f.size > MAX_FILE) throw new Error(`${f.name} supera i 15 MB`);
        added.push(await api.uploadFile(f, folder));
      }
      setFiles((cur) => [...cur, ...added].slice(0, 4));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Caricamento non riuscito', 'error');
    } finally {
      setUploading(false);
      if (pick.current) pick.current.value = '';
    }
  }

  return (
    <div className="chat">
      <div className="chat-log" ref={log} tabIndex={0} aria-label="Messaggi del progetto">
        {messages.length === 0 && <p className="muted chat-empty">Nessun messaggio. Scrivi qui per parlare con il grafico.</p>}
        {messages.map((m) =>
          m.kind === 'system' ? (
            <p key={m.id} className="msg-system">
              {m.body} <small>{timeAgo(m.created_at)}</small>
            </p>
          ) : (
            <div key={m.id} className={`msg ${m.sender_id === meId ? 'mine' : ''} ${m.sender_role !== 'customer' ? 'from-staff' : ''}`}>
              <div className="msg-bubble">
                <p className="msg-who">
                  {m.sender_name}
                  <small>{timeAgo(m.created_at)}</small>
                </p>
                {m.body && <p className="msg-body">{m.body}</p>}
                <FileList files={m.files} />
              </div>
            </div>
          ),
        )}
      </div>
      {!disabled && (
        <form
          className="chat-form"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          {files.length > 0 && (
            <div className="chat-files">
              {files.map((f) => (
                <span key={f.path} className="file-chip">
                  <Icon name="file" size={14} /> {f.name}
                  <button type="button" aria-label={`Rimuovi ${f.name}`} onClick={() => setFiles(files.filter((x) => x.path !== f.path))}>
                    <Icon name="close" size={14} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="chat-row">
            <button type="button" className="icon-btn" aria-label="Allega un file" onClick={() => pick.current?.click()} disabled={uploading}>
              <Icon name="upload" />
            </button>
            <input ref={pick} type="file" hidden multiple accept="image/*,.pdf,.ai,.eps,.svg" onChange={(e) => void attach(e.target.files)} />
            <textarea
              className="input textarea"
              rows={1}
              value={text}
              placeholder={placeholder ?? 'Scrivi un messaggio…'}
              aria-label="Messaggio"
              maxLength={2000}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <Button type="submit" busy={busy} icon="send">
              Invia
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

// ---------- bozze ----------
const PROOF_CHIP: Record<Proof['status'], { label: string; tone: 'warn' | 'ok' | 'info' | 'neutral' }> = {
  in_attesa: { label: 'Da approvare', tone: 'warn' },
  approvata: { label: 'Approvata', tone: 'ok' },
  modifiche: { label: 'Modifiche richieste', tone: 'info' },
  sostituita: { label: 'Sostituita', tone: 'neutral' },
};

export function ProofViewer({ proofs, canDecide, onDecide, reference }: {
  proofs: Proof[]; canDecide: boolean; onDecide?: (proof: Proof, decision: 'approvata' | 'modifiche', comment: string) => Promise<unknown>;
  /** Foto della moto del cliente (dagli allegati del brief): permette il confronto "la tua moto / bozza". */
  reference?: FileRef;
}) {
  const latest = proofs[proofs.length - 1];
  const [sel, setSel] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [comment, setComment] = useState('');
  const { run, busy } = useAction();
  const current = proofs.find((p) => p.id === sel) ?? latest;
  const url = useFileUrl(current?.file);
  const refUrl = useFileUrl(reference);
  const [compare, setCompare] = useState(true);

  if (!current) {
    return <Empty icon="pen" title="La prima bozza è in arrivo" text="Appena il grafico la carica la trovi qui, con il pulsante per approvarla o chiedere modifiche." />;
  }
  const chip = PROOF_CHIP[current.status];
  const canCompare = !!reference && isImage(reference) && isImage(current.file);
  const pending = canDecide && current.status === 'in_attesa' && current.id === latest?.id;

  return (
    <div className="proofs">
      <div className="proof-main">
        <div className="proof-left">
          {canCompare && compare && url && refUrl ? (
            <CompareSlider
              className="proof-cmp"
              before={<img src={refUrl} alt="La tua moto" />}
              after={<img src={url} alt={`Bozza versione ${current.version}`} />}
              beforeLabel="La tua moto"
              afterLabel={`Bozza v${current.version}`}
              label="Confronta la foto della tua moto con la bozza"
            />
          ) : (
            <div className="proof-img">
              {isImage(current.file) ? (
                url ? <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={`Bozza versione ${current.version}`} /></a> : <span className="file-ph" />
              ) : (
                <FileThumb file={current.file} />
              )}
            </div>
          )}
          {canCompare && (
            <button type="button" className="link-btn" aria-pressed={compare} onClick={() => setCompare(!compare)}>
              {compare ? 'Vedi solo la bozza' : 'Confronta con la tua moto'}
            </button>
          )}
        </div>
        <div className="proof-info">
          <div className="proof-head">
            <h3>Bozza v{current.version}</h3>
            <Chip tone={chip.tone}>{chip.label}</Chip>
          </div>
          <small className="muted">{fmtDateTime(current.created_at)}</small>
          {current.note && <p>{current.note}</p>}
          {current.customer_comment && (
            <blockquote>
              <small>Commento del cliente</small>
              {current.customer_comment}
            </blockquote>
          )}
          {pending && onDecide && (
            <div className="proof-actions">
              <Button busy={busy} icon="check" onClick={() => void run(() => onDecide(current, 'approvata', ''), 'Bozza approvata')}>
                Approva la bozza
              </Button>
              <Button variant="ghost" onClick={() => setAsking(true)}>
                Chiedi modifiche
              </Button>
            </div>
          )}
        </div>
      </div>
      {proofs.length > 1 && (
        <div className="proof-versions" role="tablist" aria-label="Versioni della bozza">
          {proofs.map((p) => (
            <button key={p.id} type="button" role="tab" aria-selected={p.id === current.id} className={`tab ${p.id === current.id ? 'on' : ''}`} onClick={() => setSel(p.id)}>
              v{p.version}
            </button>
          ))}
        </div>
      )}
      <Modal
        open={asking}
        onClose={() => setAsking(false)}
        title="Cosa vuoi cambiare?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAsking(false)}>Annulla</Button>
            <Button
              busy={busy}
              onClick={async () => {
                if (!onDecide) return;
                const ok = await run(async () => {
                  await onDecide(current, 'modifiche', comment);
                  return true;
                }, 'Modifiche inviate al grafico');
                if (ok) {
                  setAsking(false);
                  setComment('');
                }
              }}
            >
              Invia le modifiche
            </Button>
          </>
        }
      >
        <p className="muted">Le modifiche sono illimitate. Scrivi il più preciso possibile: colori, posizione dei nomi, sponsor.</p>
        <TextArea label="Modifiche richieste" value={comment} onChange={setComment} rows={5} maxLength={1000} />
      </Modal>
    </div>
  );
}

// ---------- pagamenti ----------
export const PAY_KIND: Record<Payment['kind'], string> = { ordine: 'Ordine', acconto: 'Acconto', saldo: 'Saldo' };

/** Pagamenti ancora da versare, con le istruzioni del metodo scelto. Solo in demo c'è il pulsante per simulare. */
export function PaymentBox({ payments, settings, reference }: { payments: Payment[]; settings: Settings; reference: string }) {
  const { run, busy } = useAction();
  const open = payments.filter((p) => p.status === 'in_attesa');
  if (open.length === 0) return null;
  return (
    <div className="paybox">
      {open.map((p) => {
        const m = settings.payment_methods.find((x) => x.id === p.method);
        return (
          <div key={p.id} className="paybox-row">
            <div>
              <h3>
                {PAY_KIND[p.kind]} da versare: <strong>{eur(p.amount_cents)}</strong>
              </h3>
              <p>
                <b>{m?.label ?? p.method}.</b> {m?.instructions}
              </p>
              <p className="paybox-ref">
                Causale: <code>{reference}</code>
              </p>
            </div>
            {isDemo && (
              <Button busy={busy} variant="dark" onClick={() => void run(() => api.demoPay!(p.id), 'Pagamento simulato: ricevuto')}>
                Paga ora (simulato)
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function PaymentsList({ payments }: { payments: Payment[] }) {
  if (payments.length === 0) return <p className="muted">Nessun pagamento registrato.</p>;
  return (
    <ul className="paylist">
      {payments.map((p) => (
        <li key={p.id}>
          <span>
            {PAY_KIND[p.kind]} · {p.method}
            <small>
              {p.paid_at ? `Ricevuto il ${fmtDateTime(p.paid_at)}` : 'In attesa'}
              {p.reference ? ` · ${p.reference}` : ''}
            </small>
          </span>
          <strong>{eur(p.amount_cents)}</strong>
          <Chip tone={p.status === 'ricevuto' ? 'ok' : p.status === 'rimborsato' ? 'neutral' : 'warn'}>
            {p.status === 'ricevuto' ? 'Ricevuto' : p.status === 'rimborsato' ? 'Rimborsato' : 'In attesa'}
          </Chip>
        </li>
      ))}
    </ul>
  );
}

export function TrackingText({ courier, code }: { courier: string; code: string }) {
  if (!code) return <span className="muted">Non ancora spedito</span>;
  return (
    <span>
      {courier} <code>{code}</code>
    </span>
  );
}
