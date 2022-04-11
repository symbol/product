#!/bin/bash

# can run script like:
# export $(cat ./scripts/testnet.env) && ./scripts/setup.sh

set -ex

mkdir -p "${DATABASE_DIRECTORY}"

echo "[POPULATE_DB] populating database with preoptin data from 'resources/preoptin.${NETWORK_NAME}.json'"
echo

PYTHONPATH=. python3 workflows/populate_db.py \
	--database-directory "${DATABASE_DIRECTORY}" \
	--optin "resources/preoptin.${NETWORK_NAME}.json"

echo "[POPULATE_LABELS] populating database with NEM account labels from 'resources/nem_account_labels.${NETWORK_NAME}.csv'"
echo

PYTHONPATH=. python3 workflows/populate_labels.py \
	--database-directory "${DATABASE_DIRECTORY}" \
	--labels "resources/nem_account_labels.${NETWORK_NAME}.csv"

echo
echo "[GENERATE_POSTOPTIN] generating post optin json file 'resources/postoptin.${NETWORK_NAME}.json'"
echo

PYTHONPATH=. python3 workflows/generate_postoptin.py \
	--symbol-node "${SYMBOL_NODE}" \
	--output "resources/postoptin.${NETWORK_NAME}.json" \
	--payout-signer-public-keys "${OPTIN_SIGNER_PUBLIC_KEYS}"

echo
echo "[POPULATE_DB] populating database with postoptin data from 'resources/postoptin.${NETWORK_NAME}.json'"
echo

PYTHONPATH=. python3 workflows/populate_db.py \
	--database-directory "${DATABASE_DIRECTORY}" \
	--optin "resources/postoptin.${NETWORK_NAME}.json" \
	--post

echo
echo "[DOWNLOAD_POSTOPTIN] downloading post optin data from optin address '${OPTIN_ADDRESS}'"
echo

PYTHONPATH=. python3 workflows/download_postoptin.py \
	--nem-node "${NEM_NODE}" \
	--symbol-node "${SYMBOL_NODE}" \
	--database-directory "${DATABASE_DIRECTORY}" \
	--optin-address "${OPTIN_ADDRESS}" \
	--payout-signer-public-keys "${OPTIN_SIGNER_PUBLIC_KEYS}" \
	--snapshot-height "${SNAPSHOT_HEIGHT}"
