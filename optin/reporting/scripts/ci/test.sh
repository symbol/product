#!/bin/bash

set -ex

TEST_MODE=$([ "$1" = "code-coverage" ] && echo "test:jenkins" || echo "test")
npm run "${TEST_MODE}"

cd ./client && npm run "${TEST_MODE}"

# copy client jest coverage json report to ../.nyc_output to merge client and server coverage
cd $(git rev-parse --show-toplevel)/optin/reporting
mkdir -p .nyc_output && cp ./client/coverage/coverage-final.json ./.nyc_output 2>/dev/null || :
