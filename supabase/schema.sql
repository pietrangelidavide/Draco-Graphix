-- Draco Graphix · schema del database (Supabase / Postgres)
--
-- Come usarlo: Supabase > SQL Editor > incolla tutto questo file > Run. Poi incolla ed esegui supabase/seed.sql.
-- Si può rieseguire senza danni (usa "if not exists" / "create or replace").
--
-- Sicurezza: ogni tabella ha le Row Level Security attive.
--  - il cliente vede e modifica solo i propri dati;
--  - il gestionale (ruolo staff / admin) vede tutto;
--  - ordini, pagamenti, bozze e preventivi si scrivono solo con le funzioni qui sotto, che ricalcolano i prezzi
--    leggendo il catalogo: l'app non può "decidere" un importo.

-- ============================================================
-- Funzioni di servizio
-- ============================================================

create table if not exists public.counters (
  key text primary key,
  n   integer not null default 0
);

-- "DG-2026-0001": numerazione progressiva per anno, senza buchi né doppioni
create or replace function public.next_number(prefix text) returns text
language plpgsql security definer set search_path = public as $$
declare k text := prefix || '-' || extract(year from now())::int; v integer;
begin
  insert into counters (key, n) values (k, 1)
  on conflict (key) do update set n = counters.n + 1
  returning n into v;
  return k || '-' || lpad(v::text, 4, '0');
end $$;

-- ============================================================
-- Profili e ruoli
-- ============================================================

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        text not null default 'customer' check (role in ('customer', 'staff', 'admin')),
  full_name   text not null default '',
  email       text not null default '',
  phone       text not null default '',
  address     jsonb,
  billing     jsonb not null default '{}'::jsonb,
  newsletter  boolean not null default false,
  staff_note  text not null default '',
  created_at  timestamptz not null default now()
);

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('staff', 'admin'))
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin')
$$;

-- alla registrazione nasce sempre un profilo "customer"
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name, phone)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'full_name', ''), coalesce(new.raw_user_meta_data ->> 'phone', ''))
  on conflict (id) do nothing;
  insert into notifications (user_id, audience, title, body, link)
  values (null, 'staff', 'Nuovo cliente registrato', coalesce(new.raw_user_meta_data ->> 'full_name', '') || ' · ' || coalesce(new.email, ''), '/gestionale/clienti/' || new.id);
  return new;
end $$;

-- ============================================================
-- Catalogo e impostazioni
-- ============================================================

create table if not exists public.brands (
  id     text primary key,
  name   text not null,
  sort   integer not null default 0,
  active boolean not null default true
);

create table if not exists public.products (
  id               text primary key,
  slug             text not null unique,
  name             text not null,
  kind             text not null check (kind in ('kit', 'forcella', 'accessorio')),
  brand_id         text references brands (id) on delete set null,
  tags             text[] not null default '{}',
  description      text not null default '',
  contents         text[] not null default '{}',
  specs            text[] not null default '{}',
  price_cents      integer not null check (price_cents >= 0),
  discount_percent integer not null default 0 check (discount_percent between 0 and 90),
  images           text[] not null default '{}',
  art_colors       text[] not null default '{}',
  fields           jsonb not null default '[]'::jsonb,
  badge            text,
  featured         boolean not null default false,
  active           boolean not null default true,
  stock            integer check (stock is null or stock >= 0),
  sort             integer not null default 0,
  created_at       timestamptz not null default now()
);

-- Un'unica riga (id = 1) con tutte le impostazioni in JSON: stessa forma di "Settings" in src/lib/types.ts
create table if not exists public.settings (
  id   integer primary key default 1 check (id = 1),
  data jsonb not null
);

-- ============================================================
-- Garage e preferiti
-- ============================================================

create table if not exists public.bikes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles (id) on delete cascade,
  brand        text not null default '',
  model        text not null,
  year         integer,
  rider_name   text not null default '',
  rider_number text not null default '',
  created_at   timestamptz not null default now()
);

create table if not exists public.wishlist (
  user_id    uuid not null references profiles (id) on delete cascade,
  product_id text not null references products (id) on delete cascade,
  primary key (user_id, product_id)
);

-- ============================================================
-- Ordini
-- ============================================================

create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  number           text not null unique,
  user_id          uuid not null references profiles (id),
  status           text not null default 'ricevuto' check (status in ('ricevuto', 'in_preparazione', 'in_stampa', 'pronto', 'spedito', 'consegnato', 'annullato')),
  payment_status   text not null default 'da_pagare' check (payment_status in ('da_pagare', 'acconto', 'pagato', 'rimborsato')),
  payment_method   text not null default '',
  subtotal_cents   integer not null,
  shipping_cents   integer not null default 0,
  total_cents      integer not null,
  shipping_address jsonb not null,
  billing          jsonb not null default '{}'::jsonb,
  customer_note    text not null default '',
  staff_note       text not null default '',
  courier          text not null default '',
  tracking_code    text not null default '',
  quote_id         uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists orders_user_idx on public.orders (user_id, created_at desc);
create index if not exists orders_status_idx on public.orders (status);

create table if not exists public.order_items (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references orders (id) on delete cascade,
  product_id       text references products (id) on delete set null,
  name             text not null,
  kind             text not null default 'kit',
  qty              integer not null check (qty > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  config           jsonb not null default '[]'::jsonb
);
create index if not exists order_items_order_idx on public.order_items (order_id);

create table if not exists public.order_events (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references orders (id) on delete cascade,
  status     text not null,
  note       text not null default '',
  actor_name text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists order_events_order_idx on public.order_events (order_id, created_at);

-- ============================================================
-- Grafiche personalizzate
-- ============================================================

create table if not exists public.projects (
  id               uuid primary key default gen_random_uuid(),
  number           text not null unique,
  user_id          uuid not null references profiles (id),
  title            text not null,
  status           text not null default 'nuovo' check (status in ('nuovo', 'in_grafica', 'bozza_inviata', 'modifiche', 'approvata', 'in_stampa', 'spedita', 'consegnata', 'annullata')),
  brief            jsonb not null default '{}'::jsonb,
  files            jsonb not null default '[]'::jsonb,
  deposit_cents    integer not null,
  total_cents      integer,
  revisions        integer not null default 0,
  courier          text not null default '',
  tracking_code    text not null default '',
  shipping_address jsonb,
  staff_note       text not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists projects_user_idx on public.projects (user_id, updated_at desc);

create table if not exists public.proofs (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references projects (id) on delete cascade,
  version          integer not null,
  file             jsonb not null,
  note             text not null default '',
  status           text not null default 'in_attesa' check (status in ('in_attesa', 'approvata', 'modifiche', 'sostituita')),
  customer_comment text not null default '',
  created_at       timestamptz not null default now(),
  decided_at       timestamptz,
  unique (project_id, version)
);

create table if not exists public.project_messages (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects (id) on delete cascade,
  sender_id   uuid references profiles (id) on delete set null,
  sender_role text not null default 'customer',
  sender_name text not null default '',
  kind        text not null default 'message' check (kind in ('message', 'system')),
  body        text not null default '',
  files       jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists project_messages_idx on public.project_messages (project_id, created_at);

-- ============================================================
-- Pagamenti (collegati a un ordine oppure a un progetto)
-- ============================================================

create table if not exists public.payments (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid references orders (id) on delete cascade,
  project_id   uuid references projects (id) on delete cascade,
  kind         text not null check (kind in ('ordine', 'acconto', 'saldo')),
  amount_cents integer not null check (amount_cents > 0),
  method       text not null default '',
  status       text not null default 'in_attesa' check (status in ('in_attesa', 'ricevuto', 'rimborsato')),
  reference    text not null default '',
  paid_at      timestamptz,
  created_at   timestamptz not null default now(),
  check ((order_id is not null) <> (project_id is not null))
);
create index if not exists payments_order_idx on public.payments (order_id);
create index if not exists payments_project_idx on public.payments (project_id);

-- ============================================================
-- Preventivi, contatti, notifiche
-- ============================================================

create table if not exists public.quotes (
  id          uuid primary key default gen_random_uuid(),
  number      text not null unique,
  user_id     uuid references profiles (id),
  contact     jsonb not null,
  team_name   text not null,
  riders      integer not null default 1,
  bike_type   text not null default '',
  service     text not null default '',
  message     text not null default '',
  status      text not null default 'nuova' check (status in ('nuova', 'in_preparazione', 'inviato', 'accettato', 'rifiutato', 'scaduto', 'convertito')),
  lines       jsonb not null default '[]'::jsonb,
  total_cents integer not null default 0,
  valid_until date,
  staff_note  text not null default '',
  order_id    uuid references orders (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.leads (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('contatto', 'newsletter')),
  name       text not null default '',
  email      text not null,
  phone      text not null default '',
  message    text not null default '',
  handled    boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references profiles (id) on delete cascade,
  audience   text not null default 'user' check (audience in ('user', 'staff')),
  title      text not null,
  body       text not null default '',
  link       text not null default '',
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

-- crea una notifica (solo uso interno)
create or replace function public.notify(p_user uuid, p_audience text, p_title text, p_body text, p_link text) returns void
language sql security definer set search_path = public as $$
  insert into notifications (user_id, audience, title, body, link) values (p_user, p_audience, p_title, coalesce(p_body, ''), coalesce(p_link, ''))
$$;

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists orders_touch on public.orders;
create trigger orders_touch before update on public.orders for each row execute function public.touch_updated_at();
drop trigger if exists projects_touch on public.projects;
create trigger projects_touch before update on public.projects for each row execute function public.touch_updated_at();
drop trigger if exists quotes_touch on public.quotes;
create trigger quotes_touch before update on public.quotes for each row execute function public.touch_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.profiles         enable row level security;
alter table public.brands           enable row level security;
alter table public.products         enable row level security;
alter table public.settings         enable row level security;
alter table public.bikes            enable row level security;
alter table public.wishlist         enable row level security;
alter table public.orders           enable row level security;
alter table public.order_items      enable row level security;
alter table public.order_events     enable row level security;
alter table public.projects         enable row level security;
alter table public.proofs           enable row level security;
alter table public.project_messages enable row level security;
alter table public.payments         enable row level security;
alter table public.quotes           enable row level security;
alter table public.leads            enable row level security;
alter table public.notifications    enable row level security;
alter table public.counters         enable row level security;

-- profili: ognuno il proprio, il gestionale tutti; modifica solo dei campi personali (vedi i grant più sotto)
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (id = auth.uid() or public.is_staff());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- catalogo: tutti leggono ciò che è pubblicato; il gestionale scrive
drop policy if exists brands_select on public.brands;
create policy brands_select on public.brands for select using (active or public.is_staff());
drop policy if exists brands_write on public.brands;
create policy brands_write on public.brands for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists products_select on public.products;
create policy products_select on public.products for select using (active or public.is_staff());
drop policy if exists products_write on public.products;
create policy products_write on public.products for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists settings_select on public.settings;
create policy settings_select on public.settings for select using (true);
drop policy if exists settings_update on public.settings;
create policy settings_update on public.settings for update using (public.is_admin()) with check (public.is_admin());

-- garage e preferiti: solo del proprietario (il gestionale può leggere il garage)
drop policy if exists bikes_select on public.bikes;
create policy bikes_select on public.bikes for select using (user_id = auth.uid() or public.is_staff());
drop policy if exists bikes_write on public.bikes;
create policy bikes_write on public.bikes for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists wishlist_all on public.wishlist;
create policy wishlist_all on public.wishlist for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ordini: il cliente legge i suoi; scrivono solo le funzioni e (per note/spedizione) il gestionale
drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders for select using (user_id = auth.uid() or public.is_staff());
drop policy if exists orders_update on public.orders;
create policy orders_update on public.orders for update using (public.is_staff()) with check (public.is_staff());

drop policy if exists order_items_select on public.order_items;
create policy order_items_select on public.order_items for select
  using (exists (select 1 from orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_staff())));
drop policy if exists order_events_select on public.order_events;
create policy order_events_select on public.order_events for select
  using (exists (select 1 from orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_staff())));

drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects for select using (user_id = auth.uid() or public.is_staff());
drop policy if exists proofs_select on public.proofs;
create policy proofs_select on public.proofs for select
  using (exists (select 1 from projects p where p.id = project_id and (p.user_id = auth.uid() or public.is_staff())));
drop policy if exists project_messages_select on public.project_messages;
create policy project_messages_select on public.project_messages for select
  using (exists (select 1 from projects p where p.id = project_id and (p.user_id = auth.uid() or public.is_staff())));

drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments for select using (
  public.is_staff()
  or exists (select 1 from orders o where o.id = order_id and o.user_id = auth.uid())
  or exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid())
);

drop policy if exists quotes_select on public.quotes;
create policy quotes_select on public.quotes for select using (user_id = auth.uid() or public.is_staff());

drop policy if exists leads_staff on public.leads;
create policy leads_staff on public.leads for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select
  using (user_id = auth.uid() or (audience = 'staff' and public.is_staff()));

-- ============================================================
-- Permessi sulle colonne (le scritture sensibili passano dalle funzioni)
-- ============================================================

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on public.brands, public.products, public.settings to anon, authenticated;
grant select on public.profiles, public.bikes, public.wishlist, public.orders, public.order_items, public.order_events,
  public.projects, public.proofs, public.project_messages, public.payments, public.quotes, public.leads, public.notifications to authenticated;

grant insert, update, delete on public.brands, public.products to authenticated;
grant update (data) on public.settings to authenticated;
grant update (full_name, phone, address, billing, newsletter) on public.profiles to authenticated;
grant insert, update, delete on public.bikes to authenticated;
grant insert, delete on public.wishlist to authenticated;
-- il gestionale aggiorna note, corriere e tracking; gli stati passano da set_order_status()
grant update (staff_note, courier, tracking_code) on public.orders to authenticated;
grant update (handled) on public.leads to authenticated;

-- ============================================================
-- Funzioni di lavoro (security definer: controllano loro chi sei)
-- ============================================================

create or replace function public.require_login() returns uuid language plpgsql stable as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'Accedi per continuare' using errcode = '28000'; end if;
  return u;
end $$;

create or replace function public.require_staff() returns uuid language plpgsql stable security definer set search_path = public as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'Accedi per continuare' using errcode = '28000'; end if;
  if not is_staff() then raise exception 'Operazione riservata al gestionale' using errcode = '42501'; end if;
  return u;
end $$;

create or replace function public.actor_name() returns text language sql stable security definer set search_path = public as $$
  select coalesce((select full_name from profiles where id = auth.uid()), '')
$$;

-- ---------- ordini ----------

create or replace function public.create_order(p_items jsonb, p_shipping jsonb, p_billing jsonb, p_note text, p_method text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  u uuid := require_login();
  st jsonb;
  item jsonb; f jsonb; ch jsonb;
  prod products;
  sel jsonb; v text;
  qty integer; unit integer; cfg jsonb;
  lines jsonb := '[]'::jsonb;
  subtotal integer := 0; ship integer := 0; free_over integer;
  oid uuid := gen_random_uuid();
  num text;
  l jsonb;
begin
  select data into st from settings where id = 1;
  if st is null then raise exception 'Impostazioni mancanti'; end if;
  if coalesce(btrim(p_shipping ->> 'street'), '') = '' or coalesce(btrim(p_shipping ->> 'city'), '') = ''
     or coalesce(btrim(p_shipping ->> 'zip'), '') = '' or coalesce(btrim(p_shipping ->> 'province'), '') = '' then
    raise exception 'Completa l’indirizzo di spedizione';
  end if;
  if not exists (select 1 from jsonb_array_elements(st -> 'payment_methods') m where m ->> 'id' = p_method and (m ->> 'enabled')::boolean) then
    raise exception 'Scegli un metodo di pagamento';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Il carrello è vuoto'; end if;

  for item in select * from jsonb_array_elements(p_items) loop
    select * into prod from products where id = item ->> 'product_id' and active;
    if not found then raise exception 'Prodotto non disponibile'; end if;
    qty := least(greatest(coalesce(nullif(item ->> 'qty', '')::numeric::integer, 0), 1), 20);
    unit := round(prod.price_cents * (100 - prod.discount_percent)::numeric / 100)::integer;
    sel := coalesce(item -> 'selections', '{}'::jsonb);
    cfg := '[]'::jsonb;

    for f in select * from jsonb_array_elements(prod.fields) loop
      v := btrim(coalesce(sel ->> (f ->> 'key'), ''), E' \t\r\n');
      if v = '' then
        if coalesce((f ->> 'required')::boolean, false) then raise exception '%: Campo obbligatorio (%)', prod.name, f ->> 'label'; end if;
        continue;
      end if;
      if f ->> 'type' = 'text' then
        if char_length(v) > coalesce((f ->> 'maxLength')::integer, 60) then raise exception '%: % troppo lungo', prod.name, f ->> 'label'; end if;
        cfg := cfg || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('key', f ->> 'key', 'label', f ->> 'label', 'value', v, 'value_label', v, 'delta_cents', 0, 'role', f -> 'role')));
      elsif f ->> 'type' = 'year' then
        if not (v = 'precedente' or (v ~ '^\d{4}$' and v::integer between 1990 and 2100)) then raise exception '%: annata non valida', prod.name; end if;
        cfg := cfg || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('key', f ->> 'key', 'label', f ->> 'label', 'value', v,
          'value_label', case when v = 'precedente' then 'Precedente al 2005' else v end, 'delta_cents', 0, 'role', f -> 'role')));
      else
        select c into ch from jsonb_array_elements(coalesce(f -> 'choices', '[]'::jsonb)) c where c ->> 'value' = v limit 1;
        if ch is null then raise exception '%: scelta non valida (%)', prod.name, f ->> 'label'; end if;
        unit := unit + (ch ->> 'delta_cents')::integer;
        cfg := cfg || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('key', f ->> 'key', 'label', f ->> 'label', 'value', ch ->> 'value',
          'value_label', ch ->> 'label', 'delta_cents', (ch ->> 'delta_cents')::integer, 'role', f -> 'role')));
      end if;
    end loop;

    if prod.stock is not null then
      if qty > prod.stock then raise exception '%: ne restano %', prod.name, prod.stock; end if;
      update products set stock = stock - qty where id = prod.id;
    end if;
    subtotal := subtotal + unit * qty;
    lines := lines || jsonb_build_array(jsonb_build_object('product_id', prod.id, 'name', prod.name, 'kind', prod.kind, 'qty', qty, 'unit', unit, 'config', cfg));
  end loop;

  free_over := nullif(st ->> 'shipping_free_over_cents', '')::integer;
  ship := case when subtotal <= 0 then 0 when free_over is not null and subtotal >= free_over then 0 else (st ->> 'shipping_flat_cents')::integer end;
  num := next_number('DG');

  insert into orders (id, number, user_id, status, payment_status, payment_method, subtotal_cents, shipping_cents, total_cents, shipping_address, billing, customer_note)
  values (oid, num, u, 'ricevuto', 'da_pagare', p_method, subtotal, ship, subtotal + ship, p_shipping, coalesce(p_billing, '{}'::jsonb), left(coalesce(p_note, ''), 500));

  for l in select * from jsonb_array_elements(lines) loop
    insert into order_items (order_id, product_id, name, kind, qty, unit_price_cents, config)
    values (oid, l ->> 'product_id', l ->> 'name', l ->> 'kind', (l ->> 'qty')::integer, (l ->> 'unit')::integer, l -> 'config');
  end loop;

  insert into payments (order_id, kind, amount_cents, method, status) values (oid, 'ordine', subtotal + ship, p_method, 'in_attesa');
  insert into order_events (order_id, status, note, actor_name) values (oid, 'ricevuto', 'Ordine ricevuto', actor_name());
  perform notify(null, 'staff', 'Nuovo ordine ' || num, actor_name() || ' · ' || to_char((subtotal + ship) / 100.0, 'FM999990.00') || ' €', '/gestionale/ordini/' || oid);
  return oid;
end $$;

create or replace function public.set_order_status(p_id uuid, p_status text, p_note text default '') returns void
language plpgsql security definer set search_path = public as $$
declare o orders; it record;
  labels constant jsonb := '{"ricevuto":"Ricevuto","in_preparazione":"In preparazione","in_stampa":"In stampa","pronto":"Pronto","spedito":"Spedito","consegnato":"Consegnato","annullato":"Annullato"}';
  msgs constant jsonb := '{"ricevuto":"Abbiamo ricevuto il tuo ordine.","in_preparazione":"Stiamo preparando i file per la tua moto.","in_stampa":"Le tue grafiche sono in stampa.","pronto":"Il kit è pronto: lo affidiamo al corriere.","spedito":"Il pacco è in viaggio.","consegnato":"Consegnato. Buon divertimento in pista!","annullato":"Ordine annullato."}';
begin
  perform require_staff();
  select * into o from orders where id = p_id for update;
  if not found then raise exception 'Ordine non trovato'; end if;
  if not (labels ? p_status) then raise exception 'Stato non valido'; end if;
  if o.status = p_status then return; end if;
  if p_status = 'annullato' then
    for it in select product_id, qty from order_items where order_id = o.id and product_id is not null loop
      update products set stock = stock + it.qty where id = it.product_id and stock is not null;
    end loop;
  end if;
  update orders set status = p_status where id = o.id;
  insert into order_events (order_id, status, note, actor_name) values (o.id, p_status, coalesce(p_note, ''), actor_name());
  perform notify(o.user_id, 'user', o.number || ': ' || (labels ->> p_status), msgs ->> p_status, '/account/ordini/' || o.id);
end $$;

-- ---------- pagamenti ----------

create or replace function public.apply_payment_received(p_id uuid, p_reference text, p_actor text) returns void
language plpgsql security definer set search_path = public as $$
declare pay payments; o orders; pr projects; paid integer; ps text;
begin
  select * into pay from payments where id = p_id for update;
  update payments set status = 'ricevuto', paid_at = now(), reference = coalesce(nullif(p_reference, ''), reference) where id = p_id;
  if pay.order_id is not null then
    select * into o from orders where id = pay.order_id for update;
    select coalesce(sum(amount_cents), 0) into paid from payments where order_id = o.id and status = 'ricevuto';
    ps := case when paid >= o.total_cents and o.total_cents > 0 then 'pagato' when paid > 0 then 'acconto' else 'da_pagare' end;
    update orders set payment_status = ps where id = o.id;
    if ps = 'pagato' and o.status = 'ricevuto' then
      update orders set status = 'in_preparazione' where id = o.id;
      insert into order_events (order_id, status, note, actor_name) values (o.id, 'in_preparazione', 'Pagamento ricevuto', p_actor);
      perform notify(o.user_id, 'user', 'Pagamento ricevuto · ' || o.number, 'Stiamo preparando i file per la tua moto.', '/account/ordini/' || o.id);
    end if;
  elsif pay.project_id is not null then
    select * into pr from projects where id = pay.project_id for update;
    update projects set updated_at = now() where id = pr.id;
    if pay.kind = 'acconto' and pr.status = 'nuovo' then
      update projects set status = 'in_grafica' where id = pr.id;
      insert into project_messages (project_id, sender_name, kind, body) values (pr.id, 'Draco Graphix', 'system', 'Acconto ricevuto: il grafico inizia a lavorare alla prima bozza.');
      perform notify(pr.user_id, 'user', 'Acconto ricevuto · ' || pr.number, 'Il grafico inizia a lavorare alla prima bozza.', '/account/progetti/' || pr.id);
    elsif pay.kind = 'saldo' then
      insert into project_messages (project_id, sender_name, kind, body) values (pr.id, 'Draco Graphix', 'system', 'Saldo ricevuto: passiamo alla stampa.');
      perform notify(pr.user_id, 'user', 'Saldo ricevuto · ' || pr.number, 'Passiamo alla stampa.', '/account/progetti/' || pr.id);
    end if;
  end if;
end $$;

create or replace function public.record_payment(p_order uuid, p_project uuid, p_kind text, p_amount integer, p_method text, p_reference text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  perform require_staff();
  if (p_order is null) = (p_project is null) then raise exception 'Collega il pagamento a un ordine o a un progetto'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Importo non valido'; end if;
  insert into payments (order_id, project_id, kind, amount_cents, method, status, reference)
  values (p_order, p_project, p_kind, p_amount, coalesce(p_method, ''), 'in_attesa', coalesce(p_reference, ''))
  returning id into pid;
  perform apply_payment_received(pid, p_reference, actor_name());
  return pid;
end $$;

create or replace function public.confirm_payment(p_id uuid, p_reference text default '') returns void
language plpgsql security definer set search_path = public as $$
declare st text;
begin
  perform require_staff();
  select status into st from payments where id = p_id;
  if st is null then raise exception 'Pagamento non trovato'; end if;
  if st = 'ricevuto' then return; end if;
  perform apply_payment_received(p_id, p_reference, actor_name());
end $$;

-- ---------- grafiche personalizzate ----------

create or replace function public.submit_project(p_title text, p_brief jsonb, p_files jsonb, p_shipping jsonb, p_method text)
returns uuid language plpgsql security definer set search_path = public as $$
declare u uuid := require_login(); st jsonb; pid uuid := gen_random_uuid(); num text; dep integer; title text;
begin
  select data into st from settings where id = 1;
  if coalesce(btrim(p_brief ->> 'model'), '') = '' then raise exception 'Indica il modello della moto'; end if;
  if coalesce(btrim(p_brief ->> 'style'), '') = '' then raise exception 'Racconta com’è la grafica che immagini'; end if;
  if not exists (select 1 from jsonb_array_elements(st -> 'payment_methods') m where m ->> 'id' = p_method and (m ->> 'enabled')::boolean) then
    raise exception 'Scegli come versare l’acconto';
  end if;
  dep := (st ->> 'deposit_cents')::integer;
  num := next_number('GP');
  title := coalesce(nullif(btrim(p_title), ''), btrim(coalesce(p_brief ->> 'brand', '') || ' ' || coalesce(p_brief ->> 'model', '')));
  insert into projects (id, number, user_id, title, status, brief, files, deposit_cents, shipping_address)
  values (pid, num, u, title, 'nuovo', p_brief, coalesce(p_files, '[]'::jsonb), dep, p_shipping);
  insert into payments (project_id, kind, amount_cents, method, status) values (pid, 'acconto', dep, p_method, 'in_attesa');
  insert into project_messages (project_id, sender_name, kind, body) values (pid, 'Draco Graphix', 'system', 'Brief ricevuto. Appena arriva l’acconto il grafico inizia a lavorare.');
  perform notify(null, 'staff', 'Nuovo progetto ' || num, actor_name() || ' · ' || title, '/gestionale/progetti/' || pid);
  return pid;
end $$;

create or replace function public.set_project_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare pr projects;
  labels constant jsonb := '{"nuovo":"In attesa acconto","in_grafica":"In grafica","bozza_inviata":"Bozza da approvare","modifiche":"Modifiche richieste","approvata":"Approvata","in_stampa":"In stampa","spedita":"Spedita","consegnata":"Consegnata","annullata":"Annullata"}';
  msgs constant jsonb := '{"nuovo":"Versa l’acconto: appena lo riceviamo il grafico inizia a lavorare.","in_grafica":"Il nostro grafico sta preparando la prima bozza.","bozza_inviata":"La bozza è pronta: approvala o chiedi modifiche.","modifiche":"Il grafico sta applicando le tue modifiche.","approvata":"Bozza approvata. Versa il saldo per passare alla stampa.","in_stampa":"La tua grafica è in stampa.","spedita":"Il pacco è in viaggio.","consegnata":"Consegnata. Buon divertimento in pista!","annullata":"Progetto annullato."}';
begin
  perform require_staff();
  select * into pr from projects where id = p_id for update;
  if not found then raise exception 'Progetto non trovato'; end if;
  if not (labels ? p_status) then raise exception 'Stato non valido'; end if;
  if pr.status = p_status then return; end if;
  update projects set status = p_status where id = pr.id;
  insert into project_messages (project_id, sender_name, kind, body) values (pr.id, 'Draco Graphix', 'system', 'Stato aggiornato: ' || (labels ->> p_status) || '.');
  perform notify(pr.user_id, 'user', pr.number || ': ' || (labels ->> p_status), msgs ->> p_status, '/account/progetti/' || pr.id);
end $$;

create or replace function public.staff_update_project(p_id uuid, p_patch jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare pr projects; new_total integer;
begin
  perform require_staff();
  select * into pr from projects where id = p_id for update;
  if not found then raise exception 'Progetto non trovato'; end if;
  if p_patch ? 'total_cents' then
    new_total := nullif(p_patch ->> 'total_cents', '')::integer;
    if new_total is distinct from pr.total_cents and new_total is not null then
      insert into project_messages (project_id, sender_name, kind, body)
      values (pr.id, 'Draco Graphix', 'system', 'Totale della grafica: ' || to_char(new_total / 100.0, 'FM999990.00') || ' € (acconto già scalato).');
    end if;
    update projects set total_cents = new_total where id = pr.id;
  end if;
  if p_patch ? 'staff_note' then update projects set staff_note = left(coalesce(p_patch ->> 'staff_note', ''), 2000) where id = pr.id; end if;
  if p_patch ? 'courier' then update projects set courier = left(coalesce(p_patch ->> 'courier', ''), 80) where id = pr.id; end if;
  if p_patch ? 'tracking_code' then update projects set tracking_code = left(coalesce(p_patch ->> 'tracking_code', ''), 120) where id = pr.id; end if;
end $$;

create or replace function public.add_proof(p_project uuid, p_file jsonb, p_note text) returns uuid
language plpgsql security definer set search_path = public as $$
declare pr projects; v integer; pid uuid;
begin
  perform require_staff();
  select * into pr from projects where id = p_project for update;
  if not found then raise exception 'Progetto non trovato'; end if;
  select coalesce(max(version), 0) + 1 into v from proofs where project_id = p_project;
  update proofs set status = 'sostituita' where project_id = p_project and status = 'in_attesa';
  insert into proofs (project_id, version, file, note) values (p_project, v, p_file, left(coalesce(p_note, ''), 1000)) returning id into pid;
  update projects set status = 'bozza_inviata' where id = p_project;
  insert into project_messages (project_id, sender_name, kind, body) values (p_project, 'Draco Graphix', 'system', actor_name() || ' ha caricato la bozza v' || v || '.');
  perform notify(pr.user_id, 'user', 'Bozza pronta · ' || pr.number, 'È pronta la bozza v' || v || ': approvala o chiedi modifiche.', '/account/progetti/' || pr.id);
  return pid;
end $$;

create or replace function public.decide_proof(p_proof uuid, p_decision text, p_comment text default '') returns void
language plpgsql security definer set search_path = public as $$
declare u uuid := require_login(); pf proofs; pr projects; cmt text := btrim(coalesce(p_comment, '')); who text := actor_name();
begin
  select * into pf from proofs where id = p_proof for update;
  if not found then raise exception 'Bozza non trovata'; end if;
  select * into pr from projects where id = pf.project_id for update;
  if pr.user_id <> u then raise exception 'Bozza non trovata' using errcode = '42501'; end if;
  if pf.status <> 'in_attesa' then raise exception 'Questa bozza è già stata valutata'; end if;
  if p_decision not in ('approvata', 'modifiche') then raise exception 'Decisione non valida'; end if;
  if p_decision = 'modifiche' and cmt = '' then raise exception 'Scrivi cosa vuoi cambiare'; end if;
  update proofs set status = p_decision, customer_comment = left(cmt, 1000), decided_at = now() where id = pf.id;
  if p_decision = 'approvata' then
    update projects set status = 'approvata' where id = pr.id;
    insert into project_messages (project_id, sender_name, kind, body) values (pr.id, 'Draco Graphix', 'system', who || ' ha approvato la bozza v' || pf.version || '.');
    perform notify(null, 'staff', 'Bozza approvata · ' || pr.number, who || ' ha approvato la v' || pf.version || '. Imposta il totale e chiedi il saldo.', '/gestionale/progetti/' || pr.id);
  else
    update projects set status = 'modifiche', revisions = revisions + 1 where id = pr.id;
    insert into project_messages (project_id, sender_name, kind, body) values (pr.id, 'Draco Graphix', 'system', who || ' ha chiesto modifiche alla bozza v' || pf.version || '.');
    perform notify(null, 'staff', 'Modifiche richieste · ' || pr.number, left(cmt, 140), '/gestionale/progetti/' || pr.id);
  end if;
  if cmt <> '' then
    insert into project_messages (project_id, sender_id, sender_role, sender_name, kind, body) values (pr.id, u, 'customer', who, 'message', left(cmt, 2000));
  end if;
end $$;

create or replace function public.send_project_message(p_project uuid, p_body text, p_files jsonb default '[]') returns uuid
language plpgsql security definer set search_path = public as $$
declare u uuid := require_login(); pr projects; staff boolean := is_staff(); mid uuid; body text := btrim(coalesce(p_body, '')); who text := actor_name(); r text;
begin
  select * into pr from projects where id = p_project;
  if not found or (pr.user_id <> u and not staff) then raise exception 'Progetto non trovato' using errcode = '42501'; end if;
  if body = '' and coalesce(jsonb_array_length(p_files), 0) = 0 then raise exception 'Scrivi un messaggio'; end if;
  select role into r from profiles where id = u;
  insert into project_messages (project_id, sender_id, sender_role, sender_name, kind, body, files)
  values (p_project, u, r, who, 'message', left(body, 2000), coalesce(p_files, '[]'::jsonb)) returning id into mid;
  update projects set updated_at = now() where id = p_project;
  if staff then
    perform notify(pr.user_id, 'user', 'Nuovo messaggio · ' || pr.number, left(body, 140), '/account/progetti/' || pr.id);
  else
    perform notify(null, 'staff', 'Messaggio da ' || who || ' · ' || pr.number, left(body, 140), '/gestionale/progetti/' || pr.id);
  end if;
  return mid;
end $$;

-- ---------- preventivi ----------

-- chiamabile anche senza account (come il modulo del sito attuale)
create or replace function public.submit_quote(p_contact jsonb, p_team text, p_riders integer, p_bike_type text, p_service text, p_message text)
returns uuid language plpgsql security definer set search_path = public as $$
declare qid uuid := gen_random_uuid(); num text;
begin
  if coalesce(btrim(p_contact ->> 'name'), '') = '' then raise exception 'Indica il tuo nome'; end if;
  if coalesce(p_contact ->> 'email', '') !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then raise exception 'Email non valida'; end if;
  if coalesce(btrim(p_team), '') = '' then raise exception 'Indica il nome del team o del motoclub'; end if;
  num := next_number('PR');
  insert into quotes (id, number, user_id, contact, team_name, riders, bike_type, service, message)
  values (qid, num, auth.uid(),
    jsonb_build_object('name', left(p_contact ->> 'name', 120), 'email', left(p_contact ->> 'email', 200), 'phone', left(coalesce(p_contact ->> 'phone', ''), 40)),
    left(btrim(p_team), 120), greatest(coalesce(p_riders, 1), 1), left(coalesce(p_bike_type, ''), 120), left(coalesce(p_service, ''), 200), left(coalesce(p_message, ''), 2000));
  perform notify(null, 'staff', 'Nuova richiesta di preventivo ' || num, left(btrim(p_team), 120) || ' · ' || greatest(coalesce(p_riders, 1), 1) || ' piloti', '/gestionale/preventivi/' || qid);
  return qid;
end $$;

create or replace function public.save_quote(p_id uuid, p_patch jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare q quotes; ln jsonb; clean jsonb := '[]'::jsonb; total integer := 0; match uuid;
begin
  perform require_staff();
  select * into q from quotes where id = p_id for update;
  if not found then raise exception 'Preventivo non trovato'; end if;
  if p_patch ? 'lines' then
    for ln in select * from jsonb_array_elements(p_patch -> 'lines') loop
      if coalesce(btrim(ln ->> 'description'), '') <> '' then
        clean := clean || jsonb_build_array(jsonb_build_object('description', ln ->> 'description', 'qty', greatest((ln ->> 'qty')::integer, 1), 'unit_price_cents', greatest((ln ->> 'unit_price_cents')::integer, 0)));
        total := total + greatest((ln ->> 'qty')::integer, 1) * greatest((ln ->> 'unit_price_cents')::integer, 0);
      end if;
    end loop;
    update quotes set lines = clean, total_cents = total where id = p_id;
  end if;
  if p_patch ? 'valid_until' then update quotes set valid_until = nullif(p_patch ->> 'valid_until', '')::date where id = p_id; end if;
  if p_patch ? 'staff_note' then update quotes set staff_note = left(coalesce(p_patch ->> 'staff_note', ''), 2000) where id = p_id; end if;
  if p_patch ? 'status' then
    if (p_patch ->> 'status') not in ('nuova', 'in_preparazione', 'inviato', 'accettato', 'rifiutato', 'scaduto') then raise exception 'Stato non valido'; end if;
    update quotes set status = p_patch ->> 'status' where id = p_id;
    if p_patch ->> 'status' = 'inviato' and q.status <> 'inviato' then
      if q.user_id is null then
        select id into match from profiles where lower(email) = lower(q.contact ->> 'email') limit 1;
        if match is not null then update quotes set user_id = match where id = p_id; end if;
      end if;
      select user_id, total_cents into q.user_id, total from quotes where id = p_id;
      if q.user_id is not null then
        perform notify(q.user_id, 'user', 'Preventivo ' || q.number || ' pronto', q.team_name || ': ' || to_char(total / 100.0, 'FM999990.00') || ' €. Aprilo per accettarlo.', '/account/preventivi/' || p_id);
      end if;
    end if;
  end if;
end $$;

create or replace function public.decide_quote(p_id uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare u uuid := require_login(); q quotes;
begin
  select * into q from quotes where id = p_id for update;
  if not found or q.user_id is distinct from u then raise exception 'Preventivo non trovato' using errcode = '42501'; end if;
  if q.status <> 'inviato' then raise exception 'Il preventivo non è in attesa di risposta'; end if;
  update quotes set status = case when p_accept then 'accettato' else 'rifiutato' end where id = p_id;
  perform notify(null, 'staff', 'Preventivo ' || q.number || case when p_accept then ' accettato' else ' rifiutato' end, q.team_name || ' · ' || to_char(q.total_cents / 100.0, 'FM999990.00') || ' €', '/gestionale/preventivi/' || p_id);
end $$;

create or replace function public.quote_to_order(p_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare q quotes; cust profiles; oid uuid := gen_random_uuid(); num text; ln jsonb; meth text; st jsonb; addr jsonb;
begin
  perform require_staff();
  select * into q from quotes where id = p_id for update;
  if not found then raise exception 'Preventivo non trovato'; end if;
  if q.order_id is not null then raise exception 'Questo preventivo è già stato convertito'; end if;
  if jsonb_array_length(q.lines) = 0 then raise exception 'Il preventivo non ha righe'; end if;
  if q.user_id is null then
    select id into q.user_id from profiles where lower(email) = lower(q.contact ->> 'email') limit 1;
    if q.user_id is null then raise exception 'Il cliente non ha ancora un account: fallo registrare con la stessa email del preventivo'; end if;
  end if;
  select * into cust from profiles where id = q.user_id;
  select data into st from settings where id = 1;
  select m ->> 'id' into meth from jsonb_array_elements(st -> 'payment_methods') m where (m ->> 'enabled')::boolean limit 1;
  addr := coalesce(cust.address, '{"street":"","city":"","zip":"","province":"","country":"IT"}'::jsonb);
  num := next_number('DG');
  insert into orders (id, number, user_id, payment_method, subtotal_cents, shipping_cents, total_cents, shipping_address, billing, customer_note, quote_id)
  values (oid, num, q.user_id, coalesce(meth, 'bonifico'), q.total_cents, 0, q.total_cents, addr, cust.billing, 'Da preventivo ' || q.number, q.id);
  for ln in select * from jsonb_array_elements(q.lines) loop
    insert into order_items (order_id, product_id, name, kind, qty, unit_price_cents, config)
    values (oid, null, ln ->> 'description', 'altro', (ln ->> 'qty')::integer, (ln ->> 'unit_price_cents')::integer, '[]'::jsonb);
  end loop;
  insert into payments (order_id, kind, amount_cents, method, status) values (oid, 'ordine', q.total_cents, coalesce(meth, 'bonifico'), 'in_attesa');
  insert into order_events (order_id, status, note, actor_name) values (oid, 'ricevuto', 'Creato dal preventivo ' || q.number, actor_name());
  update quotes set status = 'convertito', order_id = oid, user_id = q.user_id where id = q.id;
  perform notify(q.user_id, 'user', 'Ordine ' || num || ' creato', 'Dal preventivo ' || q.number || '. Versa il pagamento per avviare la produzione.', '/account/ordini/' || oid);
  return oid;
end $$;

-- ---------- contatti, ruoli, notifiche ----------

create or replace function public.submit_lead(p_kind text, p_name text, p_email text, p_phone text default '', p_message text default '') returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_kind not in ('contatto', 'newsletter') then raise exception 'Tipo non valido'; end if;
  if coalesce(p_email, '') !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then raise exception 'Email non valida'; end if;
  if p_kind = 'contatto' and btrim(coalesce(p_message, '')) = '' then raise exception 'Scrivi un messaggio'; end if;
  if p_kind = 'newsletter' and exists (select 1 from leads where kind = 'newsletter' and lower(email) = lower(btrim(p_email))) then return; end if;
  insert into leads (kind, name, email, phone, message) values (p_kind, left(coalesce(p_name, ''), 120), left(btrim(p_email), 200), left(coalesce(p_phone, ''), 40), left(coalesce(p_message, ''), 2000));
  if p_kind = 'contatto' then
    perform notify(null, 'staff', 'Messaggio da ' || coalesce(nullif(btrim(p_name), ''), p_email), left(p_message, 140), '/gestionale/contatti');
  end if;
end $$;

create or replace function public.set_role(p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo il titolare può cambiare i ruoli' using errcode = '42501'; end if;
  if p_role not in ('customer', 'staff', 'admin') then raise exception 'Ruolo non valido'; end if;
  if p_user = auth.uid() and p_role <> 'admin' then raise exception 'Non puoi togliere a te stesso il ruolo di titolare'; end if;
  update profiles set role = p_role where id = p_user;
end $$;

create or replace function public.set_customer_note(p_user uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform require_staff();
  update profiles set staff_note = left(coalesce(p_note, ''), 2000) where id = p_user;
end $$;

create or replace function public.mark_notification_read(p_id uuid) returns void
language sql security definer set search_path = public as $$
  update notifications set read_at = now()
  where id = p_id and read_at is null and (user_id = auth.uid() or (audience = 'staff' and is_staff()))
$$;

create or replace function public.mark_all_notifications_read() returns void
language sql security definer set search_path = public as $$
  update notifications set read_at = now()
  where read_at is null and (user_id = auth.uid() or (audience = 'staff' and is_staff()))
$$;

-- ---------- chi può chiamare cosa ----------

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.is_staff(), public.is_admin() to anon, authenticated;
grant execute on function
  public.create_order(jsonb, jsonb, jsonb, text, text),
  public.set_order_status(uuid, text, text),
  public.record_payment(uuid, uuid, text, integer, text, text),
  public.confirm_payment(uuid, text),
  public.submit_project(text, jsonb, jsonb, jsonb, text),
  public.set_project_status(uuid, text),
  public.staff_update_project(uuid, jsonb),
  public.add_proof(uuid, jsonb, text),
  public.decide_proof(uuid, text, text),
  public.send_project_message(uuid, text, jsonb),
  public.save_quote(uuid, jsonb),
  public.decide_quote(uuid, boolean),
  public.quote_to_order(uuid),
  public.set_role(uuid, text),
  public.set_customer_note(uuid, text),
  public.mark_notification_read(uuid),
  public.mark_all_notifications_read()
to authenticated;
-- questi due si possono usare anche senza account
grant execute on function public.submit_quote(jsonb, text, integer, text, text, text) to anon, authenticated;
grant execute on function public.submit_lead(text, text, text, text, text) to anon, authenticated;

-- ============================================================
-- Registrazione: crea il profilo
-- ============================================================

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ============================================================
-- Archivio file (Storage)
--   files   (privato): riferimenti dei clienti in "<id utente>/..." e bozze in "proofs/<id progetto>/..."
--   catalog (pubblico): foto dei prodotti, le carica il gestionale
-- ============================================================

insert into storage.buckets (id, name, public) values ('files', 'files', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('catalog', 'catalog', true) on conflict (id) do nothing;

drop policy if exists files_insert on storage.objects;
create policy files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'files' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));

drop policy if exists files_select on storage.objects;
create policy files_select on storage.objects for select to authenticated
  using (
    bucket_id = 'files' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_staff()
      or ((storage.foldername(name))[1] = 'proofs'
          and exists (select 1 from public.projects p where p.id::text = (storage.foldername(name))[2] and p.user_id = auth.uid()))
    )
  );

drop policy if exists catalog_write on storage.objects;
create policy catalog_write on storage.objects for all to authenticated
  using (bucket_id = 'catalog' and public.is_staff()) with check (bucket_id = 'catalog' and public.is_staff());
