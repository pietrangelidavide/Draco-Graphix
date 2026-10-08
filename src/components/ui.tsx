import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { Link } from '../router';
import type { Tone } from '../lib/status';
import { ORDER_STATUS, PAYMENT_STATUS, PROJECT_STATUS, QUOTE_STATUS } from '../lib/status';
import type { OrderStatus, PaymentStatus, ProjectStatus, QuoteStatus } from '../lib/types';
import { initials } from '../lib/util';

// ---------- icone (tratto 1.8, 24px) ----------
const ICONS: Record<string, string> = {
  cart: 'M3 4h2l2.2 10.2a1 1 0 0 0 1 .8h8.6a1 1 0 0 0 1-.76L19.5 8H6M9.5 19.5h.01M16.5 19.5h.01',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.8-3.8',
  menu: 'M4 7h16M4 12h16M4 17h16',
  close: 'M6 6l12 12M18 6L6 18',
  bell: 'M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.600-7 10-7 10z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  chevron: 'M9 6l6 6-6 6',
  chevdown: 'M6 9l6 6 6-6',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  truck: 'M2.5 6.5h11v9h-11zM13.5 9.5h4l3 3v3h-7zM7 18a1.6 1.6 0 1 0 0-.01zM17 18a1.6 1.6 0 1 0 0-.01z',
  box: 'M3.5 8L12 4l8.5 4v8.500L12 20.500 3.500 16.500zM3.500 8L12 12l8.500-4M12 12v8.500',
  pen: 'M4 20l4.500-1 11-11a2 2 0 0 0-3-3l-11 11zM14 7l3 3',
  file: 'M7 3.500h7l4 4v13H7zM14 3.500v4h4',
  trash: 'M5 7h14M10 7V4.500h4V7M7 7l.8 12.500h8.400L17 7M10 11v5M14 11v5',
  upload: 'M12 16V4M7 9l5-5 5 5M4.500 20h15',
  send: 'M4 12L20 4l-5 16-3.500-6.500z',
  print: 'M7 9V4h10v5M7 17H4.500v-6.500h15V17H17M7 14h10v6H7z',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  home: 'M4 11l8-7 8 7v9h-5v-6H9v6H4z',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  users: 'M9 11a3.500 3.500 0 1 0 0-7 3.500 3.500 0 0 0 0 7zM2.500 20a6.500 6.500 0 0 1 13 0M16 4.300a3.500 3.500 0 0 1 0 6.400M18 14.500a6.500 6.500 0 0 1 3.500 5.500',
  cog: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.400 15a1.700 1.700 0 0 0 .3 1.900l.1.100a2 2 0 1 1-2.800 2.800l-.1-.1a1.700 1.700 0 0 0-1.900-.3 1.700 1.700 0 0 0-1 1.500V21a2 2 0 1 1-4 0v-.1a1.700 1.700 0 0 0-1.100-1.500 1.700 1.700 0 0 0-1.900.3l-.1.100a2 2 0 1 1-2.800-2.800l.1-.1a1.700 1.700 0 0 0 .3-1.900 1.700 1.700 0 0 0-1.500-1H3a2 2 0 1 1 0-4h.1a1.700 1.700 0 0 0 1.500-1.100 1.700 1.700 0 0 0-.3-1.900l-.1-.1a2 2 0 1 1 2.800-2.800l.1.1a1.700 1.700 0 0 0 1.900.3H9a1.700 1.700 0 0 0 1-1.500V3a2 2 0 1 1 4 0v.1a1.700 1.700 0 0 0 1 1.500 1.700 1.700 0 0 0 1.900-.3l.1-.1a2 2 0 1 1 2.800 2.800l-.1.100a1.700 1.700 0 0 0-.3 1.900V9a1.700 1.700 0 0 0 1.500 1H21a2 2 0 1 1 0 4h-.1a1.700 1.700 0 0 0-1.500 1z',
  chat: 'M4 5h16v11H9l-5 4z',
  mail: 'M3.500 6h17v12h-17zM3.500 7l8.500 6.500L20.500 7',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  tag: 'M3.500 12.500V4.500h8l9 9-8 8zM8 8.500h.01',
  moon: 'M20 14.500A8 8 0 1 1 9.500 4 6.500 6.500 0 0 0 20 14.500z',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2.500v2M12 19.500v2M4.500 4.500l1.400 1.400M18.100 18.100l1.400 1.400M2.500 12h2M19.500 12h2M4.500 19.500l1.400-1.400M18.100 5.900l1.400-1.400',
  bike: 'M6 18a3.500 3.500 0 1 0 0-.01zM18 18a3.500 3.500 0 1 0 0-.01zM6 18l4-8h5l3 8M10 10l-1-3H7M13 6h3',
  euro: 'M17 6.500A6 6 0 0 0 7.500 9H15M7 12h7M17 17.500A6 6 0 0 1 7.500 15',
  warn: 'M12 4l9 16H3zM12 10v4M12 17h.01',
  logout: 'M10 4H5v16h5M14 8l4 4-4 4M18 12H9',
  eye: 'M2.500 12S6 5.500 12 5.500 21.500 12 21.500 12 18 18.500 12 18.500 2.500 12 2.500 12zM12 14.500a2.500 2.500 0 1 0 0-5 2.500 2.500 0 0 0 0 5z',
};

export function Icon({ name, size = 20, className }: { name: string; size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name] ?? ICONS.box} />
    </svg>
  );
}

// ---------- pulsanti ----------
type Variant = 'primary' | 'dark' | 'ghost' | 'danger' | 'quiet';
interface BtnBase {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
  className?: string;
  children?: ReactNode;
}

const btnClass = (p: BtnBase, extra = '') =>
  ['btn', `btn-${p.variant ?? 'primary'}`, p.size && p.size !== 'md' ? `btn-${p.size}` : '', p.block ? 'btn-block' : '', extra, p.className ?? ''].filter(Boolean).join(' ');

export function Button(p: BtnBase & { onClick?: () => void; type?: 'button' | 'submit'; busy?: boolean; disabled?: boolean; title?: string; icon?: string; 'aria-label'?: string }) {
  return (
    <button type={p.type ?? 'button'} className={btnClass(p, p.busy ? 'is-busy' : '')} onClick={p.onClick} disabled={p.disabled || p.busy} title={p.title} aria-label={p['aria-label']}>
      {p.icon && <Icon name={p.icon} size={18} />}
      {p.children}
    </button>
  );
}

export function LinkButton(p: BtnBase & { to: string; icon?: string }) {
  return (
    <Link to={p.to} className={btnClass(p)}>
      {p.icon && <Icon name={p.icon} size={18} />}
      {p.children}
    </Link>
  );
}

// ---------- campi ----------
interface FieldWrap {
  label?: string;
  error?: string;
  help?: string;
  className?: string;
  optional?: boolean;
}

function FieldShell({ id, label, error, help, className, optional, children }: FieldWrap & { id: string; children: ReactNode }) {
  return (
    <div className={`field ${error ? 'has-error' : ''} ${className ?? ''}`}>
      {label && (
        <label htmlFor={id}>
          {label}
          {optional && <span className="opt"> · facoltativo</span>}
        </label>
      )}
      {children}
      {help && !error && <p className="help">{help}</p>}
      {error && (
        <p className="err" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

interface InputProps extends FieldWrap {
  value: string;
  onChange: (v: string) => void;
  type?: 'text' | 'email' | 'password' | 'tel' | 'number' | 'date' | 'search';
  placeholder?: string;
  maxLength?: number;
  required?: boolean;
  autoComplete?: string;
  inputMode?: 'numeric' | 'decimal' | 'text' | 'tel' | 'email';
  name?: string;
  disabled?: boolean;
  min?: string;
  step?: string;
  prefix?: string;
}

export function Input(p: InputProps) {
  const id = useId();
  return (
    <FieldShell id={id} {...p}>
      <div className={p.prefix ? 'input-affix' : undefined}>
        {p.prefix && <span className="affix">{p.prefix}</span>}
        <input
          id={id}
          className="input"
          type={p.type ?? 'text'}
          value={p.value}
          onChange={(e) => p.onChange(e.target.value)}
          placeholder={p.placeholder}
          maxLength={p.maxLength}
          required={p.required}
          autoComplete={p.autoComplete}
          inputMode={p.inputMode}
          name={p.name}
          disabled={p.disabled}
          min={p.min}
          step={p.step}
          aria-invalid={p.error ? true : undefined}
        />
      </div>
    </FieldShell>
  );
}

export function TextArea(p: FieldWrap & { value: string; onChange: (v: string) => void; rows?: number; placeholder?: string; maxLength?: number; required?: boolean; disabled?: boolean }) {
  const id = useId();
  return (
    <FieldShell id={id} {...p}>
      <textarea id={id} className="input textarea" disabled={p.disabled} rows={p.rows ?? 4} value={p.value} onChange={(e) => p.onChange(e.target.value)} placeholder={p.placeholder} maxLength={p.maxLength} required={p.required} aria-invalid={p.error ? true : undefined} />
    </FieldShell>
  );
}

export function Select(p: FieldWrap & { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string; disabled?: boolean }) {
  const id = useId();
  return (
    <FieldShell id={id} {...p}>
      <select id={id} className="input select" value={p.value} onChange={(e) => p.onChange(e.target.value)} disabled={p.disabled} aria-invalid={p.error ? true : undefined}>
        {p.placeholder !== undefined && <option value="">{p.placeholder}</option>}
        {p.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function Checkbox({ label, checked, onChange, children }: { label?: string; checked: boolean; onChange: (v: boolean) => void; children?: ReactNode }) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children ?? label}</span>
    </label>
  );
}

/** Scelta tra poche opzioni, con prezzo in più accanto (base di stampa, laminazione). */
export function ChoiceGroup({ label, value, onChange, options, error, required }: {
  label: string; value: string; onChange: (v: string) => void; error?: string; required?: boolean;
  options: { value: string; label: string; note?: string }[];
}) {
  return (
    <fieldset className={`choices ${error ? 'has-error' : ''}`}>
      <legend>
        {label}
        {required === false && <span className="opt"> · facoltativo</span>}
      </legend>
      <div className="choice-row">
        {options.map((o) => (
          <label key={o.value} className={`choice ${value === o.value ? 'on' : ''}`}>
            <input type="radio" name={label} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
            <span className="choice-label">{o.label}</span>
            {o.note && <span className="choice-note">{o.note}</span>}
          </label>
        ))}
      </div>
      {error && (
        <p className="err" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}

// ---------- stati ----------
export function Chip({ tone = 'neutral', children, dot = true }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={`chip chip-${tone}`}>
      {dot && <i className="dot" />}
      {children}
    </span>
  );
}

export const OrderChip = ({ status }: { status: OrderStatus }) => <Chip tone={ORDER_STATUS[status].tone}>{ORDER_STATUS[status].label}</Chip>;
export const PaymentChip = ({ status }: { status: PaymentStatus }) => <Chip tone={PAYMENT_STATUS[status].tone}>{PAYMENT_STATUS[status].label}</Chip>;
export const ProjectChip = ({ status }: { status: ProjectStatus }) => <Chip tone={PROJECT_STATUS[status].tone}>{PROJECT_STATUS[status].label}</Chip>;
export const QuoteChip = ({ status }: { status: QuoteStatus }) => <Chip tone={QUOTE_STATUS[status].tone}>{QUOTE_STATUS[status].label}</Chip>;

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

// ---------- struttura ----------
export function PageHead({ title, sub, actions, back }: { title: string; sub?: ReactNode; actions?: ReactNode; back?: { to: string; label: string } }) {
  return (
    <header className="page-head">
      <div>
        {back && (
          <Link to={back.to} className="back">
            <Icon name="chevron" size={14} className="flip" /> {back.label}
          </Link>
        )}
        <h1>{title}</h1>
        {sub && <p className="sub">{sub}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Card({ title, actions, children, className, tone }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; tone?: 'warn' | 'accent' }) {
  return (
    <section className={`card ${tone ? `card-${tone}` : ''} ${className ?? ''}`}>
      {(title || actions) && (
        <header className="card-head">
          {title && <h2>{title}</h2>}
          {actions && <div className="card-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Empty({ title, text, action, icon = 'box' }: { title: string; text?: string; action?: ReactNode; icon?: string }) {
  return (
    <div className="empty">
      <Icon name={icon} size={30} />
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function Loading({ label = 'Caricamento…' }: { label?: string }) {
  return (
    <div className="loading" role="status">
      <span className="cmyk">
        <i />
        <i />
        <i />
        <i />
      </span>
      <span>{label}</span>
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="errorbox" role="alert">
      <Icon name="warn" />
      <p>{message}</p>
      {onRetry && (
        <Button variant="ghost" size="sm" onClick={onRetry}>
          Riprova
        </Button>
      )}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}>
        <header>
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Chiudi">
            <Icon name="close" />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer>{footer}</footer>}
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (id: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} type="button" role="tab" aria-selected={value === t.id} className={`tab ${value === t.id ? 'on' : ''}`} onClick={() => onChange(t.id)}>
          {t.label}
          {t.count !== undefined && <span className="tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Tappe di avanzamento (ordine o progetto). `current` è l'indice della tappa attuale. */
export function Stepper({ steps, current, done }: { steps: { key: string; label: string }[]; current: number; done?: boolean }) {
  const now = steps[Math.min(current, steps.length - 1)];
  return (
    <>
      <ol className="stepper">
        {steps.map((s, i) => {
          const state = done || i < current ? 'done' : i === current ? 'now' : 'next';
          return (
            <li key={s.key} className={`step step-${state}`} aria-current={state === 'now' ? 'step' : undefined}>
              <span className="step-dot">{state === 'done' ? <Icon name="check" size={14} /> : i + 1}</span>
              <span className="step-label">{s.label}</span>
            </li>
          );
        })}
      </ol>
      <p className="stepper-now" aria-hidden="true">
        {done ? 'Completato' : `Passo ${current + 1} di ${steps.length}: ${now?.label ?? ''}`}
      </p>
    </>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'warn' | 'ok' }) {
  return (
    <div className={`stat ${tone ? `stat-${tone}` : ''}`}>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  );
}

export function Dl({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="dl">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <span className="logo" aria-label="Draco Graphix">
      <svg viewBox="0 0 64 64" width="34" height="34" aria-hidden="true">
        <path d="M10 10h24c11 0 20 8 20 22S45 54 34 54H10z" fill="var(--accent)" />
        <path d="M24 24h9c5 0 8 3 8 8s-3 8-8 8h-9z" fill="var(--logo-hole)" />
        <path d="M44 6l12 12-6 5z" fill="var(--ink)" />
      </svg>
      {!compact && (
        <span className="logo-text">
          <b>DRACO</b>
          <span>GRAPHIX</span>
        </span>
      )}
    </span>
  );
}
