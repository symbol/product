"""Explicitly upgrade existing Symbol account refresh tables."""
import argparse
from contextlib import closing

import psycopg2
from psycopg2 import sql

from puller.workflows.symbol_workflow_utils import read_migration_database_config

# Stop all Puller jobs before upgrading; operators own exclusion, and ALTER TABLE can block readers.
COLUMNS = (
	('symbol_account_refresh_state', (
		('previous_successful_run_id', 'varchar'),
		('running_run_id', 'varchar'),
		('is_retention_ready', 'boolean NOT NULL DEFAULT false'),
		('valid_run_id', 'varchar'),
		('height_ready_run_id', 'varchar')
	)),
	('symbol_account_refresh_accounts', (('address_height', 'bigint'),))
)


def main(argv=None, connection_factory=psycopg2.connect):
	"""Apply missing account refresh columns to the configured Symbol database."""
	parser = argparse.ArgumentParser(description=(
		'Stop all scheduled and manual Puller runs and wait for them to finish. Run this tool and confirm success; '
		'then start the new Puller, confirm a successful refresh published a valid height-ready generation, '
		'and deploy REST PR #2808. Operators must prevent overlapping Puller runs during migration.'
	))
	parser.add_argument('--db-config', required=True, help='INI file containing the symbol_db connection settings')
	database_config = read_migration_database_config(parser.parse_args(argv).db_config)

	# Upgrade both tables atomically, preserving generations and markers without backfilling old heights.
	with closing(connection_factory(**dict(database_config))) as connection:
		with connection:
			with connection.cursor() as cursor:
				for table, definitions in COLUMNS:
					cursor.execute('''
						SELECT namespace.nspname, ARRAY(
							SELECT attribute.attname::text FROM pg_catalog.pg_attribute AS attribute
							WHERE attribute.attrelid = relation.oid AND attribute.attnum > 0 AND NOT attribute.attisdropped
								AND attribute.attname = ANY(%s)
						)
						FROM pg_catalog.pg_class AS relation
						JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
						WHERE relation.oid = %s::pg_catalog.regclass
					''', ([name for name, _ in definitions], table))
					resolved_table = cursor.fetchone()  # Schema and columns belong to the same relation.
					missing = [(name, column_type) for name, column_type in definitions if name not in resolved_table[1]]
					if missing:
						additions = [
							sql.SQL('ADD COLUMN {} {}').format(sql.Identifier(name), sql.SQL(column_type))
							for name, column_type in missing
						]
						cursor.execute(sql.SQL('ALTER TABLE {} {}').format(sql.Identifier(resolved_table[0], table), sql.SQL(', ').join(additions)))


if __name__ == '__main__':  # pragma: no cover
	main()  # pragma: no cover
