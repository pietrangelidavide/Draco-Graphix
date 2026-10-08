// Numero e nome pilota ricordati nel browser: scritti nella home, riproposti nella scheda prodotto.
const KEY = 'dg-rider';

export interface Rider {
  number: string;
  name: string;
}

export function loadRider(): Rider {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as Partial<Rider>) : {};
    return { number: String(v.number ?? '').slice(0, 3), name: String(v.name ?? '').slice(0, 18) };
  } catch {
    return { number: '', name: '' };
  }
}

export function saveRider(r: Rider) {
  try {
    localStorage.setItem(KEY, JSON.stringify(r));
  } catch {
    /* archiviazione bloccata */
  }
}
