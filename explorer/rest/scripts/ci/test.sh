#!/bin/bash

set -ex

if [ -n "${JENKINS_HOME:-}" ]; then
	export EXPLORER_TEST_POSTGRES_HOST="${EXPLORER_TEST_POSTGRES_HOST-127.0.0.1}"
	export EXPLORER_TEST_POSTGRES_PORT="${EXPLORER_TEST_POSTGRES_PORT-5432}"
	export EXPLORER_TEST_POSTGRES_DATABASE="${EXPLORER_TEST_POSTGRES_DATABASE-explorer_rest_test}"
	export EXPLORER_TEST_POSTGRES_USER="${EXPLORER_TEST_POSTGRES_USER-postgres}"
	if [ -z "${EXPLORER_TEST_POSTGRES_HOST}" ] || [ -z "${EXPLORER_TEST_POSTGRES_PORT}" ] \
		|| [ -z "${EXPLORER_TEST_POSTGRES_DATABASE}" ] || [ -z "${EXPLORER_TEST_POSTGRES_USER}" ]; then
		echo 'Jenkins PostgreSQL test configuration must not be empty' >&2
		exit 1
	fi
fi

if [ -n "${EXPLORER_TEST_POSTGRES_HOST:-}" ]; then
	psql -w -h "${EXPLORER_TEST_POSTGRES_HOST}" -p "${EXPLORER_TEST_POSTGRES_PORT-5432}" \
		-U "${EXPLORER_TEST_POSTGRES_USER-postgres}" -d "${EXPLORER_TEST_POSTGRES_DATABASE-postgres}" \
		-v ON_ERROR_STOP=1 -c "SELECT 1"
fi

TEST_RUNNER=$([ "$1" = "code-coverage" ] && echo "coverage run --append --source=rest,../common/symbol" || echo "python3")
PYTHONPATH=.:..:../puller ${TEST_RUNNER} -m pytest --asyncio-mode=auto -v tests ../common/tests
