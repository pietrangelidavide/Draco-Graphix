import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';

/**
 * Cursore "prima / dopo": due immagini sovrapposte e un bordo diagonale (come il taglio del marchio)
 * che si trascina con mouse o dito, si sposta con le frecce della tastiera o con i tre pulsanti sotto.
 * A sinistra del taglio si vede `before`, a destra `after`.
 */
export function CompareSlider({
  before,
  after,
  beforeLabel = 'Originale',
  afterLabel = 'Con le grafiche',
  label = 'Confronta la moto originale con quella con le grafiche',
  initial = 0.5,
  buttons = true,
  className,
}: {
  before: ReactNode;
  after: ReactNode;
  beforeLabel?: string;
  afterLabel?: string;
  label?: string;
  initial?: number;
  buttons?: boolean;
  className?: string;
}) {
  const [t, setT] = useState(initial);
  const [drag, setDrag] = useState(false);
  const [used, setUsed] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const usedRef = useRef(false);

  const touch = useCallback(() => {
    usedRef.current = true;
    setUsed(true);
  }, []);

  const fromPointer = useCallback((clientX: number) => {
    const el = box.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = ((clientX - r.left) / r.width) * 100; // 0..100
    // il taglio è inclinato: al centro dell'altezza sta a `mid`, che va da -4 a 104
    setT(Math.min(1, Math.max(0, (x + 4) / 108)));
  }, []);

  function down(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    touch();
    setDrag(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    fromPointer(e.clientX);
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    if (drag) fromPointer(e.clientX);
  }
  function up(e: PointerEvent<HTMLDivElement>) {
    setDrag(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }
  function key(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 0.15 : 0.04;
    let n: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') n = t + step;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') n = t - step;
    else if (e.key === 'PageUp') n = t + 0.15;
    else if (e.key === 'PageDown') n = t - 0.15;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = 1;
    if (n === null) return;
    e.preventDefault();
    touch();
    setT(Math.min(1, Math.max(0, n)));
  }

  // una sola volta, quando entra in vista, il taglio fa un piccolo avanti-indietro per far capire che si trascina
  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((en) => en.isIntersecting)) return;
        io.disconnect();
        let start = 0;
        const tick = (now: number) => {
          if (usedRef.current) return;
          if (!start) start = now;
          const k = (now - start) / 1700;
          if (k >= 1) {
            setT(initial);
            return;
          }
          setT(initial + 0.2 * Math.sin(k * Math.PI * 2) * (1 - k * 0.3));
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.7 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [initial]);

  const goTo = (v: number) => {
    touch();
    setT(v);
  };
  const pct = Math.round(t * 100);

  return (
    <div className={`cmp-wrap ${className ?? ''}`}>
      <div
        ref={box}
        className={`cmp ${drag ? 'is-drag' : ''}`}
        style={{ ['--t' as string]: t }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        <div className="cmp-layer cmp-after">{after}</div>
        <div className="cmp-layer cmp-before">{before}</div>
        <span className="cmp-tag cmp-tag-before">{beforeLabel}</span>
        <span className="cmp-tag cmp-tag-after">{afterLabel}</span>
        <div className="cmp-line" aria-hidden="true" />
        <div
          className="cmp-knob"
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-orientation="horizontal"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-valuetext={pct >= 98 ? beforeLabel : pct <= 2 ? afterLabel : `${pct}% ${beforeLabel.toLowerCase()}, ${100 - pct}% ${afterLabel.toLowerCase()}`}
          onKeyDown={key}
        >
          <svg viewBox="0 0 28 14" width="28" height="14" aria-hidden="true" focusable="false">
            <path d="M8 1 2 7l6 6M20 1l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="square" />
          </svg>
        </div>
        {!used && <span className="cmp-hint" aria-hidden="true">Trascina</span>}
      </div>
      {buttons && (
        <div className="cmp-modes" role="group" aria-label="Vista">
          <button type="button" className={pct >= 98 ? 'on' : ''} onClick={() => goTo(1)} aria-pressed={pct >= 98}>
            {beforeLabel}
          </button>
          <button type="button" className={pct > 2 && pct < 98 ? 'on' : ''} onClick={() => goTo(0.5)} aria-pressed={pct > 2 && pct < 98}>
            Confronto
          </button>
          <button type="button" className={pct <= 2 ? 'on' : ''} onClick={() => goTo(0)} aria-pressed={pct <= 2}>
            {afterLabel}
          </button>
        </div>
      )}
    </div>
  );
}
