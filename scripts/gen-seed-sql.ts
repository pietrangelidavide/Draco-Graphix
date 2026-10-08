// Genera supabase/seed.sql (marchi, catalogo, impostazioni) dagli stessi dati della modalità demo.
// Uso: npm run seed:sql
import { writeFileSync } from 'node:fs';
import { BRANDS, catalogSeed, settingsSeed } from '../src/lib/seed';

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const arr = (a: string[]) => (a.length ? `array[${a.map(q).join(', ')}]::text[]` : `'{}'::text[]`);
const json = (v: unknown) => `$j$${JSON.stringify(v)}$j$::jsonb`;

const out: string[] = [
  '-- Draco Graphix · dati iniziali (generato da scripts/gen-seed-sql.ts: non modificarlo a mano, rilancia `npm run seed:sql`).',
  '-- Si può rieseguire: i prodotti e le impostazioni già presenti non vengono toccati.',
  '',
];

for (const b of BRANDS) {
  out.push(`insert into public.brands (id, name, sort, active) values (${q(b.id)}, ${q(b.name)}, ${b.sort}, ${b.active}) on conflict (id) do update set name = excluded.name, sort = excluded.sort;`);
}
out.push('');

for (const p of catalogSeed()) {
  out.push(
    `insert into public.products (id, slug, name, kind, brand_id, tags, description, contents, specs, price_cents, discount_percent, images, art_colors, fields, badge, featured, active, stock, sort) values (` +
      [
        q(p.id), q(p.slug), q(p.name), q(p.kind), p.brand_id ? q(p.brand_id) : 'null', arr(p.tags), q(p.description), arr(p.contents), arr(p.specs),
        p.price_cents, p.discount_percent, arr(p.images), arr(p.art_colors), json(p.fields), p.badge ? q(p.badge) : 'null', p.featured, p.active,
        p.stock == null ? 'null' : p.stock, p.sort,
      ].join(', ') +
      `) on conflict (id) do nothing;`,
  );
}
out.push('');
out.push(`insert into public.settings (id, data) values (1, ${json(settingsSeed())}) on conflict (id) do nothing;`);
out.push('');

writeFileSync(new URL('../supabase/seed.sql', import.meta.url), out.join('\n'));
console.log('supabase/seed.sql scritto');
