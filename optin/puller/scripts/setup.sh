#!/bin/bash

# can run script like:
# export $(cat ./scripts/testnet.env) && ./scripts/setup.sh

set -ex

mkdir -p "${DATABASE_DIRECTORY}"

echo "[POPULATE_DB] populating database with preoptin data from '${PREOPTIN_JSON}'"
echo

PYTHONPATH=. python3 workflows/populate_db.py \
	--database-directory "${DATABASE_DIRECTORY}" \
	--optin "${PREOPTIN_JSON}"

echo
echo "[GENERATE_POSTOPTIN] generating post optin json file '${POSTOPTIN_JSON}'"
echo

PYTHONPATH=. python3 workflows/generate_postoptin.py \
	--symbol-node "${SYMBOL_NODE}" \
	--output "${POSTOPTIN_JSON}" \
	--optin-signer-public-keys "${OPTIN_SIGNER_PUBLIC_KEYS}"

echo
echo "[POPULATE_DB] populating database with postoptin data from '${POSTOPTIN_JSON}'"
echo

PYTHONPATH=. python3 workflows/populate_db.py \
	--database-directory "${DATABASE_DIRECTORY}" \
	--optin "${POSTOPTIN_JSON}" \
	--post

echo
echo "[DOWNLOAD_POSTOPTIN] downloading post optin data from optin address '${OPTIN_ADDRESS}'"
echo

PYTHONPATH=. python3 workflows/download_postoptin.py \
	--nem-node "${NEM_NODE}" \
	--symbol-node "${SYMBOL_NODE}" \
	--database-directory "${DATABASE_DIRECTORY}" \
	--optin-address "${OPTIN_ADDRESS}" \
	--optin-signer-public-keys "${OPTIN_SIGNER_PUBLIC_KEYS}" \
	--snapshot-height "${SNAPSHOT_HEIGHT}"
