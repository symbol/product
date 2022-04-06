import argparse
import csv
import sqlite3
from pathlib import Path

from symbolchain.nem.Network import Address

from puller.db.CompletedOptinDatabase import CompletedOptinDatabase


def main():
	parser = argparse.ArgumentParser(description='populates NEM account labels table')
	parser.add_argument('--database-directory', help='output database directory', default='_temp')
	parser.add_argument('--labels', help='csv containing account labels', default='./resources/nem_account_labels.mainnet.csv')
	args = parser.parse_args()

	with sqlite3.connect(Path(args.database_directory) / 'completed.db') as connection:
		database = CompletedOptinDatabase(connection)
		database.create_tables()

		print(f'processing labels from {args.labels}')

		with open(args.labels, 'rt', encoding='utf8') as infile:
			csv_reader = csv.DictReader(infile)

			for row in csv_reader:
				database.set_label(Address(row['NEM Address']), row['Label'])


if '__main__' == __name__:
	main()
