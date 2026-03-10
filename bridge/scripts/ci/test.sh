#!/bin/bash

set -ex

TEST_RUNNER=$([ "$1" = "code-coverage" ] && echo "coverage run --append" || echo "python3")
PYTHONPATH=. ${TEST_RUNNER} -m pytest --asyncio-mode=auto -v
