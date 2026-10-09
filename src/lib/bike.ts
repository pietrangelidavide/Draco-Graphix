import { FALLBACK, esc, fxDefs, kitPattern, luminance } from './art';
import { hashString, rng } from './util';

// Moto da cross disegnata in vettoriale, in due versioni identiche per ogni pezzo meccanico:
//  - "stock": plastiche nere, com'è la moto prima del kit
//  - "custom": le stesse plastiche rivestite con la grafica del kit (e numero, nome, base, laminazione)
// Le due versioni si sovrappongono al pixel e il cursore "prima/dopo" le mostra una accanto all'altra.
// Quando ci sono le foto vere del cliente basta passare quelle al cursore al posto di queste.

export const BIKE_W = 960;
export const BIKE_H = 600;

export interface BikeOptions {
  variant: 'stock' | 'custom';
  /** Identifica la grafica (stessa chiave del catalogo: stessa grafica in vetrina e nel confronto). */
  seedKey: string;
  colors: string[];
  number?: string;
  name?: string;
  base?: string;
  finish?: string;
  /** Prefisso degli id interni: obbligatorio se più moto stanno nella stessa pagina. */
  idPrefix: string;
  /** Aggiunge lo sfondo da studio: serve quando la moto è un'immagine a sé (demo, bozze) e non dentro il cursore. */
  stage?: boolean;
}

const f1 = (n: number) => (Math.round(n * 10) / 10).toString();

// ruote e forcella
const RW = { x: 205, y: 418, r: 130 };
const FW = { x: 768, y: 408, r: 140 };
const TOP = { x: 618, y: 114 }; // piastra superiore della forcella
const AX = { x: FW.x - TOP.x, y: FW.y - TOP.y };
const fork = (t: number) => ({ x: TOP.x + AX.x * t, y: TOP.y + AX.y * t });
const FANG = Math.atan2(AX.x, AX.y); // inclinazione dello sterzo
const NRM = { x: Math.cos(FANG), y: -Math.sin(FANG) }; // verso l'avanti, perpendicolare alla forcella

function wheel(cx: number, cy: number, r: number, kind: 'front' | 'rear'): string {
  const knobs = Math.round(r / 3.6);
  const circ = 2 * Math.PI * (r - 6);
  const dash = (circ / knobs) * 0.56;
  let s = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#0f0f11"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="${r - 6}" fill="none" stroke="#2a2a2e" stroke-width="12" stroke-dasharray="${f1(dash)} ${f1(circ / knobs - dash)}"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="${r - 19}" fill="#1a1a1d"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="${r - 27}" fill="#d9dbdf"/><circle cx="${cx}" cy="${cy}" r="${r - 34}" fill="#2a2b2f"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="${r - 34}" fill="#202023"/>`;
  const n = 36;
  const rIn = 20;
  const rOut = r - 34;
  s += '<g stroke="#9ea1a8" stroke-width="1.3" stroke-linecap="round">';
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n;
    const b = a + (i % 2 ? 0.2 : -0.2);
    s += `<line x1="${f1(cx + rIn * Math.cos(a))}" y1="${f1(cy + rIn * Math.sin(a))}" x2="${f1(cx + rOut * Math.cos(b))}" y2="${f1(cy + rOut * Math.sin(b))}"/>`;
  }
  s += '</g>';
  if (kind === 'front') {
    s += `<circle cx="${cx}" cy="${cy}" r="52" fill="none" stroke="#a9acb3" stroke-width="22"/><circle cx="${cx}" cy="${cy}" r="52" fill="none" stroke="#3b3c41" stroke-width="3" stroke-dasharray="3 7"/>`;
  } else {
    s += `<circle cx="${cx}" cy="${cy}" r="47" fill="none" stroke="#8b8e95" stroke-width="9"/><circle cx="${cx}" cy="${cy}" r="47" fill="none" stroke="#2c2d31" stroke-width="9" stroke-dasharray="4 4" opacity="0.55"/>`;
  }
  s += `<circle cx="${cx}" cy="${cy}" r="21" fill="#a2a5ab"/><circle cx="${cx}" cy="${cy}" r="12" fill="#52555b"/><circle cx="${cx}" cy="${cy}" r="4.5" fill="#1b1b1d"/>`;
  return s;
}

// forme delle plastiche: qui va la grafica
const PARTS = {
  rear: 'M64 146 C132 152 224 167 316 178 L318 200 C232 202 138 194 74 172 Z',
  side: 'M304 190 L472 193 L490 250 L444 304 L356 294 L318 250 Z',
  shroud: 'M466 190 C500 177 562 170 614 150 L644 147 L670 200 L654 240 L606 274 C576 294 538 302 502 298 L474 264 Z',
  fender: 'M658 286 A164 164 0 0 1 927 368 L910 373 A146 146 0 0 0 670 300 Z',
};

function guardPath(): string {
  const a = fork(0.6);
  const b = fork(0.9);
  const w = 12;
  const p = (q: { x: number; y: number }, k: number) => `${f1(q.x + NRM.x * k)} ${f1(q.y + NRM.y * k)}`;
  return `M${p(a, w)} L${p(b, w + 2)} L${p(b, -w + 2)} L${p(a, -w)} Z`;
}

const PLATE_MATRIX = 'matrix(0.44 0.13 0.06 0.43 618 66)';
const PLATE_PATH = 'M12 0 L200 0 L200 188 L186 200 L0 200 L0 12 Z';

export function bikeSvg(o: BikeOptions): string {
  const id = o.idPrefix;
  const custom = o.variant === 'custom';
  const c0 = o.colors[0] ?? FALLBACK[0]!;
  const c1 = o.colors[1] ?? FALLBACK[1]!;
  const c2 = o.colors[2] ?? FALLBACK[2]!;
  const plateFill = luminance(c2) > 0.35 ? c2 : '#f2f2f2';
  const ink = luminance(plateFill) > 0.4 ? '#111214' : '#ffffff';
  const num = (o.number ?? '').trim().slice(0, 3);
  const nm = (o.name ?? '').trim().slice(0, 18);
  const base = o.base ?? 'classica';
  const finish = o.finish ?? 'lucido';
  const guard = guardPath();

  const defs =
    fxDefs(id) +
    `<linearGradient id="${id}-metal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e4e6ea"/><stop offset=".45" stop-color="#9a9da4"/><stop offset="1" stop-color="#c3c6cb"/></linearGradient>` +
    `<linearGradient id="${id}-dark" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3a40"/><stop offset=".25" stop-color="#1c1c1f"/><stop offset="1" stop-color="#0e0e10"/></linearGradient>` +
    `<linearGradient id="${id}-frame" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a4a52"/><stop offset="1" stop-color="#26262a"/></linearGradient>` +
    `<radialGradient id="${id}-shadow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000" stop-opacity=".32"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>` +
    `<clipPath id="${id}-kit"><path d="${PARTS.rear}"/><path d="${PARTS.side}"/><path d="${PARTS.shroud}"/><path d="${PARTS.fender}"/><path d="${guard}"/></clipPath>`;

  // ---- meccanica (uguale nelle due versioni)
  const hd = fork(0.07);
  const hd2 = fork(0.3);
  let m = '';
  m += `<ellipse cx="490" cy="552" rx="470" ry="16" fill="url(#${id}-shadow)"/>`;
  m += wheel(RW.x, RW.y, RW.r, 'rear');
  // forcellone, catena
  m += `<path d="M372 398 L214 407 L214 431 L372 446 Z" fill="url(#${id}-metal)" stroke="#5d6067" stroke-width="2"/>`;
  m += `<g stroke="#2a2a2e" stroke-width="5" fill="none"><path d="M205 371 L402 424"/><path d="M205 465 L402 458"/></g>`;
  m += `<circle cx="205" cy="418" r="14" fill="#6b6e75"/><circle cx="205" cy="418" r="6" fill="#1b1b1d"/>`;
  // telaio
  m += `<g fill="none" stroke="url(#${id}-frame)" stroke-linecap="round" stroke-linejoin="round">`;
  m += `<path d="M640 152 C560 172 428 204 366 300 L376 410" stroke-width="22"/>`;
  m += `<path d="M652 214 C646 330 604 452 472 480 L384 470" stroke-width="14"/>`;
  m += `<path d="M366 244 L130 190" stroke-width="13"/>`;
  m += `</g>`;
  // ammortizzatore
  m += `<path d="M402 286 L346 400" stroke="#26262a" stroke-width="20" stroke-linecap="round"/>`;
  m += `<path d="M397 298 L353 386" stroke="#cfd1d6" stroke-width="24" stroke-dasharray="5 3" stroke-linecap="butt"/>`;
  m += `<path d="M397 298 L353 386" stroke="#6a6c73" stroke-width="3"/>`;
  // scarico: collettore e silenziatore
  m += `<path d="M548 300 C602 332 606 424 520 452 C446 476 390 428 352 330 L338 268" fill="none" stroke="#b9bcc2" stroke-width="12" stroke-linecap="round"/>`;
  m += `<path d="M548 300 C602 332 606 424 520 452 C446 476 390 428 352 330 L338 268" fill="none" stroke="#7a7d84" stroke-width="2.5" stroke-linecap="round" opacity=".7"/>`;
  m += `<path d="M352 248 L157 178 L147 206 L342 276 Z" fill="url(#${id}-metal)" stroke="#6a6d74" stroke-width="2" stroke-linejoin="round"/>`;
  m += `<path d="M157 178 L147 206 L131 200 L141 172 Z" fill="#33343a" stroke="#1b1b1d" stroke-width="1.5" stroke-linejoin="round"/>`;
  m += `<path d="M336 262 L330 280 M262 235 L255 252" stroke="#4d5057" stroke-width="4"/>`;
  m += `<path d="M345 256 L160 190" stroke="#f3f4f6" stroke-width="3" opacity=".6"/>`;
  // motore
  m += `<path d="M470 326 L504 238 L566 258 L548 336 Z" fill="#2a2b30"/>`;
  m += `<g stroke="#5a5c63" stroke-width="2.5"><path d="M482 300 L554 322"/><path d="M488 284 L560 304"/><path d="M494 268 L560 288"/><path d="M500 252 L564 270"/></g>`;
  m += `<path d="M404 330 L500 322 L550 352 L554 432 L512 480 L410 480 L384 412 Z" fill="url(#${id}-metal)" stroke="#6d7077" stroke-width="2"/>`;
  m += `<circle cx="508" cy="418" r="36" fill="#7d8087" stroke="#44464c" stroke-width="3"/><circle cx="508" cy="418" r="22" fill="#a8abb1" stroke="#5a5d64" stroke-width="2"/><circle cx="508" cy="418" r="6" fill="#33353a"/>`;
  m += `<path d="M404 352 L450 348 L446 420 L410 430 Z" fill="#8b8e95" stroke="#5d6067" stroke-width="2"/>`;
  m += `<path d="M396 482 L520 482 L542 498 L408 500 Z" fill="#c7c9ce" stroke="#6a6d74" stroke-width="2"/>`;
  m += `<rect x="408" y="478" width="56" height="9" fill="#d3d5da" stroke="#6a6d74" stroke-width="1.5" transform="rotate(3 436 482)"/>`;
  // sella
  m += `<path d="M298 182 L470 187 C494 188 499 204 481 208 L312 207 C292 206 286 190 298 182 Z" fill="url(#${id}-dark)" stroke="#34343a" stroke-width="1.5"/>`;
  m += `<path d="M310 186 L466 190" stroke="#4d4d55" stroke-width="2"/>`;
  m += `<path d="M310 206 L322 196 M338 206 L350 196 M366 206 L378 196" stroke="#303034" stroke-width="2"/>`;
  // ruota anteriore
  m += wheel(FW.x, FW.y, FW.r, 'front');
  m += `<rect x="776" y="448" width="22" height="30" rx="3" fill="#cfd1d6" stroke="#6a6d74" stroke-width="2" transform="rotate(-8 787 463)"/>`;
  // cannotto, forcella
  m += `<path d="M${f1(hd.x)} ${f1(hd.y)} L${f1(hd2.x)} ${f1(hd2.y)}" stroke="url(#${id}-frame)" stroke-width="30" stroke-linecap="round" transform="translate(-8 4)"/>`;
  const u0 = fork(0.02);
  const u1 = fork(0.58);
  const l0 = fork(0.5);
  const l1 = fork(1);
  m += `<path d="M${f1(u0.x)} ${f1(u0.y)} L${f1(u1.x)} ${f1(u1.y)}" stroke="#d9dbdf" stroke-width="15" stroke-linecap="butt"/>`;
  m += `<path d="M${f1(u0.x + 3)} ${f1(u0.y)} L${f1(u1.x + 3)} ${f1(u1.y)}" stroke="#8c8f96" stroke-width="3" opacity=".8"/>`;
  m += `<path d="M${f1(l0.x)} ${f1(l0.y)} L${f1(l1.x)} ${f1(l1.y)}" stroke="#18181a" stroke-width="21" stroke-linecap="butt"/>`;
  // piastre
  const pa = fork(0.04);
  const pb = fork(0.2);
  m += `<path d="M${f1(pa.x - 22)} ${f1(pa.y - 8)} L${f1(pa.x + 14)} ${f1(pa.y + 4)} L${f1(pa.x + 12)} ${f1(pa.y + 26)} L${f1(pa.x - 22)} ${f1(pa.y + 16)} Z" fill="#303034" stroke="#555860" stroke-width="1.5"/>`;
  m += `<path d="M${f1(pb.x - 20)} ${f1(pb.y - 8)} L${f1(pb.x + 18)} ${f1(pb.y + 4)} L${f1(pb.x + 16)} ${f1(pb.y + 24)} L${f1(pb.x - 20)} ${f1(pb.y + 12)} Z" fill="#303034" stroke="#555860" stroke-width="1.5"/>`;
  // manubrio
  m += `<path d="M610 108 L588 86" stroke="#c9ccd1" stroke-width="8" stroke-linecap="round"/>`;
  m += `<circle cx="586" cy="82" r="11" fill="#17171a" stroke="#3b3b40" stroke-width="2"/><circle cx="586" cy="82" r="5" fill="#2e2e33"/>`;
  m += `<path d="M598 92 L690 82" stroke="#cfd1d6" stroke-width="3" stroke-linecap="round"/><path d="M690 82 L694 90" stroke="#cfd1d6" stroke-width="3" stroke-linecap="round"/>`;

  // ---- plastiche
  const stockFill = `url(#${id}-dark)`;
  let pl = '';
  if (!custom) {
    const sk = (d: string) => `<path d="${d}" fill="${stockFill}" stroke="#42424a" stroke-width="1.5" stroke-linejoin="round"/>`;
    pl += sk(PARTS.rear) + sk(PARTS.side) + sk(PARTS.shroud) + sk(PARTS.fender) + sk(guard);
    pl += `<g transform="${PLATE_MATRIX}"><path d="${PLATE_PATH}" fill="${stockFill}" stroke="#42424a" stroke-width="3"/></g>`;
    pl += `<g fill="none" stroke="#6a6a73" stroke-width="1.6" stroke-linecap="round" opacity=".55"><path d="M472 196 C500 185 560 176 612 156"/><path d="M80 152 C140 158 226 170 314 182"/><path d="M670 296 A158 158 0 0 1 912 368"/></g>`;
  } else {
    const seed = hashString(o.seedKey);
    const sparkle = () => {
      const rr = rng(seed ^ 0x9e3779b9);
      let s = '';
      for (let i = 0; i < 140; i++) s += `<circle cx="${Math.round(rr() * BIKE_W)}" cy="${Math.round(60 + rr() * 440)}" r="${(0.8 + rr() * 2.2).toFixed(1)}" fill="#fff" opacity="${(0.35 + rr() * 0.6).toFixed(2)}"/>`;
      return s;
    };
    pl += `<g clip-path="url(#${id}-kit)">`;
    pl += `<g transform="translate(-10 -40) scale(1.25)">${kitPattern(o.seedKey, [c0, c1, c2])}</g>`;
    pl += `<g transform="rotate(-17 500 260)"><rect x="-300" y="206" width="1700" height="54" fill="${c0}"/><rect x="-300" y="268" width="1700" height="9" fill="${c2}"/><rect x="-300" y="188" width="1700" height="8" fill="${c2}"/><rect x="-300" y="296" width="1700" height="40" fill="${c1}" opacity=".85"/></g>`;
    if (base === 'cromo') pl += `<rect width="${BIKE_W}" height="${BIKE_H}" fill="url(#${id}-chrome)" style="mix-blend-mode:hard-light" opacity="0.7"/>`;
    if (base === 'olografico') pl += `<rect width="${BIKE_W}" height="${BIKE_H}" fill="url(#${id}-holo)" style="mix-blend-mode:screen" opacity="0.62"/>`;
    if (finish === 'lucido') pl += `<polygon points="60,60 380,60 250,520 -40,520" fill="#fff" opacity="0.2"/><polygon points="420,60 520,60 400,520 310,520" fill="#fff" opacity="0.1"/><polygon points="660,60 740,60 640,520 570,520" fill="#fff" opacity="0.1"/>`;
    if (finish === 'glitter') pl += sparkle();
    pl += `</g>`;
    pl += `<g fill="none" stroke="#000" stroke-opacity=".38" stroke-width="1.4" stroke-linejoin="round"><path d="${PARTS.rear}"/><path d="${PARTS.side}"/><path d="${PARTS.shroud}"/><path d="${PARTS.fender}"/><path d="${guard}"/></g>`;
    // tabella frontale con il numero
    pl += `<g transform="${PLATE_MATRIX}"><clipPath id="${id}-pl"><path d="${PLATE_PATH}"/></clipPath><g clip-path="url(#${id}-pl)">`;
    pl += `<rect width="200" height="200" fill="${plateFill}"/><rect width="200" height="34" fill="${c0}"/>`;
    if (num) pl += `<text x="100" y="${nm ? 142 : 156}" text-anchor="middle" font-family="'Saira','Liberation Sans',Arial,sans-serif" font-weight="800" font-style="italic" font-size="${num.length > 2 ? 94 : 118}" fill="${ink}">${esc(num)}</text>`;
    if (nm) pl += `<text x="100" y="182" text-anchor="middle" font-family="'Archivo',Arial,sans-serif" font-weight="700" font-size="19" letter-spacing="2" fill="${ink}">${esc(nm.toUpperCase())}</text>`;
    if (base === 'cromo') pl += `<rect width="200" height="200" fill="url(#${id}-chrome)" style="mix-blend-mode:hard-light" opacity="0.7"/>`;
    if (base === 'olografico') pl += `<rect width="200" height="200" fill="url(#${id}-holo)" style="mix-blend-mode:screen" opacity="0.62"/>`;
    if (finish === 'lucido') pl += `<polygon points="0,0 110,0 40,200 0,200" fill="#fff" opacity="0.22"/>`;
    pl += `</g><path d="${PLATE_PATH}" fill="none" stroke="#000" stroke-opacity=".5" stroke-width="3"/></g>`;
    // numero sulla fiancata e nome sul parafango posteriore
    const halo = `stroke="${ink === '#ffffff' ? '#0a0a0b' : '#ffffff'}" stroke-width="7" paint-order="stroke" stroke-linejoin="round"`;
    if (num) pl += `<text x="394" y="268" text-anchor="middle" transform="rotate(-3 394 250)" font-family="'Saira','Liberation Sans',Arial,sans-serif" font-weight="800" font-style="italic" font-size="${num.length > 2 ? 62 : 80}" fill="${ink}" ${halo}>${esc(num)}</text>`;
    if (nm) pl += `<text x="104" y="167" transform="rotate(7.5 104 167)" font-family="'Archivo',Arial,sans-serif" font-weight="800" font-size="14" letter-spacing="2.4" fill="${ink}" ${halo.replace('stroke-width="7"', 'stroke-width="5"')}>${esc(nm.toUpperCase())}</text>`;
  }

  // parafango anteriore sta sopra la ruota, la tabella sopra la forcella
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BIKE_W} ${BIKE_H}" role="img" aria-label="${custom ? 'Moto con la grafica' : 'Moto originale'}" preserveAspectRatio="xMidYMid meet">` +
    `<defs>${defs}${o.stage ? `<linearGradient id="${id}-stage" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9e9ea"/><stop offset=".68" stop-color="#fbfbfb"/><stop offset="1" stop-color="#d3d3d5"/></linearGradient>` : ''}</defs>${o.stage ? `<rect width="${BIKE_W}" height="${BIKE_H}" fill="url(#${id}-stage)"/>` : ''}${m}${pl}</svg>`
  );
}
