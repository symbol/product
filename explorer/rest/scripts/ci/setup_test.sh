#!/bin/bash

set -ex

export POSTGRES_DB="explorer_rest"
export POSTGRES_USER="postgres"
export POSTGRES_PASSWORD="testPassword"
export POSTGRES_HOST_AUTH_METHOD="password"
export PGDATA=/var/lib/postgresql/data/pgdata

initdb -U "${POSTGRES_USER}" -D "${PGDATA}"
pg_ctl start --wait
pg_ctl status

psql -U "${POSTGRES_USER}" --command "CREATE USER ubuntu WITH SUPERUSER PASSWORD 'ubuntu';"
