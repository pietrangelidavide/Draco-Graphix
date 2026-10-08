// Server di sviluppo: ricompila a ogni modifica e ricarica la pagina. Apri http://localhost:5173
import { context } from 'esbuild';
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { options, writeStatic } from './build.mjs';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
rmSync(dist, { recursive: true, force: true });
const demo = process.argv.includes('--demo');
const ctx = await context({
  ...options({ demo, dev: true }),
  plugins: [{ name: 'static', setup: (b) => b.onEnd(() => writeStatic({ dev: true })) }],
});
await ctx.watch();
const { port } = await ctx.serve({ servedir: dist, port: 5173, host: '0.0.0.0' });
console.log(`\n  Draco Graphix in sviluppo: http://localhost:${port}\n  Dal telefono (stessa rete Wi-Fi): http://<IP del PC>:${port}\n`);
