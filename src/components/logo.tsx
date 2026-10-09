import { MARK, WORD } from '../lib/brand';

/** Il drago: simbolo del marchio, disegnato dal logo del cliente. Prende il colore del testo. */
export function Mark({ height = 36, className }: { height?: number; className?: string }) {
  return (
    <svg className={`mark ${className ?? ''}`} viewBox={`0 0 ${MARK.w} ${MARK.h}`} width={(height * MARK.w) / MARK.h} height={height} aria-hidden="true" focusable="false">
      <path d={MARK.d} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}

/** La scritta DRACO (e, se c'è spazio, GRAPHIX sotto). */
export function Wordmark({ height = 14, graphix, className }: { height?: number; graphix?: boolean; className?: string }) {
  const h = graphix ? 46.5 : 35;
  return (
    <svg className={`wordmark ${className ?? ''}`} viewBox={`0 3 ${WORD.w} ${h}`} width={(height * WORD.w) / h} height={height} aria-hidden="true" focusable="false">
      <path d={WORD.d} fill="currentColor" fillRule="evenodd" />
      {graphix && <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter" dangerouslySetInnerHTML={{ __html: WORD.graphix }} />}
    </svg>
  );
}

/** Marchio completo: simbolo + scritta. `compact` = solo simbolo. `stacked` = scritta sotto il simbolo. */
export function Logo({ compact, stacked, size }: { compact?: boolean; stacked?: boolean; size?: number }) {
  if (stacked) {
    const s = size ?? 110;
    return (
      <span className="logo logo-stacked" role="img" aria-label="Draco Graphix">
        <Mark height={s} />
        <Wordmark height={s * 0.32} graphix />
      </span>
    );
  }
  const s = size ?? 38;
  return (
    <span className="logo" role="img" aria-label="Draco Graphix">
      <Mark height={s} />
      {!compact && <Wordmark height={s * 0.4} />}
    </span>
  );
}
