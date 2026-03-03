#!/bin/bash

set -ex

TEST_MODE=$([ "$1" = "code-coverage" ] && echo "test:cov:ci" || echo "test")
npm run "${TEST_MODE}"
