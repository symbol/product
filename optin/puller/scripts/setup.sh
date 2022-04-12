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

