#!/bin/bash

set -ex

# shellcheck source=scripts/ci/test_postgres_config.sh
source "$(dirname "$0")/test_postgres_config.sh"

if [ -z "${JENKINS_HOME:-}" ] && [ -z "${EXPLORER_TEST_POSTGRES_HOST:-}" ]; then
	exit 0
fi

is_external="${EXPLORER_TEST_POSTGRES_HOST:-}${EXPLORER_TEST_POSTGRES_PORT:-}${EXPLORER_TEST_POSTGRES_DATABASE:-}${EXPLORER_TEST_POSTGRES_USER:-}"
if [ -z "${JENKINS_HOME:-}" ]; then
	export EXPLORER_TEST_POSTGRES_DATABASE="${EXPLORER_TEST_POSTGRES_DATABASE:-postgres}"
fi
configure_test_postgres

if [ -z "${is_external}" ]; then
	export POSTGRES_DB="explorer_rest"
	export POSTGRES_USER="postgres"
	export POSTGRES_PASSWORD="testPassword"
	export POSTGRES_HOST_AUTH_METHOD="password"
	export PGDATA=/var/lib/postgresql/data/pgdata

	initdb -U "${POSTGRES_USER}" -D "${PGDATA}"
	pg_ctl start --wait
	pg_ctl status

	psql -w -h "${EXPLORER_TEST_POSTGRES_HOST}" -p "${EXPLORER_TEST_POSTGRES_PORT}" -U "${POSTGRES_USER}" \
		--command "CREATE USER ubuntu WITH SUPERUSER PASSWORD 'ubuntu';"

	createdb -w -h "${EXPLORER_TEST_POSTGRES_HOST}" -p "${EXPLORER_TEST_POSTGRES_PORT}" -U "${POSTGRES_USER}" \
		"${EXPLORER_TEST_POSTGRES_DATABASE}"
fi

check_test_postgres
