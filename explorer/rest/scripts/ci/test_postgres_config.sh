#!/bin/bash

configure_test_postgres() {
	export EXPLORER_TEST_POSTGRES_HOST="${EXPLORER_TEST_POSTGRES_HOST:-127.0.0.1}"
	export EXPLORER_TEST_POSTGRES_PORT="${EXPLORER_TEST_POSTGRES_PORT:-5432}"
	export EXPLORER_TEST_POSTGRES_DATABASE="${EXPLORER_TEST_POSTGRES_DATABASE:-explorer_rest_test}"
	export EXPLORER_TEST_POSTGRES_USER="${EXPLORER_TEST_POSTGRES_USER:-postgres}"
}

check_test_postgres() {
	local -a command=(psql -w -h "${EXPLORER_TEST_POSTGRES_HOST}" -p "${EXPLORER_TEST_POSTGRES_PORT}"
		-U "${EXPLORER_TEST_POSTGRES_USER}" -d "${EXPLORER_TEST_POSTGRES_DATABASE}" -v ON_ERROR_STOP=1 -c 'SELECT 1')
	if command -v timeout >/dev/null 2>&1; then
		timeout -k 2s 30s "${command[@]}"
	else
		python3 -c 'import subprocess, sys
try:
    sys.exit(subprocess.run(sys.argv[1:], timeout=30, check=False).returncode)
except subprocess.TimeoutExpired:
    print("PostgreSQL test connection check timed out", file=sys.stderr)
    sys.exit(124)' "${command[@]}"
	fi
}
