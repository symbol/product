#!/bin/bash

set -ex

if [ "$1" = "code-coverage" ];
then
    npm run test:jenkins:cov
    cd $(git rev-parse --show-toplevel)/explorer/frontend
    mkdir -p .nyc_output && cp ./coverage/coverage-final.json ./.nyc_output
else
    npm run test:jenkins
fi
