import argparse
import json
import sqlite3
from pathlib import Path

from puller.db.CompletedOptinDatabase import CompletedOptinDatabase


def main():
	parser = argparse.ArgumentParser(description='populate db with pre optin data')
	parser.add_argument('--database-directory', help='output database directory', default='_temp')
	parser.add_argument('--optin', help='optin json data', default='./resources/preoptin.json')
	parser.add_argument('--post', help='specify if file contains post optin data', action='store_true')
	args = parser.parse_args()

	with sqlite3.connect(Path(args.database_directory) / 'completed.db') as connection:
		database = CompletedOptinDatabase(connection)
		database.create_tables()

		with open(args.optin, 'rt', encoding='utf8') as infile:
			data = json.load(infile)
			count = sum(1 for _ in database.insert_mappings_from_json(data, args.post))
			print(f'inserted {count} mappings')


if '__main__' == __name__:
	main()
