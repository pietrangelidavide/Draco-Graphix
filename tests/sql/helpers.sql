-- Funzioni di aiuto per i test: cambiare utente, confrontare valori, controllare errori.
create schema if not exists t;
grant usage on schema t to anon, authenticated;

create or replace function t.login(u uuid, r text default 'authenticated') returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', coalesce(u::text, ''), false);
  execute format('set role %I', r);
end $$;

create or replace function t.logout() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', '', false);
end $$;

create or replace function t.eq(actual anyelement, expected anyelement, msg text) returns void language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FALLITO: % (atteso %, trovato %)', msg, expected, actual;
  end if;
end $$;

create or replace function t.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'FALLITO: %', msg; end if;
end $$;

-- esegue sql e si aspetta un errore il cui testo corrisponde a pattern
create or replace function t.raises(sql text, pattern text, msg text) returns void language plpgsql as $$
declare m text;
begin
  begin
    execute sql;
  exception when others then
    m := sqlerrm;
    if m ~* pattern then return; end if;
    raise exception 'FALLITO: % (errore inatteso: %)', msg, m;
  end;
  raise exception 'FALLITO: % (nessun errore)', msg;
end $$;

-- numero di righe toccate da un update/delete
create or replace function t.rows_changed(sql text) returns integer language plpgsql as $$
declare n integer;
begin
  execute sql;
  get diagnostics n = row_count;
  return n;
end $$;

grant execute on all functions in schema t to anon, authenticated;
