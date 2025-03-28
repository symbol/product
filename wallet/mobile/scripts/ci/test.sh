#!/bin/bash

set -ex

TEST_MODE=$([ "$1" = "code-coverage" ] && echo "test:cov" || echo "test")
npm run "${TEST_MODE}"
