#!/usr/bin/env bash
# Prova schema e regole di sicurezza su un Postgres vero e temporaneo.
# Serve Postgres 14+ installato (initdb, pg_ctl, psql). Da root usa l'utente "postgres".
set -euo pipefail
cd "$(dirname "$0")/../.."

PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
[ -x "$PGBIN/initdb" ] || PGBIN="$(dirname "$(command -v initdb)")"
DATA="${TMPDIR:-/tmp}/dg-pg-$$"
SOCK="$DATA/sock"
PORT=55432
ROOT="$PWD"

if [ "$(id -u)" = "0" ]; then RUN=(runuser -u postgres --); else RUN=(env); fi

mkdir -p "$DATA" "$SOCK"
if [ "$(id -u)" = "0" ]; then chown -R postgres "$DATA"; chmod a+rx "$ROOT" 2>/dev/null || true; fi
cleanup() { "${RUN[@]}" "$PGBIN/pg_ctl" -D "$DATA/db" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DATA"; }
trap cleanup EXIT

"${RUN[@]}" "$PGBIN/initdb" -D "$DATA/db" -A trust -U postgres >/dev/null
"${RUN[@]}" "$PGBIN/pg_ctl" -D "$DATA/db" -o "-p $PORT -k $SOCK -c listen_addresses=''" -w -l "$DATA/log" start >/dev/null
PSQL=("${RUN[@]}" "$PGBIN/psql" -h "$SOCK" -p $PORT -U postgres -v ON_ERROR_STOP=1 -q)

"${PSQL[@]}" -d postgres -c "create database dg" >/dev/null
for f in tests/sql/bootstrap.sql supabase/schema.sql supabase/seed.sql; do
  echo "› $f"
  cat "$f" | "${PSQL[@]}" -d dg -f - >/dev/null
done
echo "› schema rieseguito (deve essere idempotente)"
cat supabase/schema.sql | "${PSQL[@]}" -d dg -f - >/dev/null
echo "› tests/sql/test.sql"
cat tests/sql/helpers.sql tests/sql/test.sql | "${PSQL[@]}" -o /dev/null -d dg -f -
echo "› parità con il calcolo TypeScript"
node --import tsx tests/sql/gen-parity.ts | "${PSQL[@]}" -o /dev/null -d dg -f -
echo "SQL: tutti i test passati"
