import unittest
from binascii import unhexlify
from collections import namedtuple

import testing.postgresql
from symbolchain.nem.Network import Address

from rest.db.NemDatabase import NemDatabase
from rest.model.Block import BlockView
from rest.model.Mosaic import MosaicView
from rest.model.Namespace import NamespaceView

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
Namespace = namedtuple(
	'Namespace',
	[
		'root_namespace',
		'owner',
		'registered_height',
		'expiration_height',
		'sub_namespaces'
	]
)
Mosaic = namedtuple(
	'Mosaic',
	[
		'root_namespace',
		'namespace_name',
		'description',
		'creator',
		'registered_height',
		'initial_supply',
		'total_supply',
		'divisibility',
		'supply_mutable',
		'transferable',
		'levy_type',
		'levy_namespace_name',
		'levy_fee',
		'levy_recipient'
	]
)

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

NAMESPACES = [
	Namespace(
		'oxford',
		'8D07F90FB4BBE7715FA327C926770166A11BE2E494A970605F2E12557F66C9B9',
		1,
		525601,
		'{oxford.union,oxford.branch.uk}'
	),
	Namespace(
		'dragon',
		'F9BD190DD0C364261F5C8A74870CC7F7374E631352293C62ECC437657E5DE2CD',
		2,
		525602,
		'{}'
	),
]

MOSAICS = [
	Mosaic(
		'dragon',
		'dragon.dragonfly',
		'sample information',
		'F9BD190DD0C364261F5C8A74870CC7F7374E631352293C62ECC437657E5DE2CD',
		2,
		100,
		100,
		0,
		False,
		True,
		2,
		'nem.xem',
		15000,
		'NALICEPFLZQRZGPRIJTMJOCPWDNECXTNNG7QLSG3'
	)
]

BLOCK_VIEWS = [
	BlockView(*BLOCKS[0]._replace(total_fees=102.0, signer=Address('NANEMOABLAGR72AZ2RV3V4ZHDCXW25XQ73O7OBT5'))),
	BlockView(*BLOCKS[1]._replace(total_fees=201.0, signer=Address('NALICEPFLZQRZGPRIJTMJOCPWDNECXTNNG7QLSG3')))
]

NAMESPACE_VIEWS = [
	NamespaceView(
		NAMESPACES[0].root_namespace,
		Address('NANEMOABLAGR72AZ2RV3V4ZHDCXW25XQ73O7OBT5'),
		NAMESPACES[0].registered_height,
		'2015-03-29 00:06:25',
		NAMESPACES[0].expiration_height,
		['oxford.union', 'oxford.branch.uk'],
		[]
	),
	NamespaceView(
		NAMESPACES[1].root_namespace,
		Address('NALICEPFLZQRZGPRIJTMJOCPWDNECXTNNG7QLSG3'),
		NAMESPACES[1].registered_height,
		'2015-03-29 20:34:19',
		NAMESPACES[1].expiration_height,
		[],
		[{
			'namespaceName': 'dragon',
			'mosaicName': 'dragonfly',
			'totalSupply': 100,
			'divisibility': 0,
			'registeredHeight': 2,
			'registeredTimestamp': '2015-03-29 20:34:19'
		}]
	)
]

MOSAIC_VIEWS = [
	MosaicView(
		'dragonfly',
		'dragon',
		MOSAICS[0].description,
		Address('NALICEPFLZQRZGPRIJTMJOCPWDNECXTNNG7QLSG3'),
		MOSAICS[0].registered_height,
		'2015-03-29 20:34:19',
		MOSAICS[0].initial_supply,
		MOSAICS[0].total_supply,
		MOSAICS[0].divisibility,
		MOSAICS[0].supply_mutable,
		MOSAICS[0].transferable,
		'percentile',
		'nem.xem',
		0.015,
		Address('NALICEPFLZQRZGPRIJTMJOCPWDNECXTNNG7QLSG3'),
		2,
		'2015-03-29 20:34:19',
		525602
	)
]

# endregion


def initialize_database(db_config, network_name):
	# Arrange + Act:
	with NemDatabase(db_config, network_name).connection() as connection:
		cursor = connection.cursor()

		# Create tables
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

		cursor.execute(
			'''
			CREATE TABLE IF NOT EXISTS namespaces (
				id serial PRIMARY KEY,
				root_namespace varchar(16),
				owner bytea NOT NULL,
				registered_height bigint NOT NULL,
				expiration_height bigint NOT NULL,
				sub_namespaces VARCHAR(146)[]
			)
			'''
		)

		cursor.execute(
			'''
			CREATE TABLE IF NOT EXISTS mosaics (
				id serial PRIMARY KEY,
				root_namespace varchar(16),
				namespace_name varchar(146),
				description varchar(512),
				creator bytea NOT NULL,
				registered_height bigint NOT NULL,
				initial_supply bigint DEFAULT 0,
				total_supply bigint DEFAULT 0,
				divisibility int NOT NULL,
				supply_mutable boolean DEFAULT false,
				transferable boolean DEFAULT false,
				levy_type int,
				levy_namespace_name varchar(146),
				levy_fee bigint DEFAULT 0,
				levy_recipient bytea
			)
			'''
		)

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

		for namespace in NAMESPACES:
			cursor.execute(
				'''
				INSERT INTO namespaces (root_namespace, owner, registered_height, expiration_height, sub_namespaces)
				VALUES (%s, %s, %s, %s, %s)
				''', (
					namespace.root_namespace,
					unhexlify(namespace.owner),
					namespace.registered_height,
					namespace.expiration_height,
					namespace.sub_namespaces
				)
			)

		for mosaic in MOSAICS:
			cursor.execute(
				'''
				INSERT INTO mosaics (
					root_namespace,
					namespace_name,
					description,
					creator,
					registered_height,
					initial_supply,
					total_supply,
					divisibility,
					supply_mutable,
					transferable,
					levy_type,
					levy_namespace_name,
					levy_fee,
					levy_recipient
				)
				VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
				''', (
					mosaic.root_namespace,
					mosaic.namespace_name,
					mosaic.description,
					unhexlify(mosaic.creator),
					mosaic.registered_height,
					mosaic.initial_supply,
					mosaic.total_supply,
					mosaic.divisibility,
					mosaic.supply_mutable,
					mosaic.transferable,
					mosaic.levy_type,
					mosaic.levy_namespace_name,
					mosaic.levy_fee,
					Address(mosaic.levy_recipient).bytes if mosaic.levy_recipient is not None else None,
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
