// Dopo "node scripts/build.mjs --demo": produce dist/artifact.html (frammento senza <html>/<head>/<body>, da pubblicare
// come pagina condivisibile) e dist/demo.html (stesso contenuto come documento completo, da aprire con doppio clic).
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
// stessa pagina con documento completo: si apre con un doppio clic, anche senza server
const standalone = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0c0d10">
</head>
<body>
${html}</body>
</html>
`;
writeFileSync(join(dist, 'demo.html'), standalone);
console.log(`dist/artifact.html: ${(html.length / 1024).toFixed(0)} KB · dist/demo.html: ${(standalone.length / 1024).toFixed(0)} KB`);
