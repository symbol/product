#!/bin/bash

set -ex

# will be enabled after the test PR is merged
#npm run test

cd ./client && npm run test
