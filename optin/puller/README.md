## optin/puller order of workflows


* `workflows/populate_db` - populates data from `preoptin.json` to `optin.db`
* `workflows/download_postoptin` - downloads post optin data from optin address starting at snapshot height, saves in `in_progress.db`
* `workflows/get_account_states` - downloads snapshot balances of account inside `in_progress.db`
* `workflows/payout` - initiates payout (tbd)
