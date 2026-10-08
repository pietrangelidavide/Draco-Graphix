// Build senza dipendenze oltre a esbuild: cartella dist/ pronta da pubblicare su qualsiasi hosting statico.
//   node scripts/build.mjs            produzione (usa SUPABASE_URL / SUPABASE_ANON_KEY dal file .env se presenti)
//   node scripts/build.mjs --demo     forza la modalità demo (nessun database)
import { build, context } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

export function readEnv() {
  const env = { ...process.env };
  const file = join(root, '.env');
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (m && !line.trim().startsWith('#')) env[m[1]] ??= m[2].replace(/^["']|["']$/g, '');
    }
  }
  return env;
}

export function options({ demo = false, dev = false } = {}) {
  const env = readEnv();
  return {
    entryPoints: [join(root, 'src/main.tsx')],
    bundle: true,
    outdir: join(dist, 'assets'),
    entryNames: 'app',
    format: 'iife',
    target: ['es2022'],
    jsx: 'automatic',
    minify: !dev,
    sourcemap: dev ? 'inline' : false,
    legalComments: 'none',
    loader: { '.svg': 'dataurl', '.png': 'dataurl' },
    define: {
      __SUPABASE_URL__: JSON.stringify(demo ? '' : env.SUPABASE_URL ?? ''),
      __SUPABASE_ANON_KEY__: JSON.stringify(demo ? '' : env.SUPABASE_ANON_KEY ?? ''),
      __DEMO_FORCED__: JSON.stringify(demo),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
      'process.env.NODE_ENV': JSON.stringify(dev ? 'development' : 'production'),
    },
    logLevel: 'info',
  };
}

export function writeStatic({ dev = false } = {}) {
  mkdirSync(dist, { recursive: true });
  cpSync(join(root, 'public'), dist, { recursive: true });
  const stamp = createHash('md5')
    .update(existsSync(join(dist, 'assets/app.js')) ? readFileSync(join(dist, 'assets/app.js')) : '')
    .digest('hex')
    .slice(0, 8);
  let html = readFileSync(join(root, 'index.html'), 'utf8').replace('assets/app.js', `assets/app.js?v=${stamp}`).replace('assets/app.css', `assets/app.css?v=${stamp}`);
  if (dev) html = html.replace('</body>', `<script>new EventSource('/esbuild').addEventListener('change',()=>location.reload())</script></body>`);
  writeFileSync(join(dist, 'index.html'), html);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const demo = process.argv.includes('--demo');
  rmSync(dist, { recursive: true, force: true });
  await build(options({ demo }));
  writeStatic();
  const env = readEnv();
  console.log(demo || !(env.SUPABASE_URL && env.SUPABASE_ANON_KEY) ? 'Build in modalità DEMO (nessun database collegato).' : 'Build collegata a Supabase.');
}
export { context };
