// Dal testo libero del brief ("nero, rosso e bianco") ai colori dell'anteprima.
const NAMES: [RegExp, string][] = [
  [/\b(nero|nera|neri|nere|black)\b/, '#14161a'],
  [/\b(bianco|bianca|bianchi|bianche|white)\b/, '#f2f2f2'],
  [/\b(rosso|rossa|rossi|rosse|red)\b/, '#d81f26'],
  [/\b(arancio|arancione|arancioni|orange)\b/, '#ff6a13'],
  [/\b(giallo|gialla|gialli|gialle|yellow)\b/, '#ffd800'],
  [/\b(fluo|lime|acido)\b/, '#d4ff00'],
  [/\b(verde|verdi|green)\b/, '#1fa855'],
  [/\b(azzurro|azzurra|celeste|cyan|ciano)\b/, '#19a7e6'],
  [/\b(blu|blue|bluette)\b/, '#1f5fe0'],
  [/\b(viola|violetto|purple)\b/, '#7a2fd0'],
  [/\b(rosa|fucsia|magenta|pink)\b/, '#ff2f92'],
  [/\b(grigio|grigia|grigi|grigie|argento|grey|gray)\b/, '#8b9097'],
  [/\b(oro|dorato|gold)\b/, '#d4a017'],
];

/** Fino a tre colori, nell'ordine in cui il cliente li cita; se non ne riconosce, usa `fallback`. */
export function parseColors(text: string, fallback: string[]): string[] {
  const t = text.toLowerCase();
  const found: { at: number; hex: string }[] = [];
  for (const [re, hex] of NAMES) {
    const m = re.exec(t);
    if (m && !found.some((f) => f.hex === hex)) found.push({ at: m.index, hex });
  }
  found.sort((a, b) => a.at - b.at);
  const out = found.map((f) => f.hex).slice(0, 3);
  if (out.length === 0) return fallback;
  // l'anteprima usa [colore principale, fondo, dettaglio]: se manca un fondo scuro lo aggiungiamo
  const dark = (h: string) => h === '#14161a';
  const lead = out.find((c) => !dark(c) && c !== '#f2f2f2') ?? out[0]!;
  const base = out.find(dark) ?? '#14161a';
  const detail = out.find((c) => c !== lead && c !== base) ?? '#f2f2f2';
  return [lead, base, detail];
}
