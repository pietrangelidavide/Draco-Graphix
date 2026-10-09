# Draco Graphix · web app

Un'unica applicazione web che sostituisce il sito attuale (WordPress + WooCommerce) con tre aree:

| Area | Indirizzo | Chi la usa |
| --- | --- | --- |
| **Vetrina e negozio** | `#/` | chiunque: catalogo kit, configuratore con anteprima del numero, carrello, grafica su misura, preventivi team |
| **Area clienti** | `#/account` | il cliente: ordini, stanza di ogni progetto su misura (bozze, approvazione, messaggi, pagamenti), garage, preferiti |
| **Gestionale** | `#/gestionale` | Draco: panoramica "da fare ora", produzione a schede, ordini, progetti, preventivi, catalogo, clienti, contatti, impostazioni |

È installabile sul telefono (PWA) e funziona su telefono, tablet e computer, in tema chiaro e scuro.
Per l'analisi dell'azienda, i flussi e la roadmap leggi [`docs/SOLUZIONE.md`](docs/SOLUZIONE.md).

## Provarla subito (modalità demo)

Serve [Node.js](https://nodejs.org) 20 o più recente. Da PowerShell o terminale, nella cartella del progetto:

```
npm install
npm run dev:demo
```

Apri http://localhost:5173. In alto c'è la barra "Versione dimostrativa": dalla pagina **Accedi** entri come cliente
(`marco@draco.test`) o come titolare (`titolare@draco.test`), password `demo1234`. I dati di prova stanno nel browser:
"Ripristina dati demo" nel gestionale li rimette come all'inizio.

Dal telefono, sulla stessa rete Wi-Fi: `http://<IP del PC>:5173`.

## Metterla online con dati veri (Supabase)

1. Crea un progetto su [supabase.com](https://supabase.com) (piano gratuito sufficiente per partire).
2. **SQL Editor** → incolla ed esegui `supabase/schema.sql`, poi `supabase/seed.sql` (catalogo, marche e impostazioni iniziali).
3. **Authentication → Providers → Email**: decidi se chiedere la conferma dell'email. **URL Configuration**: imposta l'indirizzo del sito.
4. Copia `.env.example` in `.env` e inserisci `SUPABASE_URL` e `SUPABASE_ANON_KEY` (**Project Settings → API**).
5. `npm run build` crea la cartella `dist/`: caricala su un hosting statico (Cloudflare Pages, Netlify, Vercel, GitHub Pages…).
6. Registrati dal sito, poi in SQL Editor rendi te stesso titolare:
   ```sql
   update profiles set role = 'admin' where email = 'tua-email@esempio.it';
   ```
   Da quel momento vedi `#/gestionale`. Altri collaboratori: stessa cosa con `role = 'staff'`.
7. Nel gestionale → **Impostazioni**: inserisci IBAN, PayPal, indirizzo, spese di spedizione e rivedi i testi di privacy e condizioni.

La chiave `anon` è pubblica per progetto: la sicurezza sta nelle regole del database (Row Level Security) incluse in `schema.sql`.
Prezzi, ordini, pagamenti, bozze e preventivi si scrivono solo con funzioni del database che ricalcolano gli importi dal catalogo.

## Comandi

| Comando | Cosa fa |
| --- | --- |
| `npm run dev` / `npm run dev:demo` | sviluppo con ricarica automatica (con o senza database) |
| `npm run build` | produzione in `dist/` (usa `.env` se c'è) |
| `npm run build:demo` | build demo + `dist/demo.html`, singolo file da aprire con doppio clic (e `dist/artifact.html` per pubblicarlo come pagina) |
| `npm run icons` | rigenera le icone PNG da `public/favicon.svg` (serve Chromium di Playwright) |
| `npm run typecheck` | controllo dei tipi |
| `npm test` | test di prezzi e logica applicativa |
| `npm run test:sql` | test di schema, permessi e funzioni su un Postgres locale (serve `psql`/Postgres 16) |
| `npm run seed:sql` | rigenera `supabase/seed.sql` da `src/lib/seed.ts` |

## Struttura

```
src/
  pages/{shop,account,admin}/   le schermate delle tre aree
  layouts/                      testata e piè di pagina del sito, barra laterale del gestionale
  components/                   elementi grafici condivisi (logo, cursore prima/dopo, anteprima kit, stato, pagamenti, allegati…)
  data/                         interfaccia Api + due implementazioni: demo (browser) e Supabase
  lib/                          tipi, prezzi (in centesimi), stati, dati di partenza del catalogo; brand.ts (logo vettoriale), bike.ts (moto illustrata)
  state/                        accesso, carrello, catalogo, preferiti, notifiche
  styles/                       tema chiaro/scuro e stili per area
supabase/                       schema.sql (tabelle, permessi, funzioni, archivio file) e seed.sql
tests/                          test applicativi e test SQL
scripts/                        build, sviluppo, icone, seed, file condivisibile
```

## Cose da sapere

- I **pagamenti** (bonifico, PayPal) si registrano a mano nel gestionale: l'app crea la richiesta di pagamento e mostra al cliente le istruzioni. Il pagamento con carta (Stripe) è previsto nella roadmap.
- La **modalità demo** è marcata come tale in ogni pagina; non spedisce email né notifiche push.
- I testi di **privacy e condizioni** sono bozze da far verificare prima della pubblicazione.
- Il client Supabase è scritto senza librerie esterne (chiamate REST): provalo con il tuo progetto prima di andare online.
