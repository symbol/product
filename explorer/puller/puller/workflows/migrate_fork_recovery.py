"""Records the legacy Symbol recovery gate while Puller jobs are stopped."""
import argparse
from types import SimpleNamespace

from puller.db.SymbolDatabase import SymbolDatabase
from puller.workflows.symbol_workflow_utils import read_migration_database_config


def main(argv=None, *, database_factory=SymbolDatabase):
	"""Prepare an existing Symbol database for verified fork recovery."""

	parser = argparse.ArgumentParser(description=(
		'Stop all scheduled and manual Symbol Puller jobs and wait for them to finish before migrating.'
	))
	parser.add_argument('--db-config', required=True, help='INI file containing the symbol_db connection settings')
	database_config = read_migration_database_config(parser.parse_args(argv).db_config)

	with database_factory(SimpleNamespace(**database_config)) as database:
		with database.workflow_lock():
			database.initialize_fork_recovery()


if __name__ == '__main__':  # pragma: no cover
	main()  # pragma: no cover
