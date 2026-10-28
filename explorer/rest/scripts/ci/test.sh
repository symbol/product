#!/bin/bash

set -ex

# shellcheck source=scripts/ci/test_postgres_config.sh
source "$(dirname "$0")/test_postgres_config.sh"

if [ -n "${JENKINS_HOME:-}" ]; then
	configure_test_postgres
	check_test_postgres
elif [ -n "${EXPLORER_TEST_POSTGRES_HOST:-}" ]; then
	# Preserve standalone local preflight and the test helper's non-Jenkins defaults.
	export EXPLORER_TEST_POSTGRES_PORT="${EXPLORER_TEST_POSTGRES_PORT-5432}"
	export EXPLORER_TEST_POSTGRES_DATABASE="${EXPLORER_TEST_POSTGRES_DATABASE-postgres}"
	export EXPLORER_TEST_POSTGRES_USER="${EXPLORER_TEST_POSTGRES_USER-postgres}"
	check_test_postgres
fi

TEST_RUNNER=$([ "$1" = "code-coverage" ] && echo "coverage run --append --source=rest,../common/symbol" || echo "python3")
PYTHONPATH=.:..:../puller ${TEST_RUNNER} -m pytest --asyncio-mode=auto -v tests ../common/tests
