#!/bin/bash

set -ex

TEST_RUNNER=$([ "$1" = "code-coverage" ] && echo "coverage run --append --source=rest,../common/symbol" || echo "python3")
PYTHONPATH=.:..:../puller ${TEST_RUNNER} -m pytest --asyncio-mode=auto -v tests ../common/tests
