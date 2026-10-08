// Genera casi casuali di carrello e confronta il calcolo in TypeScript (src/lib/pricing.ts) con la funzione
// create_order() del database. Stampa SQL da eseguire dopo tests/sql/test.sql: ogni riga fallisce se i due calcoli divergono.
import { catalogSeed, settingsSeed } from '../../src/lib/seed';
import { resolveLines, totals } from '../../src/lib/pricing';
import { rng } from '../../src/lib/util';
import type { CartLineInput, Settings } from '../../src/lib/types';

const ANNA = '00000000-0000-0000-0000-0000000000a1';
const ADDR = '{"street":"Via Roma 1","city":"Roma","zip":"00100","province":"RM","country":"IT"}';
const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;

const catalog = catalogSeed().filter((p) => p.active && p.stock == null);
const r = rng(20261008);
const pick = <T,>(a: T[]): T => a[Math.floor(r() * a.length)]!;

function randomSelections(p: (typeof catalog)[number], fuzz: boolean): Record<string, string> {
  const sel: Record<string, string> = {};
  for (const f of p.fields) {
    if (fuzz && r() < 0.12) continue; // campo lasciato vuoto
    if (f.type === 'text') {
      const max = f.maxLength ?? 60;
      const valid = ['77', '12', 'CRF 450R', 'MARCO', ' 5 ', 'AB'].filter((v) => v.trim().length <= max);
      sel[f.key] = fuzz && r() < 0.2 ? 'x'.repeat(max + 1 + Math.floor(r() * 3)) : !f.required && r() < 0.3 ? '' : pick(valid);
    } else if (f.type === 'year') {
      sel[f.key] = fuzz && r() < 0.35 ? pick(['1989', '2101', 'abc']) : pick(['2022', '2005', '2026', 'precedente', '2019', '1990']);
    } else {
      sel[f.key] = fuzz && r() < 0.2 ? 'inesistente' : pick(f.choices!).value;
    }
  }
  return sel;
}

function randomCase(): CartLineInput[] {
  const fuzz = r() < 0.3;
  const n = 1 + Math.floor(r() * 3);
  return Array.from({ length: n }, () => {
    const p = pick(catalog);
    return { product_id: p.id, qty: pick([1, 1, 2, 3, 5, 0, 30]), selections: randomSelections(p, fuzz) };
  });
}

const configs: { name: string; patch: Partial<Settings> }[] = [
  { name: 'spedizione fissa 9 euro', patch: { shipping_flat_cents: 900, shipping_free_over_cents: null } },
  { name: 'spedizione 12 euro, gratis sopra 200', patch: { shipping_flat_cents: 1200, shipping_free_over_cents: 20000 } },
];

const out: string[] = ['\\set ON_ERROR_STOP on'];
let ok = 0;
let rejected = 0;
for (const cfg of configs) {
  const settings = { ...settingsSeed(), ...cfg.patch };
  out.push('select t.logout();');
  out.push(
    `update settings set data = jsonb_set(jsonb_set(data, '{shipping_flat_cents}', '${settings.shipping_flat_cents}'), '{shipping_free_over_cents}', '${settings.shipping_free_over_cents ?? 'null'}');`,
  );
  out.push(`select t.login('${ANNA}');`);
  for (let i = 0; i < 90; i++) {
    const items = randomCase();
    const call = `create_order(${lit(JSON.stringify(items))}, '${ADDR}', '{}', '', 'bonifico')`;
    let expected: { total: number; entries: number } | null;
    try {
      const lines = resolveLines(items, catalogSeed());
      expected = { total: totals(lines, settings).total_cents, entries: lines.reduce((t, l) => t + l.config.length, 0) };
    } catch {
      expected = null;
    }
    const label = `${cfg.name} · caso ${i + 1}`.replace(/'/g, '');
    if (expected) {
      ok++;
      out.push(`insert into t.ctx values ('par', ${call}::text) on conflict (k) do update set v = excluded.v;`);
      out.push(`select t.eq((select total_cents from orders where id = (select v::uuid from t.ctx where k = 'par')), ${expected.total}, '${label}: totale');`);
      out.push(
        `select t.eq((select sum(jsonb_array_length(config))::int from order_items where order_id = (select v::uuid from t.ctx where k = 'par')), ${expected.entries}, '${label}: voci di configurazione');`,
      );
    } else {
      rejected++;
      out.push(`select t.raises($q$select ${call}$q$, '.', '${label}: doveva essere respinto');`);
    }
  }
}
out.push('select t.logout();');
out.push(`\\echo 'parità: ${ok} carrelli validi e ${rejected} respinti, TypeScript e database concordano'`);
process.stdout.write(out.join('\n') + '\n');
