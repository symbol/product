#!/bin/bash

set -ex

TMPFILE=$(mktemp -u)
python -m vanity --patterns AAA,BBB
python -m vanity --blockchain symbol --network testnet --patterns AXE,AXA --max-offset=100 --format pretty
python -m vanity --blockchain nem --network mainnet --patterns AXE,AXA --format csv --suppress-console --out "${TMPFILE}"
cat "${TMPFILE}"
rm "${TMPFILE}"
