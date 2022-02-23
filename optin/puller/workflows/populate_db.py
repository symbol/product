import argparse
import json
import sqlite3

from puller.db.CompletedOptinDatabase import CompletedOptinDatabase


def main():
	parser = argparse.ArgumentParser(description='populate db with pre optin data')
	parser.add_argument('--database', help='output database connection string', default='optin.db')
	parser.add_argument('--preoptin', help='pre optin json data', default='./resources/preoptin.json')
	args = parser.parse_args()

	with sqlite3.connect(args.database) as connection:
		db = CompletedOptinDatabase(connection)
		db.create_tables()

		with open(args.preoptin, 'rt', encoding='utf8') as infile:
			data = json.load(infile)

			db.insert_mappings_from_json(data)


if "__main__" == __name__:
	main()
