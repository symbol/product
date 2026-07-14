#!/bin/bash

set -ex

for variant in ${EXPLORER_VARIANTS:-nem symbol}; do
    rm -rf .next
    NEXT_PUBLIC_EXPLORER_VARIANT="${variant}" npm run build
done
