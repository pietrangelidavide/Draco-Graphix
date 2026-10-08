\set ON_ERROR_STOP on

create table t.ctx (k text primary key, v text);
grant all on t.ctx to anon, authenticated;

-- utenti: titolare, grafico, due clienti (il profilo nasce dal trigger di registrazione)
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'titolare@test', '{"full_name":"Titolare"}'),
  ('00000000-0000-0000-0000-00000000000b', 'grafico@test',  '{"full_name":"Grafico"}'),
  ('00000000-0000-0000-0000-0000000000a1', 'anna@test',     '{"full_name":"Anna Cliente"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'bruno@test',    '{"full_name":"Bruno Cliente"}');
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';
update profiles set role = 'staff' where id = '00000000-0000-0000-0000-00000000000b';
select t.eq((select count(*) from profiles)::int, 4, 'il trigger crea un profilo per utente');
select t.eq((select role from profiles where email = 'anna@test'), 'customer', 'i nuovi iscritti sono clienti');

\set admin '''00000000-0000-0000-0000-00000000000a'''
\set staff '''00000000-0000-0000-0000-00000000000b'''
\set anna  '''00000000-0000-0000-0000-0000000000a1'''
\set bruno '''00000000-0000-0000-0000-0000000000b2'''

-- ============ visitatore (anon) ============
select t.login(null, 'anon');
select t.eq((select count(*) from products)::int, 29, 'anon vede i 29 prodotti pubblicati (non la bozza)');
select t.eq((select count(*) from brands)::int, 15, 'anon vede i marchi');
select t.eq((select count(*) from settings)::int, 1, 'anon legge le impostazioni pubbliche');
select t.raises('select * from orders', 'permission denied', 'anon non legge gli ordini');
select t.raises('select * from profiles', 'permission denied', 'anon non legge i profili');
select t.raises('select * from leads', 'permission denied', 'anon non legge i contatti');
select t.raises($$select create_order('[]','{}','{}','','bonifico')$$, 'permission denied', 'anon non crea ordini');
select t.raises($$insert into products (id,slug,name,kind,price_cents) values ('x','x','x','kit',1)$$, 'permission denied', 'anon non scrive il catalogo');
select submit_lead('newsletter', '', 'tifoso@test.it');
select submit_lead('newsletter', '', 'TIFOSO@test.it');
select submit_lead('contatto', 'Visitatore', 'visitatore@test.it', '', 'Spedite in Svizzera?');
select t.raises($$select submit_lead('contatto','x','non-una-email','','ciao')$$, 'Email non valida', 'email non valida');
select t.raises($$select submit_lead('contatto','x','a@b.it','','')$$, 'Scrivi un messaggio', 'messaggio obbligatorio');
select submit_quote('{"name":"Paolo Ferri","email":"paolo@club.test","phone":""}', 'Motoclub Valdarno', 14, 'Enduro', 'Grafiche soci', 'Quanto costa?');
select t.raises($$select submit_quote('{"name":"","email":"a@b.it"}','Team',1,'','','')$$, 'nome', 'preventivo senza nome');
select t.logout();
select t.eq((select count(*) from leads where kind = 'newsletter')::int, 1, 'la newsletter non si duplica');
select t.eq((select count(*) from quotes)::int, 1, 'preventivo anonimo registrato');
select t.ok((select user_id is null from quotes limit 1), 'preventivo anonimo senza utente');

-- ============ cliente ============
select t.login(:anna);
select t.eq((select count(*) from profiles)::int, 1, 'il cliente vede solo il proprio profilo');
update profiles set full_name = 'Anna Verdi', phone = '333' where id = :anna;
select t.eq((select full_name from profiles where id = :anna), 'Anna Verdi', 'il cliente aggiorna il proprio nome');
select t.raises($$update profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000a1'$$, 'permission denied', 'il cliente non può farsi admin');
select t.eq(t.rows_changed($$update profiles set full_name = 'hack' where id = '00000000-0000-0000-0000-0000000000b2'$$), 0, 'il cliente non modifica altri profili');
select t.eq((select count(*) from leads)::int, 0, 'il cliente non legge i contatti (0 righe)');
select t.raises($$select set_role('00000000-0000-0000-0000-0000000000a1','admin')$$, 'titolare', 'il cliente non può cambiare ruoli');

-- ordine: prezzi dal catalogo
insert into t.ctx values ('o1', create_order(
  '[{"product_id":"p-honda-crf-race1","qty":2,"selections":{"modello":"CRF 450R","annata":"2022","base":"cromo","laminazione":"glitter","numero_pilota":"77","nome_pilota":"ANNA"}}]',
  '{"street":"Via Roma 1","city":"Roma","zip":"00100","province":"RM","country":"IT"}', '{}', 'ciao', 'bonifico')::text);
select t.eq((select subtotal_cents from orders where id = (select v::uuid from t.ctx where k='o1')), 2 * (14900 + 13900 + 4900), 'subtotale = (149+139+49) x 2');
select t.eq((select shipping_cents from orders where id = (select v::uuid from t.ctx where k='o1')), 900, 'spedizione dalle impostazioni');
select t.eq((select total_cents from orders where id = (select v::uuid from t.ctx where k='o1')), 2 * 33700 + 900, 'totale');
select t.ok((select number ~ '^DG-\d{4}-0001$' from orders where id = (select v::uuid from t.ctx where k='o1')), 'numero ordine progressivo');
select t.eq((select count(*) from order_items where order_id = (select v::uuid from t.ctx where k='o1'))::int, 1, 'riga ordine');
select t.eq((select unit_price_cents from order_items limit 1), 33700, 'prezzo unitario con opzioni');
select t.eq((select jsonb_array_length(config) from order_items limit 1), 6, 'configurazione salvata');
select t.eq((select count(*) from payments where order_id = (select v::uuid from t.ctx where k='o1') and status = 'in_attesa' and amount_cents = 2 * 33700 + 900)::int, 1, 'pagamento in attesa dell’importo giusto');
select t.eq((select count(*) from order_events where order_id = (select v::uuid from t.ctx where k='o1'))::int, 1, 'evento iniziale');

-- forcelle scontate
insert into t.ctx values ('o2', create_order(
  '[{"product_id":"p-adesivi-forcella-mrz","qty":1,"selections":{}}]',
  '{"street":"Via Roma 1","city":"Roma","zip":"00100","province":"RM","country":"IT"}', '{}', '', 'paypal')::text);
select t.eq((select subtotal_cents from orders where id = (select v::uuid from t.ctx where k='o2')), 4400, 'forcella 50 euro -12% = 44');

-- tentativi non validi
select t.raises($$select create_order('[{"product_id":"p-honda-crf-race1","qty":1,"selections":{"modello":"X","annata":"2022","base":"oro","laminazione":"lucido"}}]','{"street":"a","city":"b","zip":"c","province":"d"}','{}','','bonifico')$$, 'scelta non valida', 'base inesistente');
select t.raises($$select create_order('[{"product_id":"p-honda-crf-race1","qty":1,"selections":{"base":"classica"}}]','{"street":"a","city":"b","zip":"c","province":"d"}','{}','','bonifico')$$, 'obbligatorio', 'campi obbligatori');
select t.raises($$select create_order('[{"product_id":"p-maglietta-esempio","qty":1,"selections":{"taglia":"M"}}]','{"street":"a","city":"b","zip":"c","province":"d"}','{}','','bonifico')$$, 'non disponibile', 'prodotto non pubblicato');
select t.raises($$select create_order('[{"product_id":"p-honda-crf-race1","qty":1,"selections":{"modello":"X","annata":"1850","base":"classica","laminazione":"lucido"}}]','{"street":"a","city":"b","zip":"c","province":"d"}','{}','','bonifico')$$, 'annata', 'annata non valida');
select t.raises($$select create_order('[{"product_id":"p-honda-crf-race1","qty":1,"selections":{"modello":"X","annata":"2022","base":"classica","laminazione":"lucido","numero_pilota":"12345"}}]','{"street":"a","city":"b","zip":"c","province":"d"}','{}','','bonifico')$$, 'troppo lungo', 'numero troppo lungo');
select t.raises($$select create_order('[{"product_id":"p-honda-crf-race1","qty":1,"selections":{"modello":"X","annata":"2022","base":"classica","laminazione":"lucido"}}]','{"street":"","city":"b","zip":"c","province":"d"}','{}','','bonifico')$$, 'indirizzo', 'indirizzo incompleto');
select t.raises($$select create_order('[{"product_id":"p-honda-crf-race1","qty":1,"selections":{"modello":"X","annata":"2022","base":"classica","laminazione":"lucido"}}]','{"street":"a","city":"b","zip":"c","province":"d"}','{}','','carta')$$, 'metodo di pagamento', 'metodo disattivato');
select t.raises($$select create_order('[]','{"street":"a","city":"b","zip":"c","province":"d"}','{}','','bonifico')$$, 'vuoto', 'carrello vuoto');

-- l'ordine non si può modificare da cliente
select t.raises($$update orders set status = 'consegnato'$$, 'permission denied', 'il cliente non cambia lo stato');
select t.raises($$update orders set total_cents = 1$$, 'permission denied', 'il cliente non cambia il totale');
select t.eq(t.rows_changed($$update orders set staff_note = 'x'$$), 0, 'il cliente non scrive note interne');
select t.raises($$insert into order_items (order_id, name, qty, unit_price_cents) select id, 'x', 1, 1 from orders limit 1$$, 'permission denied', 'il cliente non aggiunge righe');
select t.raises($$update payments set status = 'ricevuto'$$, 'permission denied', 'il cliente non segna pagamenti');
select t.raises($$select set_order_status((select v::uuid from t.ctx where k='o1'), 'spedito', '')$$, 'riservata', 'il cliente non usa set_order_status');
select t.raises($$select confirm_payment((select id from payments limit 1), '')$$, 'riservata', 'il cliente non conferma pagamenti');
select t.eq((select count(*) from orders)::int, 2, 'Anna vede i suoi 2 ordini');
select t.eq((select count(*) from notifications where audience = 'staff')::int, 0, 'Anna non vede le notifiche del gestionale');

-- garage e preferiti
insert into bikes (user_id, brand, model, year, rider_name, rider_number) values (:anna, 'KTM', 'EXC 300', 2021, 'ANNA', '7');
insert into wishlist (user_id, product_id) values (:anna, 'p-honda-crf-race1');
select t.raises($$insert into bikes (user_id, model) values ('00000000-0000-0000-0000-0000000000b2', 'furto')$$, 'row-level security', 'non si scrive nel garage altrui');
select t.logout();

-- ============ un altro cliente non vede nulla di Anna ============
select t.login(:bruno);
select t.eq((select count(*) from orders)::int, 0, 'Bruno non vede gli ordini di Anna');
select t.eq((select count(*) from order_items)::int, 0, 'Bruno non vede le righe');
select t.eq((select count(*) from payments)::int, 0, 'Bruno non vede i pagamenti');
select t.eq((select count(*) from bikes)::int, 0, 'Bruno non vede il garage di Anna');
select t.eq((select count(*) from quotes)::int, 0, 'Bruno non vede i preventivi');
select t.logout();

-- ============ gestionale: stati e pagamenti ============
select t.login(:staff);
select t.eq((select count(*) from orders)::int, 2, 'il gestionale vede tutti gli ordini');
select t.eq((select count(*) from profiles)::int, 4, 'il gestionale vede tutti i profili');
select t.eq((select count(*) from products)::int, 30, 'il gestionale vede anche la bozza prodotto');
select set_order_status((select v::uuid from t.ctx where k='o1'), 'in_stampa', 'avviata');
select t.raises($$select set_order_status((select v::uuid from t.ctx where k='o1'), 'inventato', '')$$, 'non valido', 'stato inesistente');
select t.eq((select status from orders where id = (select v::uuid from t.ctx where k='o1')), 'in_stampa', 'stato aggiornato');
select t.ok((select count(*) = 2 from order_events where order_id = (select v::uuid from t.ctx where k='o1')), 'evento registrato');
update orders set courier = 'BRT', tracking_code = 'TR123', staff_note = 'urgente' where id = (select v::uuid from t.ctx where k='o1');
select t.eq((select tracking_code from orders where id = (select v::uuid from t.ctx where k='o1')), 'TR123', 'il gestionale scrive il tracking');
select t.raises($$update orders set total_cents = 1$$, 'permission denied', 'neanche il gestionale cambia importi a mano');
select confirm_payment((select id from payments where order_id = (select v::uuid from t.ctx where k='o2')), 'CRO 1');
select t.eq((select payment_status from orders where id = (select v::uuid from t.ctx where k='o2')), 'pagato', 'ordine pagato');
select t.eq((select status from orders where id = (select v::uuid from t.ctx where k='o2')), 'in_preparazione', 'pagato -> in preparazione');
select record_payment((select v::uuid from t.ctx where k='o1'), null, 'ordine', 10000, 'bonifico', 'acconto');
select t.eq((select payment_status from orders where id = (select v::uuid from t.ctx where k='o1')), 'acconto', 'pagamento parziale = acconto');
select t.raises($$select record_payment(null, null, 'ordine', 100, 'bonifico', '')$$, 'ordine o a un progetto', 'pagamento senza collegamento');
select t.raises($$select record_payment((select v::uuid from t.ctx where k='o1'), null, 'ordine', 0, 'bonifico', '')$$, 'Importo', 'importo zero');
select t.ok((select count(*) >= 1 from notifications where audience = 'staff'), 'il gestionale vede le sue notifiche');
select t.raises($$select set_role('00000000-0000-0000-0000-0000000000a1','staff')$$, 'titolare', 'solo il titolare cambia i ruoli');
select t.eq(t.rows_changed($$update settings set data = jsonb_set(data, '{lead_time}', '"x"')$$), 0, 'lo staff non cambia le impostazioni');
select t.logout();

-- il cliente vede stato e notifiche
select t.login(:anna);
select t.eq((select status from orders where id = (select v::uuid from t.ctx where k='o1')), 'in_stampa', 'Anna vede lo stato');
select t.ok((select count(*) >= 2 from notifications where audience = 'user'), 'Anna riceve notifiche di stato');
select mark_all_notifications_read();
select t.eq((select count(*) from notifications where read_at is null)::int, 0, 'notifiche lette');
select t.logout();

-- ============ progetti grafici ============
select t.login(:anna);
insert into t.ctx values ('p1', submit_project('', '{"brand":"Yamaha","model":"YZ 125","year":"2020","style":"sportiva","colors":"blu"}', '[]',
  '{"street":"Via Roma 1","city":"Roma","zip":"00100","province":"RM","country":"IT"}', 'bonifico')::text);
select t.eq((select title from projects), 'Yamaha YZ 125', 'titolo automatico');
select t.eq((select deposit_cents from projects), 5000, 'acconto dalle impostazioni');
select t.ok((select number ~ '^GP-\d{4}-0001$' from projects), 'numero progetto');
select t.raises($$select submit_project('', '{"brand":"A","model":"","style":"x"}', '[]', null, 'bonifico')$$, 'modello', 'modello obbligatorio');
select t.raises($$select send_project_message((select v::uuid from t.ctx where k='p1'), '', '[]')$$, 'Scrivi', 'messaggio vuoto');
select send_project_message((select v::uuid from t.ctx where k='p1'), 'Ciao, ho allegato le foto', '[]');
select t.raises($$update projects set status = 'consegnata'$$, 'permission denied', 'il cliente non cambia lo stato del progetto');
select t.logout();

select t.login(:bruno);
select t.eq((select count(*) from projects)::int, 0, 'Bruno non vede il progetto di Anna');
select t.eq((select count(*) from project_messages)::int, 0, 'Bruno non vede la chat');
select t.raises($$select send_project_message((select v::uuid from t.ctx where k='p1'), 'intruso', '[]')$$, 'non trovato', 'Bruno non scrive nella chat altrui');
select t.logout();

select t.login(:staff);
select confirm_payment((select id from payments where project_id = (select v::uuid from t.ctx where k='p1')), 'CRO 2');
select t.eq((select status from projects), 'in_grafica', 'acconto -> in grafica');
insert into t.ctx values ('pf1', add_proof((select v::uuid from t.ctx where k='p1'), '{"path":"proofs/x/v1.png","name":"v1.png","size":1,"type":"image/png"}', 'prima idea')::text);
select t.eq((select status from projects), 'bozza_inviata', 'bozza caricata');
select t.logout();

select t.login(:bruno);
select t.raises($$select decide_proof((select v::uuid from t.ctx where k='pf1'), 'approvata', '')$$, 'non trovata', 'Bruno non approva bozze altrui');
select t.logout();

select t.login(:anna);
select t.raises($$select decide_proof((select v::uuid from t.ctx where k='pf1'), 'modifiche', '   ')$$, 'cosa vuoi cambiare', 'le modifiche vanno spiegate');
select decide_proof((select v::uuid from t.ctx where k='pf1'), 'modifiche', 'Numero più grande');
select t.eq((select status from projects), 'modifiche', 'modifiche richieste');
select t.eq((select revisions from projects), 1, 'revisioni contate');
select t.raises($$select decide_proof((select v::uuid from t.ctx where k='pf1'), 'approvata', '')$$, 'già stata valutata', 'una bozza si valuta una volta');
select t.logout();

select t.login(:staff);
insert into t.ctx values ('pf2', add_proof((select v::uuid from t.ctx where k='p1'), '{"path":"proofs/x/v2.png","name":"v2.png","size":1,"type":"image/png"}', 'numero ingrandito')::text);
select t.eq((select version from proofs where id = (select v::uuid from t.ctx where k='pf2')), 2, 'versione 2');
select t.logout();
select t.login(:anna);
select decide_proof((select v::uuid from t.ctx where k='pf2'), 'approvata', '');
select t.eq((select status from projects), 'approvata', 'bozza approvata');
select t.logout();

select t.login(:staff);
select staff_update_project((select v::uuid from t.ctx where k='p1'), '{"total_cents":18000}');
select t.eq((select total_cents from projects), 18000, 'totale impostato');
select record_payment(null, (select v::uuid from t.ctx where k='p1'), 'saldo', 13000, 'bonifico', 'saldo');
select set_project_status((select v::uuid from t.ctx where k='p1'), 'in_stampa');
select t.ok((select count(*) >= 5 from project_messages where kind = 'system'), 'cronologia di sistema nella chat');
select t.ok((select exists(select 1 from project_messages where body like 'Saldo ricevuto%')), 'saldo registrato in chat');
select t.eq((select sum(amount_cents) from payments where project_id = (select v::uuid from t.ctx where k='p1') and status = 'ricevuto')::int, 18000, 'acconto + saldo = totale');
select t.logout();

-- ============ preventivi ============
select t.login(:staff);
select save_quote((select id from quotes limit 1), '{"lines":[{"description":"Kit grafica","qty":14,"unit_price_cents":12000},{"description":"","qty":1,"unit_price_cents":5}],"valid_until":"2030-01-31","status":"inviato"}');
select t.eq((select total_cents from quotes limit 1), 168000, 'totale preventivo');
select t.eq((select jsonb_array_length(lines) from quotes limit 1), 1, 'righe vuote scartate');
select t.raises($$select quote_to_order((select id from quotes limit 1))$$, 'account', 'il cliente senza account non si converte');
select t.logout();

-- Paolo si registra con la stessa email del preventivo
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000c3', 'paolo@club.test', '{"full_name":"Paolo Ferri"}');
select t.login(:admin);
select save_quote((select id from quotes limit 1), '{"status":"in_preparazione"}');
select save_quote((select id from quotes limit 1), '{"status":"inviato"}');
select t.eq((select user_id from quotes limit 1), '00000000-0000-0000-0000-0000000000c3'::uuid, 'preventivo collegato all’account per email');
select t.logout();
select t.login('00000000-0000-0000-0000-0000000000c3');
select t.eq((select count(*) from quotes)::int, 1, 'Paolo vede il suo preventivo');
select decide_quote((select id from quotes limit 1), true);
select t.raises($$select decide_quote((select id from quotes limit 1), false)$$, 'in attesa di risposta', 'una sola risposta');
select t.logout();
select t.login(:bruno);
select t.raises($$select decide_quote((select id from quotes limit 1), true)$$, 'non trovato', 'Bruno non risponde ai preventivi altrui');
select t.logout();
select t.login(:staff);
insert into t.ctx values ('o3', quote_to_order((select id from quotes limit 1))::text);
select t.eq((select total_cents from orders where id = (select v::uuid from t.ctx where k='o3')), 168000, 'ordine dal preventivo');
select t.eq((select status from quotes limit 1), 'convertito', 'preventivo convertito');
select t.raises($$select quote_to_order((select id from quotes limit 1))$$, 'già stato convertito', 'una sola conversione');
select t.logout();

-- ============ scorte, ruoli, file ============
select t.login(:admin);
update products set active = true, stock = 2 where id = 'p-maglietta-esempio';
select set_role('00000000-0000-0000-0000-0000000000a1', 'staff');
select set_role('00000000-0000-0000-0000-0000000000a1', 'customer');
select t.raises($$select set_role('00000000-0000-0000-0000-00000000000a', 'customer')$$, 'te stesso', 'il titolare non si declassa');
select t.eq(t.rows_changed($$update settings set data = jsonb_set(data, '{lead_time}', '"Tempi aggiornati"')$$), 1, 'il titolare cambia le impostazioni');
select t.logout();

select t.login(:anna);
select t.raises($$select create_order('[{"product_id":"p-maglietta-esempio","qty":3,"selections":{"taglia":"M"}}]','{"street":"a","city":"b","zip":"c","province":"d"}','{}','','bonifico')$$, 'ne restano 2', 'scorta insufficiente');
insert into t.ctx values ('o4', create_order('[{"product_id":"p-maglietta-esempio","qty":2,"selections":{"taglia":"M"}}]','{"street":"a","city":"b","zip":"c","province":"d"}','{}','','bonifico')::text);
select t.logout();
select t.eq((select stock from products where id = 'p-maglietta-esempio'), 0, 'scorta scalata');
select t.login(:staff);
select set_order_status((select v::uuid from t.ctx where k='o4'), 'annullato', 'cliente ha rinunciato');
select t.logout();
select t.eq((select stock from products where id = 'p-maglietta-esempio'), 2, 'annullamento ripristina la scorta');

-- archivio file
select t.login(:anna);
insert into storage.objects (bucket_id, name) values ('files', '00000000-0000-0000-0000-0000000000a1/foto.jpg');
select t.raises($$insert into storage.objects (bucket_id, name) values ('files', '00000000-0000-0000-0000-0000000000b2/foto.jpg')$$, 'row-level security', 'non si carica nella cartella altrui');
select t.raises($$insert into storage.objects (bucket_id, name) values ('catalog', 'x.jpg')$$, 'row-level security', 'il cliente non carica foto catalogo');
select t.logout();
select t.login(:staff);
insert into storage.objects (bucket_id, name) select 'files', 'proofs/' || id || '/v1.png' from projects;
select t.logout();
select t.login(:anna);
select t.eq((select count(*) from storage.objects where name like 'proofs/%')::int, 1, 'Anna vede la bozza del proprio progetto');
select t.logout();
select t.login(:bruno);
select t.eq((select count(*) from storage.objects where name like 'proofs/%')::int, 0, 'Bruno non vede le bozze altrui');
select t.logout();

-- numerazione senza buchi
select t.eq((select count(distinct number) from orders)::int, (select count(*) from orders)::int, 'numeri ordine univoci');
select t.eq((select n from counters where key like 'DG-%'), (select count(*) from orders)::int, 'contatore = ordini creati');

\echo 'test.sql: OK'
