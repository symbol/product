#!/bin/bash

set -ex

for variant in ${EXPLORER_VARIANTS:-nem symbol}; do
	rm -rf .next
	npm run "build:${variant}"
done
