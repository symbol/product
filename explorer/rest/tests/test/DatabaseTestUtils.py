from binascii import unhexlify
from collections import namedtuple

from rest.db.NemDatabase import NemDatabase

Block = namedtuple('Block', ['height', 'timestamp', 'total_fees', 'total_transactions', 'difficulty', 'block_hash', 'signer', 'signature'])
DatabaseConfig = namedtuple('DatabaseConfig', ['database', 'user', 'password', 'host', 'port'])

# region test data

BLOCKS = [
	Block(
		1,
		'2015-03-29 00:06:25',
		102000000,
		5,
		100000000000000,
		'438CF6375DAB5A0D32F9B7BF151D4539E00A590F7C022D5572C7D41815A24BE4',
		'8D07F90FB4BBE7715FA327C926770166A11BE2E494A970605F2E12557F66C9B9',
		'2ABDD19AD3EFAB0413B42772A586FAA19DEDB16D35F665F90D598046A2132C4A'
		'D1E71001545CEAA44E63C04345591E7AADBFD330AF82A0D8A1DA5643E791FF0F'),
	Block(
		2,
		'2015-03-29 20:34:19',
		201000000,
		3,
		80000000000000,
		'1DD9D4D7B6AF603D29C082F9AA4E123F07D18154DDBCD7DDC6702491B854C5E4',
		'F9BD190DD0C364261F5C8A74870CC7F7374E631352293C62ECC437657E5DE2CD',
		'1B81379847241E45DA86B27911E5C9A9192EC04F644D98019657D32838B49C14'
		'3EAA4815A3028B80F9AFFDBF0B94CD620F7A925E02783DDA67B8627B69DDF70E')
]

# endregion


def initialize_database(db_config):
	# Arrange + Act:
	with NemDatabase(db_config).connection() as connection:
		cursor = connection.cursor()

		# Create tables
		cursor.execute('''
			CREATE TABLE IF NOT EXISTS blocks (
				id serial NOT NULL PRIMARY KEY,
				height bigint NOT NULL,
				timestamp timestamp NOT NULL,
				totalFees bigint DEFAULT 0,
				totalTransactions int DEFAULT 0,
				difficulty bigInt NOT NULL,
				hash bytea NOT NULL,
				signer bytea NOT NULL,
				signature bytea NOT NULL
		)
		''')

		# Insert data
		for block in BLOCKS:
			cursor.execute(
				'''
				INSERT INTO blocks (height, timestamp, totalFees, totalTransactions, difficulty, hash, signer, signature)
				VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
				''', (
					block.height,
					block.timestamp,
					block.total_fees,
					block.total_transactions,
					block.difficulty,
					unhexlify(block.block_hash),
					unhexlify(block.signer),
					unhexlify(block.signature)
				)
			)

		connection.commit()
