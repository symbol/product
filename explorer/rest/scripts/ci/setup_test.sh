#!/bin/bash

set -ex

# shellcheck source=scripts/ci/test_postgres_config.sh
source "$(dirname "$0")/test_postgres_config.sh"
configure_test_postgres

if [ "${EXPLORER_TEST_POSTGRES_SKIP_INIT:-}" != 1 ]; then
	if [ "${EXPLORER_TEST_POSTGRES_HOST}" != 127.0.0.1 ] || [ "${EXPLORER_TEST_POSTGRES_PORT}" != 5432 ]; then
		echo 'New PostgreSQL initialization requires host 127.0.0.1 and port 5432; set EXPLORER_TEST_POSTGRES_SKIP_INIT=1 to use an existing server.' >&2
		exit 1
	fi

	initdb -U "${EXPLORER_TEST_POSTGRES_USER}" -D "${PGDATA}"
	pg_ctl -o '-c listen_addresses=127.0.0.1 -p 5432' start --wait
	pg_ctl status

	if [ "${EXPLORER_TEST_POSTGRES_USER}" != ubuntu ]; then
		# Preserve the existing role corresponding to the CI OS user.
		psql -w -h "${EXPLORER_TEST_POSTGRES_HOST}" -p "${EXPLORER_TEST_POSTGRES_PORT}" -U "${EXPLORER_TEST_POSTGRES_USER}" -d postgres \
			--command "CREATE USER ubuntu WITH SUPERUSER PASSWORD 'ubuntu';"
	fi

	if [ "${EXPLORER_TEST_POSTGRES_DATABASE}" != postgres ]; then
		createdb -w -h "${EXPLORER_TEST_POSTGRES_HOST}" -p "${EXPLORER_TEST_POSTGRES_PORT}" -U "${EXPLORER_TEST_POSTGRES_USER}" \
			"${EXPLORER_TEST_POSTGRES_DATABASE}"
	fi
fi

PGCONNECT_TIMEOUT=3 PGOPTIONS='-c statement_timeout=5000' \
	psql -w -h "${EXPLORER_TEST_POSTGRES_HOST}" -p "${EXPLORER_TEST_POSTGRES_PORT}" \
	-U "${EXPLORER_TEST_POSTGRES_USER}" -d "${EXPLORER_TEST_POSTGRES_DATABASE}" -v ON_ERROR_STOP=1 -c 'SELECT 1'
