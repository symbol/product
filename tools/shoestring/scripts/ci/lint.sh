#!/bin/bash

set -ex

# temporariliy disable TODO warnings
"$(git rev-parse --show-toplevel)/linters/python/lint.sh" "fixme"
