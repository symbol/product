# Account refresh snapshot migration

## Purpose and scope

Upgrade an existing Symbol Puller database while preserving published account refresh state and snapshot generations. This additive migration covers `symbol_account_refresh_state` and `symbol_account_refresh_accounts`; it does not recreate the database or remove legacy indexes.

## Migration and availability

On a new database, the table definitions create the required columns. On an existing database, initialization checks the required columns and runs `ALTER TABLE` on a table only when one or more of its required columns are missing. Initialization can be repeated. In addition to the existing retention columns, the migration adds `valid_run_id` and `height_ready_run_id` to the state table and nullable `address_height` to the accounts table as needed.

The migration retains existing generations and publication information. It does not backfill heights for old generations or make them valid. A partially migrated state with `valid_run_id` but no `height_ready_run_id` retains its existing value and receives a NULL height-readiness marker; REST rejects that generation until a successful refresh publishes both markers for a new generation. Publication checks for missing heights before setting the published ID and both markers in one transaction. Rollback invalidates the published generation by clearing `valid_run_id`.

`ALTER TABLE` can conflict with existing readers. While a migration transaction holds its lock, reads of the affected table can wait until the transaction commits or rolls back. Before deployment, verify table ownership, the effective `lock_timeout`, long-running transactions, and the operational retry procedure after a migration failure. These production settings and procedures are not established by this document.

## Deployment order

1. Deploy the Puller and complete its migration on the existing database.
2. Confirm that a refresh completes successfully and publishes a valid, height-ready new generation.
3. Deploy the separate REST change in https://github.com/symbol/product/pull/2808.

The new REST code selects the added state columns and cannot read a pre-migration schema. A legacy generation whose required markers are absent after migration is not readable by the new REST code. Do not infer validity or synthesize old heights to make it readable; a successful refresh must publish a new generation first. For an already valid generation with matching markers, the REST change in #2808 applies its status and freshness checks: it accepts `healthy` or `refreshing` status only while the publication is fresh.
