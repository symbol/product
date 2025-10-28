#!/bin/bash

set -ex

config="$1"
python3 -m workflows.download_balance_changes --config "${config}"
python3 -m workflows.download_wrap_requests --config "${config}"
python3 -m workflows.send_payouts --config "${config}"
python3 -m workflows.check_finalized_transactions --config "${config}"
