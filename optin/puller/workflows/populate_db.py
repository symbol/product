import json
import sqlite3

from puller.db.CompletedOptinDatabase import CompletedOptinDatabase


def main():
	with sqlite3.connect('optin.db') as connection:
		db = CompletedOptinDatabase(connection)
		db.create_tables()

		with open('./resources/preoptin.json', 'rt', encoding='utf8') as infile:
			data = json.load(infile)

			db.insert_mappings_from_json(data)


if "__main__" == __name__:
	main()
