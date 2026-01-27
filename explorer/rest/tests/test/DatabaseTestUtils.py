import json
import unittest
from binascii import unhexlify
from collections import namedtuple

import testing.postgresql
from symbolchain.CryptoTypes import PublicKey
from symbolchain.nem.Network import Address

from rest.db.NemDatabase import NemDatabase
from rest.model.Account import AccountView
from rest.model.Block import BlockView

Block = namedtuple(
	'Block',
	[
		'height',
		'timestamp',
		'total_fees',
		'total_transactions',
		'difficulty',
		'block_hash',
		'signer',
		'signature',
		'size'
	]
)
Account = namedtuple('Account', [
	'address',
	'public_key',
	'remote_address',
	'importance',
	'balance',
	'vested_balance',
	'mosaics',
	'harvested_blocks',
	'status',
	'remote_status',
	'min_cosignatories',
	'cosignatory_of',
	'cosignatories'
])
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
		'D1E71001545CEAA44E63C04345591E7AADBFD330AF82A0D8A1DA5643E791FF0F',
		936),
	Block(
		2,
		'2015-03-29 20:34:19',
		201000000,
		3,
		80000000000000,
		'1DD9D4D7B6AF603D29C082F9AA4E123F07D18154DDBCD7DDC6702491B854C5E4',
		'F9BD190DD0C364261F5C8A74870CC7F7374E631352293C62ECC437657E5DE2CD',
		'1B81379847241E45DA86B27911E5C9A9192EC04F644D98019657D32838B49C14'
		'3EAA4815A3028B80F9AFFDBF0B94CD620F7A925E02783DDA67B8627B69DDF70E',
		752),
]

ACCOUNTS = [
	Account(
		Address('NAGHXD63C4V6REWGXCVKJ2SBS3GUAXGTRQZQXPRO'),
		PublicKey('b88221939ac920484753c738fafda87e82ff04b5e370c9456d85a0f12c6a5cca'),
		None,
		0.123456,
		1000000,
		99999,
		[{'quantity': 1000000, 'namespace': 'nem.xem'}],
		10,
		'LOCKED',
		'INACTIVE',
		None,
		None,
		None)
]

BLOCK_VIEWS = [
	BlockView(*BLOCKS[0]._replace(total_fees=102.0, signer=Address('NANEMOABLAGR72AZ2RV3V4ZHDCXW25XQ73O7OBT5'))),
	BlockView(*BLOCKS[1]._replace(total_fees=201.0, signer=Address('NALICEPFLZQRZGPRIJTMJOCPWDNECXTNNG7QLSG3')))
]

ACCOUNT_VIEWS = [
	AccountView(
		address=str(ACCOUNTS[0].address),
		public_key=str(ACCOUNTS[0].public_key) if ACCOUNTS[0].public_key else None,
		remote_address=None,
		importance=0.123456,
		balance=1.0,
		vested_balance=0.099999,
		mosaics=[{
			'namespace_name': 'nem.xem',
			'quantity': 1000000
		}],
		harvested_fees=0.0,
		harvested_blocks=ACCOUNTS[0].harvested_blocks,
		status=ACCOUNTS[0].status,
		remote_status=ACCOUNTS[0].remote_status,
		last_harvested_height=0,
		min_cosignatories=ACCOUNTS[0].min_cosignatories,
		cosignatory_of=ACCOUNTS[0].cosignatory_of,
		cosignatories=ACCOUNTS[0].cosignatories
	)
]

# endregion


#  pylint: disable=duplicate-code
def initialize_database(db_config, network_name):
	# Arrange + Act:
	with NemDatabase(db_config, network_name).connection() as connection:
		cursor = connection.cursor()

		# Create tables
		cursor.execute(
			'''
			CREATE TABLE IF NOT EXISTS accounts (
				id serial PRIMARY KEY,
				address bytea NOT NULL UNIQUE,
				public_key bytea,
				remote_address bytea,
				importance decimal(20, 10) DEFAULT 0,
				balance bigint DEFAULT 0,
				vested_balance bigint DEFAULT 0,
				mosaics jsonb DEFAULT '[]'::jsonb,
				harvested_fees bigint DEFAULT 0,
				harvested_blocks bigint DEFAULT 0,
				status varchar(8) DEFAULT NULL,
				remote_status varchar(12) DEFAULT NULL,
				last_harvested_height bigint DEFAULT 0,
				min_cosignatories int DEFAULT NULL,
				cosignatory_of bytea[] DEFAULT NULL,
				cosignatories bytea[] DEFAULT NULL,
				updated_at timestamp DEFAULT CURRENT_TIMESTAMP
			)
			'''
		)

		cursor.execute('''
			CREATE TABLE IF NOT EXISTS blocks (
				id serial NOT NULL PRIMARY KEY,
				height bigint NOT NULL,
				timestamp timestamp NOT NULL,
				total_fees bigint DEFAULT 0,
				total_transactions int DEFAULT 0,
				difficulty bigInt NOT NULL,
				hash bytea NOT NULL,
				signer bytea NOT NULL,
				signature bytea NOT NULL,
				size bigint DEFAULT 0
		)
		''')

		# Insert data
		for block in BLOCKS:
			cursor.execute(
				'''
				INSERT INTO blocks (height, timestamp, total_fees, total_transactions, difficulty, hash, signer, signature, size)
				VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
				''', (
					block.height,
					block.timestamp,
					block.total_fees,
					block.total_transactions,
					block.difficulty,
					unhexlify(block.block_hash),
					unhexlify(block.signer),
					unhexlify(block.signature),
					block.size
				)
			)

		for account in ACCOUNTS:
			cursor.execute(
				'''
				INSERT INTO accounts (
					address,
					public_key,
					remote_address,
					importance,
					balance,
					vested_balance,
					mosaics,
					harvested_blocks,
					status,
					remote_status,
					min_cosignatories,
					cosignatory_of,
					cosignatories
				)
				VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
				''', (
					account.address.bytes,
					account.public_key.bytes if account.public_key else None,
					account.remote_address.bytes if account.remote_address else None,
					account.importance,
					account.balance,
					account.vested_balance,
					json.dumps(account.mosaics),
					account.harvested_blocks,
					account.status,
					account.remote_status,
					account.min_cosignatories,
					[address.bytes for address in account.cosignatory_of] if account.cosignatory_of else None,
					[address.bytes for address in account.cosignatories] if account.cosignatories else None
				)
			)

		connection.commit()


class DatabaseTestBase(unittest.TestCase):

	def setUp(self):
		self.postgresql = testing.postgresql.Postgresql()
		self.db_config = DatabaseConfig(**self.postgresql.dsn(), password='')
		self.network_name = 'mainnet'
		initialize_database(self.db_config, self.network_name)

	def tearDown(self):
		self.postgresql.stop()
