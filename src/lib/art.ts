import { hashString, rng } from './util';

// Genera la "tavola di stampa" di un kit: pezzi fustellati (fiancata, tabella, parafango, forcella)
// riempiti con una grafica diversa per ogni prodotto. Serve finché non ci sono le foto vere:
// quando il titolare carica un'immagine, questa prende il posto della grafica generata.

export interface ArtOptions {
  /** Prefisso degli id interni: obbligatorio se più SVG vivono nella stessa pagina. */
  idPrefix?: string;
  number?: string;
  name?: string;
  base?: string;
  finish?: string;
}

const FALLBACK = ['#d81f26', '#14161a', '#f2f2f2'];

function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0.5;
  const n = parseInt(m[1]!, 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const PIECES = {
  side: 'M54 150 L408 96 Q462 88 474 138 L496 332 Q502 386 452 398 L118 474 Q64 486 50 432 Z',
  plate: 'M556 78 Q648 40 740 78 L748 240 Q648 270 548 240 Z',
  fender: 'M520 320 Q624 286 748 322 L752 392 Q630 366 520 418 Z',
  forkL: 'M560 440 L584 440 L580 560 L564 560 Z',
  forkR: 'M606 440 L630 440 L626 560 L610 560 Z',
};

function pattern(kind: number, c: string[], r: () => number): string {
  const [a, b, d] = [c[0] ?? FALLBACK[0]!, c[1] ?? FALLBACK[1]!, c[2] ?? FALLBACK[2]!];
  const cols = [a, b, d, a, d];
  let out = `<rect width="800" height="600" fill="${b}"/>`;
  if (kind === 0) {
    // fasce diagonali
    out += '<g transform="rotate(-16 400 300)">';
    let y = -80;
    for (let i = 0; i < 9; i++) {
      const h = 30 + Math.round(r() * 80);
      out += `<rect x="-100" y="${y}" width="1000" height="${h}" fill="${cols[i % cols.length]}"/>`;
      y += h + (r() > 0.6 ? 14 : 0);
    }
    out += '</g>';
  } else if (kind === 1) {
    // schegge
    for (let i = 0; i < 11; i++) {
      const x = r() * 800, y = r() * 600, s = 120 + r() * 260, rot = r() * 360;
      out += `<polygon points="0,0 ${s},${s * 0.18} ${s * 0.4},${s * 0.7}" fill="${cols[i % cols.length]}" opacity="${0.75 + r() * 0.25}" transform="translate(${x} ${y}) rotate(${rot})"/>`;
    }
  } else {
    // onde
    for (let i = 0; i < 6; i++) {
      const y = i * 110 - 30, w = 26 + r() * 70;
      out += `<path d="M-40 ${y + 60} C 180 ${y - 80}, 320 ${y + 200}, 560 ${y + 40} S 820 ${y + 120}, 860 ${y - 20}" fill="none" stroke="${cols[i % cols.length]}" stroke-width="${w}" stroke-linecap="round"/>`;
    }
  }
  return out;
}

/** SVG completo della tavola di stampa di un prodotto. */
export function kitArtSvg(seedKey: string, colors: string[], opts: ArtOptions = {}): string {
  const id = opts.idPrefix ?? 'k';
  const seed = hashString(seedKey);
  const r = rng(seed);
  const kind = seed % 3;
  const [c0, c1, c2] = [colors[0] ?? FALLBACK[0]!, colors[1] ?? FALLBACK[1]!, colors[2] ?? FALLBACK[2]!];
  const pat = pattern(kind, colors, r);

  const clips = Object.entries(PIECES)
    .map(([k, d]) => `<clipPath id="${id}-c-${k}"><path d="${d}"/></clipPath>`)
    .join('');

  // un pezzo = grafica ritagliata (con piccolo spostamento diverso) + linea di taglio tratteggiata
  const offsets: Record<string, string> = { side: '0 0', plate: '-120 40', fender: '-60 -120', forkL: '-200 -300', forkR: '-300 -260' };
  const piece = (k: keyof typeof PIECES) =>
    `<g clip-path="url(#${id}-c-${k})"><g transform="translate(${offsets[k]})">${pat}</g>${effects(k)}</g>`;

  const sparkle = () => {
    const rr = rng(seed ^ 0x9e3779b9);
    let s = '';
    for (let i = 0; i < 90; i++) s += `<circle cx="${Math.round(rr() * 800)}" cy="${Math.round(rr() * 600)}" r="${(0.8 + rr() * 2.2).toFixed(1)}" fill="#fff" opacity="${(0.35 + rr() * 0.6).toFixed(2)}"/>`;
    return s;
  };

  const base = opts.base ?? 'classica';
  const finish = opts.finish ?? 'lucido';
  const effects = (k: string) => {
    let e = '';
    if (base === 'cromo') e += `<rect width="800" height="600" fill="url(#${id}-chrome)" style="mix-blend-mode:hard-light" opacity="0.7"/>`;
    if (base === 'olografico') e += `<rect width="800" height="600" fill="url(#${id}-holo)" style="mix-blend-mode:screen" opacity="0.62"/>`;
    if (finish === 'lucido') e += `<polygon points="-50,0 330,0 80,600 -50,600" fill="#fff" opacity="0.2"/><polygon points="360,0 440,0 190,600 110,600" fill="#fff" opacity="0.1" transform="translate(${k === 'plate' ? 120 : 160} 0)"/>`;
    if (finish === 'glitter') e += sparkle();
    return e;
  };

  const plateFill = luminance(c2) > 0.35 ? c2 : '#f2f2f2';
  const ink = luminance(plateFill) > 0.4 ? '#111214' : '#ffffff';
  const num = (opts.number ?? '').trim().slice(0, 3);
  const nm = (opts.name ?? '').trim().slice(0, 18);
  const plateText =
    `<g clip-path="url(#${id}-c-plate)"><rect x="500" y="40" width="300" height="240" fill="${plateFill}"/>` +
    `<rect x="500" y="40" width="300" height="38" fill="${c0}"/>` +
    (num
      ? `<text x="648" y="${nm ? 205 : 220}" text-anchor="middle" font-family="'Big Shoulders Display',Impact,'Arial Narrow',sans-serif" font-weight="800" font-size="${num.length > 2 ? 118 : 150}" fill="${ink}" font-style="italic">${esc(num)}</text>`
      : '') +
    (nm ? `<text x="648" y="248" text-anchor="middle" font-family="'Archivo',Arial,sans-serif" font-weight="700" font-size="25" letter-spacing="2" fill="${ink}">${esc(nm.toUpperCase())}</text>` : '') +
    (base === 'cromo' ? `<rect x="500" y="40" width="300" height="240" fill="url(#${id}-chrome)" style="mix-blend-mode:hard-light" opacity="0.7"/>` : '') +
    (base === 'olografico' ? `<rect x="500" y="40" width="300" height="240" fill="url(#${id}-holo)" style="mix-blend-mode:screen" opacity="0.62"/>` : '') +
    (finish === 'lucido' ? '<polygon points="500,40 640,40 560,280 500,280" fill="#fff" opacity="0.2"/>' : '') +
    (finish === 'glitter' ? sparkle().slice(0, 1400) : '') +
    '</g>';

  const cut = Object.values(PIECES)
    .map((d) => `<path d="${d}" fill="none" stroke="#ff2a8a" stroke-width="2" stroke-dasharray="9 7" opacity="0.9"/>`)
    .join('');

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" role="img" aria-label="Anteprima grafica">` +
    `<defs>${clips}` +
    `<linearGradient id="${id}-chrome" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eef1f5"/><stop offset=".22" stop-color="#7c8591"/><stop offset=".45" stop-color="#f9fbfd"/><stop offset=".7" stop-color="#59616c"/><stop offset="1" stop-color="#dfe3e9"/></linearGradient>` +
    `<linearGradient id="${id}-holo" x1="0" y1="0" x2="1" y2="0.4"><stop offset="0" stop-color="#ff7ad9"/><stop offset=".25" stop-color="#7ad7ff"/><stop offset=".5" stop-color="#9dffb0"/><stop offset=".75" stop-color="#ffe27a"/><stop offset="1" stop-color="#c58cff"/></linearGradient>` +
    `</defs>` +
    `<rect width="800" height="600" fill="#101215"/>` +
    `<g opacity="0.07" stroke="#fff"><path d="M0 40H800M0 560H800M40 0V600M760 0V600"/></g>` +
    piece('side') + piece('fender') + piece('forkL') + piece('forkR') + plateText + cut +
    `<g stroke="${c1 === '#14161a' ? '#fff' : c0}" stroke-width="2" opacity="0.5"><path d="M18 40V18H40M760 18H782V40M18 560V582H40M782 560V582H760"/></g>` +
    `</svg>`
  );
}

export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function kitArtUrl(seedKey: string, colors: string[], opts: ArtOptions = {}): string {
  return svgDataUrl(kitArtSvg(seedKey, colors, opts));
}
