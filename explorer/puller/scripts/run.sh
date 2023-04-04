#!/bin/bash

# export $(cat ./scripts/mainnet.env) && ./scripts/run.sh

set -ex

echo
echo "Sync block with node: '${NEM_NODE}'"
echo

PYTHONPATH=. python3 workflows/sync_nem_block.py \
    --nem-node "${NEM_NODE}"
