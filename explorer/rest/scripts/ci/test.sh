#!/bin/bash

set -ex

TEST_RUNNER=$([ "$1" = "code-coverage" ] && echo "coverage run --append --source=rest,../common" || echo "python3")
PYTHONPATH=.:.. ${TEST_RUNNER} -m pytest --asyncio-mode=auto -v ../common/tests .
