#!/bin/bash

set -ex

for variant in ${EXPLORER_VARIANTS:-nem symbol}; do
    rm -rf .next
    NEXT_PUBLIC_EXPLORER_VARIANT="${variant}" \
        PUBLIC_SYMBOL_MARKET_DATA_URL="https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=symbol" \
        npm run build
done
