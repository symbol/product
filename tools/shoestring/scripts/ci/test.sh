#!/bin/bash

set -ex

pushd .
cd ../../lightapi/python
./scripts/ci/setup_lint.sh
popd

TEST_RUNNER=$([ "$1" = "code-coverage" ] && echo "coverage run --append" || echo "python3")
PYTHONPATH=.:../../lightapi/python ${TEST_RUNNER} -m pytest --asyncio-mode=auto -v
