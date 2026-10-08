const fmt = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
const fmtShort = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 });

/** 14900 -> "149,00 €" */
export function eur(cents: number): string {
  return fmt.format(cents / 100).replace(/[\u202f\u00a0]/g, '\u00a0');
}

/** 14900 -> "149 €", 14950 -> "149,50 €" */
export function eurShort(cents: number): string {
  return cents % 100 === 0 ? fmtShort.format(cents / 100).replace(/[\u202f\u00a0]/g, '\u00a0') : eur(cents);
}

/** "149,5" o "149.50" -> 14950. Restituisce null se non è un importo. */
export function parseEuro(input: string): number | null {
  const s = input.trim().replace(/\s|€/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(parseFloat(s) * 100);
}

/** Importo come testo modificabile: 14950 -> "149,50" */
export function centsToInput(cents: number | null | undefined): string {
  if (cents == null) return '';
  return (cents / 100).toFixed(2).replace('.', ',');
}

/** Quota di IVA contenuta in un importo IVA inclusa. */
export function vatIncluded(totalCents: number, vatPercent: number): number {
  return Math.round(totalCents - totalCents / (1 + vatPercent / 100));
}
