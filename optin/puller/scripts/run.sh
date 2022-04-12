#!/bin/bash

# can run script like:
# export $(cat ./scripts/testnet.env) && ./scripts/run.sh

set -ex

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

echo
echo "[DOWNLOAD_NEM_TIMESTAMPS] downloading nem block timestamps"
echo

PYTHONPATH=. python3 workflows/download_nem_timestamps.py \
	--nem-node "${NEM_NODE}" \
	--database-directory "${DATABASE_DIRECTORY}"

echo "[GET_ACCOUNT_STATES] populating database with account states from '${NEM_NODE}' at snapshot height ${SNAPSHOT_HEIGHT}"
echo

PYTHONPATH=. python3 workflows/get_account_states.py \
	--node "${NEM_NODE}" \
	--database-directory "${DATABASE_DIRECTORY}" \
	--snapshot-height "${SNAPSHOT_HEIGHT}"

echo
echo "[PROCESS_SENDS - DRY RUN] processing requests with SENT status"
echo

PYTHONPATH=. python3 -m workflows.process_sends \
	--symbol-node "${SYMBOL_NODE}" \
	--database-directory "${DATABASE_DIRECTORY}" \
	--network "${NETWORK_NAME}" \
	--dry-run

echo
read -r -e -p "[PROCESS_SENDS] Continue and commit (y/n)? " USER_CONTINUE_ANSWER
if [[ "y" != "${USER_CONTINUE_ANSWER}" ]]; then
	exit 1
fi

echo
echo "[PROCESS_SENDS] processing requests with SENT status"
echo

PYTHONPATH=. python3 -m workflows.process_sends \
	--symbol-node "${SYMBOL_NODE}" \
	--database-directory "${DATABASE_DIRECTORY}" \
	--network "${NETWORK_NAME}"

echo
echo "[PAYOUT] processing requests with UNPROCESSED status"
echo

PYTHONPATH=. python3 -m workflows.payout \
	--symbol-node "${SYMBOL_NODE}" \
	--database-directory "${DATABASE_DIRECTORY}" \
	--network "${NETWORK_NAME}" \
	--hot "${HOT_WALLET_PATH}"
