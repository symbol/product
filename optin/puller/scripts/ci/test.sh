#!/bin/bash

set -ex

TEST_RUNNER=$([ "$1" = "code-coverage" ] && echo "coverage run" || echo "python3")
${TEST_RUNNER} -m pytest --asyncio-mode=auto -v
