# Draco Graphix · la soluzione

Documento di progetto: cosa abbiamo capito dell'azienda, cosa è stato costruito, come funziona e cosa resta da fare.

## 1. L'azienda, dal sito attuale

**Draco Graphix** è una piccola impresa italiana che stampa **grafiche adesive per moto da cross, enduro e supermotard**,
"100% Made in Italy", con pellicola CRYSTAL da 0,4 mm e colla permanente. Il sito (dracographix.com) è un WordPress con WooCommerce.

Offre tre cose, e la soluzione è costruita attorno a queste:

1. **Kit a catalogo** (circa 20 prodotti: Honda, Beta, Husqvarna, HM, Ducati e altre marche). Il cliente sceglie la grafica,
   indica modello, annata, nome e numero. Prezzo base 149 €; opzioni di **base di stampa** (classica, cromo, olografico)
   e **laminazione** (lucido, opaco, glitter) a supplemento. Esistono anche gli adesivi forcella.
2. **Grafica 100% su misura**: il cliente racconta la moto e lo stile, versa un **acconto di 50 €** (scalato dal totale),
   il grafico prepara la **bozza**, le **modifiche sono illimitate**, la bozza si **approva**, si versa il **saldo**, si stampa e si spedisce.
3. **Team e motoclub**: preventivi dedicati per più piloti con la stessa grafica.

Tempi dichiarati: in media 3–5 giorni tra produzione e spedizione.

### Cosa il sito attuale non fa bene
- Il percorso "su misura" vive fuori dal negozio (email, messaggi): niente stato, niente storico delle bozze, niente approvazione tracciata.
- Nessuna vista di produzione: ordini e progetti non dicono "cosa devo fare oggi".
- Il cliente non ha un posto dove ritrovare bozze, pagamenti, moto e file.
- Il configuratore non fa vedere il risultato (soprattutto il numero sulla tabella).

## 2. Cosa è stato costruito

Una sola applicazione, tre aree (dettagli in `README.md`).

### Identità visiva
Ridisegnata dal logo del cliente (drago bianco su nero, vettorializzato in `src/lib/brand.ts`).
- **Solo bianco e nero**: i colori li portano le grafiche dei prodotti; i colori di stato (ok, attenzione, errore) restano solo funzionali.
- **Angoli netti e taglio diagonale**, come le lame del drago: pulsanti, etichette, voce attiva del menu e bordo del cursore prima/dopo hanno la stessa inclinazione.
- Titoli in corsivo maiuscolo (Saira, caricato da Google Fonts), testo in Archivo. Tema chiaro e scuro seguono il sistema.

### Vetrina e negozio
- Home con **cursore prima / dopo**: si trascina una barra (mouse, dito o frecce della tastiera) per passare dalla moto originale a quella con le grafiche; scrivi il tuo numero e il nome e la moto cambia. Lo stesso cursore compare nella scheda prodotto ("Sulla moto"), nel **Su misura** (anteprima con i colori scritti nel brief) e nelle bozze dell'area clienti (foto della moto contro bozza).
- La moto mostrata è un'illustrazione vettoriale costruita nell'app (`src/lib/bike.ts`): con le foto reali del cliente basta sostituirla nei due livelli del cursore.
- Catalogo con ricerca, filtri per marca e tipo, ordinamento; scheda prodotto con **configuratore** (modello, annata, nome, numero, base, laminazione) e prezzo che si aggiorna.
- Carrello, pagamento con indirizzo, fattura (P.IVA, SDI, PEC), scelta tra bonifico e PayPal; pagina "ordine completato" con le istruzioni di pagamento.
- **Su misura**: modulo di brief con allegati (loghi, foto), materiali, acconto e accesso/registrazione al momento dell'invio.
- **Team e motoclub**: richiesta di preventivo. Contatti con protezione antispam.

### Area clienti
- Panoramica con **"Tocca a te"** (bozza da approvare, pagamento da fare).
- **Stanza del progetto**: avanzamento in 7 tappe, bozze versionate (v1, v2…), **Approva** o **Chiedi modifiche**, chat con il grafico e allegati, pagamenti, brief e spedizione.
- Ordini con stato e tracciamento, preventivi team, **garage** (le tue moto, per ricompilare in un tocco), preferiti, profilo, notifiche.

### Gestionale
- **Panoramica**: numeri chiave, grafico incassi, e la lista **"Da fare ora"** ordinata per urgenza (pagamenti da confermare, bozze da fare, ordini da spedire…) con azioni dirette.
- **Produzione**: schede per fase (in attesa di pagamento → da preparare → in stampa → pronti da spedire) con modello, annata, **numero in grande**, base, laminazione e note del cliente; stampabile come scheda lavoro.
- **Ordini** e **Progetti su misura**: cambio stato, caricamento bozza, totale della grafica, registrazione acconto/saldo, corriere e tracciamento, note interne, chat.
- **Preventivi** team con righe e totale, **Catalogo** (modifica prodotti, prezzi, foto, campi del configuratore), **Clienti** con storico, **Contatti** ricevuti, **Impostazioni** (azienda, acconto, IVA, spedizione, metodi di pagamento, testi legali).

## 3. Come funziona sotto

- **Un solo codice** (React + TypeScript), pubblicabile su qualsiasi hosting statico; installabile come app sul telefono.
- **Due modi di funzionare con la stessa interfaccia** (`src/data/api.ts`): *demo* (dati nel browser, per provare e per presentare) e *Supabase* (database, accesso e archivio file veri).
- **Ruoli**: cliente, staff, titolare. Ogni cliente vede solo i propri dati; il gestionale vede tutto. Le regole stanno nel database (Row Level Security), non nell'interfaccia.
- **Prezzi e importi non si fidano dell'app**: ordini, acconti, saldi e preventivi passano da funzioni del database che ricalcolano il prezzo dal catalogo. Un test confronta il calcolo dell'app con quello del database su 180 carrelli (134 validi, 46 respinti).
- **Importi in centesimi** interi, numerazione progressiva senza buchi (`DG-2026-0001` ordini, `GP-2026-0001` grafiche, `PR-2026-0001` preventivi).
- **Pagamenti**: la richiesta di pagamento nasce con l'ordine o l'acconto; bonifico e PayPal si **confermano a mano** nel gestionale ("Ricevuto"). Il saldo di un progetto lo registra lo staff.
- **File**: due archivi; "files" privato (allegati del cliente solo nella sua cartella, bozze leggibili dal proprietario del progetto) e "catalog" pubblico per le foto prodotto.
- **Accessibilità**: contrasti verificati in tema chiaro e scuro, focus visibile, uso da tastiera, rispetto di "riduci animazioni".

## 4. Verifiche fatte

| Cosa | Esito |
| --- | --- |
| Controllo dei tipi (TypeScript) | nessun errore |
| 21 test applicativi (prezzi, ordini, progetti, pagamenti, permessi della modalità demo) | tutti passati |
| Test SQL su Postgres 16 (schema, permessi, funzioni, parità di prezzo) | tutti passati |
| Giro completo nel browser in modalità demo: ordine, su misura, approvazione bozza, gestionale in ogni sezione | nessun errore in console |
| Telefono (390 px), tablet, desktop, tema chiaro e scuro | nessun overflow orizzontale |
| Contrasto colori (WCAG AA) | tutte le coppie principali sopra soglia |

**Non verificato:** il collegamento a un progetto Supabase reale (il client è scritto con chiamate REST dirette e va provato con le chiavi del cliente), l'invio di email, il pagamento con carta.

## 5. Per andare online

1. Progetto Supabase + `schema.sql` + `seed.sql` + chiavi nel `.env` (passi nel README).
2. **Dati reali nel catalogo**: foto dei kit, nomi, prezzi, modelli e annate disponibili (oggi sono dati di esempio ispirati al sito). Si possono caricare dal gestionale → Catalogo.
3. **Impostazioni**: IBAN, PayPal, indirizzo, spedizione (oggi 9 € fissi come esempio), acconto (50 €), IVA.
4. **Testi legali**: privacy e condizioni sono bozze, da far rivedere.
5. **Dominio**: puntare `dracographix.com` al nuovo hosting e fare i redirect dalle vecchie pagine per non perdere posizionamento.
6. Primo accesso titolare e inserimento dei collaboratori.

## 6. Assunzioni da confermare

- Contenuto dei kit ("convogliatori, parafango anteriore e posteriore, airbox, tabella anteriore, tabelle laterali, parastelli, forcellone"): copiato da una scheda del sito e applicato a tutti; da personalizzare per prodotto.
- Prezzi dei supplementi (cromo, olografico, laminazione opaca/glitter): ricavati dalle schede del sito.
- Spedizione 9 € fissi; nessuna soglia di spedizione gratuita.
- Campi di fork/accessori degli adesivi forcella ("moto su cui li monti"): ipotizzati.
- Modello di pagamento del su misura: acconto 50 € all'invio, saldo dopo l'approvazione, esattamente come descritto sul sito.
- Un solo laboratorio e un solo grafico: la produzione è una lavagna a fasi, non una pianificazione per macchina o operatore.

## 7. Roadmap consigliata

1. **Carta di credito con Stripe**: due funzioni lato server (creazione del pagamento e conferma automatica via webhook). Il resto dell'app è già pronto: la richiesta di pagamento esiste, basta chiuderla da sola.
2. **Email transazionali** (ordine ricevuto, bozza pronta, pagamento ricevuto, spedito con tracciamento) e **notifiche push** sul telefono.
3. **Fatturazione elettronica**: esportazione verso il gestionale contabile o integrazione SDI.
4. **Magazzino materiali**: pellicole, laminati e consumi collegati alle commesse.
5. **Tracciamento corriere** automatico e etichette di spedizione.
6. **Importazione del catalogo da WooCommerce** (CSV) per non reinserire a mano i prodotti.
7. **Statistiche**: prodotti più venduti, tempo medio di approvazione bozza, tasso di conversione dei preventivi.
