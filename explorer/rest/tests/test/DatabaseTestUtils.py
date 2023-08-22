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
		'438cf6375dab5a0d32f9b7bf151d4539e00a590f7c022d5572c7d41815a24be4',
		'8d07f90fb4bbe7715fa327c926770166a11be2e494a970605f2e12557f66c9b9',
		'2abdd19ad3efab0413b42772a586faa19dedb16d35f665f90d598046a2132c4a'
		'd1e71001545ceaa44e63c04345591e7aadbfd330af82a0d8a1da5643e791ff0f'),
	Block(
		2,
		'2015-03-29 20:34:19',
		201000000,
		3,
		80000000000000,
		'1dd9d4d7b6af603d29c082f9aa4e123f07d18154ddbcd7ddc6702491b854c5e4',
		'f9bd190dd0c364261f5c8a74870cc7f7374e631352293c62ecc437657e5de2cd',
		'1b81379847241e45da86b27911e5c9a9192ec04f644d98019657d32838b49c14'
		'3eaa4815a3028b80f9affdbf0b94cd620f7a925e02783dda67b8627b69ddf70e')
]

# endregion


def initialize_database(db_config):
	# Arrange + Act:
	with NemDatabase(db_config).connection() as connection:
		cursor = connection.cursor()

		# Create tables
		cursor.execute('''
			CREATE TABLE IF NOT EXISTS blocks (
				height bigint NOT NULL PRIMARY KEY,
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
				INSERT INTO blocks
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
