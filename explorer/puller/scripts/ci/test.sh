#!/bin/bash

set -ex

TEST_RUNNER=$([ "$1" = "code-coverage" ] && echo "coverage run --append --source=puller,../common/symbol" || echo "python3")
PYTHONPATH=.:.. ${TEST_RUNNER} -m pytest --asyncio-mode=auto -v tests ../common/tests
