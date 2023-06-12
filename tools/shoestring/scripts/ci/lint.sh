#!/bin/bash

set -ex

# temporariliy disable TODO warnings and lightapi warnings
"$(git rev-parse --show-toplevel)/linters/python/lint.sh" "fixme,no-name-in-module,no-member"
