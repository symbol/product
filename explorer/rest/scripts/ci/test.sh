#!/bin/bash

set -ex

# shellcheck source=scripts/ci/test_postgres_config.sh
source "$(dirname "$0")/test_postgres_config.sh"
configure_test_postgres

TEST_RUNNER=$([ "$1" = "code-coverage" ] && echo "coverage run --append --source=rest,../common/symbol" || echo "python3")
PYTHONPATH=.:..:../puller ${TEST_RUNNER} -m pytest --asyncio-mode=auto -v tests ../common/tests
