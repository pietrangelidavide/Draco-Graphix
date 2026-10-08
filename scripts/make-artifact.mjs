// Dopo "node scripts/build.mjs --demo": produce dist/artifact.html, un unico file con CSS e JS incorporati,
// senza <html>/<head>/<body>, pronto da pubblicare come pagina condivisibile (anteprima dimostrativa).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
for (const f of ['assets/app.js', 'assets/app.css']) {
  if (!existsSync(join(dist, f))) throw new Error(`Manca dist/${f}: esegui prima "node scripts/build.mjs --demo".`);
}
const css = readFileSync(join(dist, 'assets/app.css'), 'utf8');
const js = readFileSync(join(dist, 'assets/app.js'), 'utf8').replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
const fonts = 'https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=Big+Shoulders+Display:wght@700;800;900&display=swap';

const html = `<title>Draco Graphix</title>
<link rel="stylesheet" href="${fonts}">
<style>
${css}
</style>
<div id="root"></div>
<script>
${js}
</script>
`;
writeFileSync(join(dist, 'artifact.html'), html);
console.log(`dist/artifact.html: ${(html.length / 1024).toFixed(0)} KB`);
