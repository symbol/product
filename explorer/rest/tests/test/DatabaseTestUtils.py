# pylint: disable=too-many-lines
import json
import unittest
from binascii import unhexlify
from collections import namedtuple

import testing.postgresql
from symbolchain.CryptoTypes import PublicKey
from symbolchain.nem.Network import Address, Network

from rest.db.NemDatabase import NemDatabase
from rest.model.Account import AccountView
from rest.model.Block import BlockView
from rest.model.Mosaic import MosaicRichListView, MosaicView
from rest.model.Namespace import NamespaceView
from rest.model.Statistic import StatisticAccountView
from rest.model.Transaction import TransactionView

Block = namedtuple(
	'Block',
	[
		'height',
		'timestamp',
		'total_fee',
		'total_transactions',
		'difficulty',
		'block_hash',
		'beneficiary',
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
Namespace = namedtuple('Namespace', [
	'root_namespace',
	'owner',
	'registered_height',
	'expiration_height',
	'sub_namespaces'
])
Mosaic = namedtuple('Mosaic', [
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
])
AddressRemarks = namedtuple('Address_Remarks', ['address', 'remarks'])
Transaction = namedtuple('Transaction', [
	'transaction_hash',
	'height',
	'sender_public_key',
	'fee',
	'timestamp',
	'deadline',
	'signature',
	'amount',
	'transaction_type',
	'is_inner',
	'sender_address',
	'recipient_address',
	'payload'
])
TransactionMosaic = namedtuple('Transaction_Mosaic', [
	'transaction_id',
	'namespace_name',
	'quantity'
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
		Address('NANEMOABLAGR72AZ2RV3V4ZHDCXW25XQ73O7OBT5'),
		PublicKey('8D07F90FB4BBE7715FA327C926770166A11BE2E494A970605F2E12557F66C9B9'),
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
		Address('NALICEPFLZQRZGPRIJTMJOCPWDNECXTNNG7QLSG3'),
		PublicKey('F9BD190DD0C364261F5C8A74870CC7F7374E631352293C62ECC437657E5DE2CD'),
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
		[{'quantity': 1000000, 'namespace': 'nem.xem'}, {'quantity': 10, 'namespace': 'root.mosaic'}],
		10,
		'LOCKED',
		'INACTIVE',
		None,
		None,
		None),
	Account(
		Address('NBFWZ4IVRHEIBRCGHLYDS62FSFTBM3VDFA7E6LSQ'),
		PublicKey('a5f06d59b97aa40c82afb941a61fb6483bdb7491805cdb9dc47d92136983b9a5'),
		None,
		0.123456,
		3000000,
		99999,
		[{'quantity': 3000000, 'namespace': 'nem.xem'}, {'quantity': 15, 'namespace': 'root.mosaic'}],
		15,
		'LOCKED',
		'ACTIVE',
		None,
		None,
		None)
]

NAMESPACES = [
	Namespace(
		'nem',
		PublicKey('a5f06d59b97aa40c82afb941a61fb6483bdb7491805cdb9dc47d92136983b9a5'),
		1,
		0,
		['nem.xem']
	),
	Namespace(
		'root',
		PublicKey('a5f06d59b97aa40c82afb941a61fb6483bdb7491805cdb9dc47d92136983b9a5'),
		2,
		525700,
		[]
	),
	Namespace(
		'root_sub',
		PublicKey('a5f06d59b97aa40c82afb941a61fb6483bdb7491805cdb9dc47d92136983b9a5'),
		2,
		525800,
		['root_sub.sub_1', 'root_sub.sub_2']
	),
]

MOSAICS = [
	Mosaic(
		'nem',
		'nem.xem',
		'network currency',
		PublicKey('a5f06d59b97aa40c82afb941a61fb6483bdb7491805cdb9dc47d92136983b9a5'),
		1,
		8999999999000000,
		8999999999000000,
		6,
		False,
		True,
		None,
		None,
		None,
		None
	),
	Mosaic(
		'root',
		'root.mosaic',
		'Test mosaic',
		PublicKey('a5f06d59b97aa40c82afb941a61fb6483bdb7491805cdb9dc47d92136983b9a5'),
		2,
		1000000,
		1000000,
		0,
		False,
		True,
		1,
		'root.levy_mosaic',
		1000000,
		Address('NBFWZ4IVRHEIBRCGHLYDS62FSFTBM3VDFA7E6LSQ')
	),
	Mosaic(
		'root',
		'root.levy_mosaic',
		'Test levy mosaic',
		PublicKey('a5f06d59b97aa40c82afb941a61fb6483bdb7491805cdb9dc47d92136983b9a5'),
		2,
		20000000,
		20000000,
		6,
		False,
		True,
		None,
		None,
		None,
		None
	),
]

ADDRESS_REMARKS = [
	AddressRemarks(
		Address('NAGHXD63C4V6REWGXCVKJ2SBS3GUAXGTRQZQXPRO'),
		'Test remark A'
	),
	AddressRemarks(
		Address('NBFWZ4IVRHEIBRCGHLYDS62FSFTBM3VDFA7E6LSQ'),
		'Test remark B'
	)
]

TRANSACTIONS = [
	Transaction(  # Transfer transaction v1
		transaction_hash='0' * 63 + '1',
		height=2,
		sender_public_key=PublicKey('f9bd190dd0c364261f5c8a74870cc7f7374e631352293c62ecc437657e5de2cd'),
		fee=150000,
		timestamp='2015-03-29 00:06:25',
		deadline='2015-03-29 20:34:19',
		amount=5000000,
		signature='0' * 128,
		transaction_type=257,
		is_inner=False,
		sender_address=Address('NAGHXD63C4V6REWGXCVKJ2SBS3GUAXGTRQZQXPRO'),
		recipient_address=Address('NBFWZ4IVRHEIBRCGHLYDS62FSFTBM3VDFA7E6LSQ'),
		payload={
			'message': None
		}
	),
	Transaction(  # Transfer transaction v2
		transaction_hash='0' * 63 + '2',
		height=2,
		sender_public_key=PublicKey('f9bd190dd0c364261f5c8a74870cc7f7374e631352293c62ecc437657e5de2cd'),
		fee=150000,
		timestamp='2015-03-29 00:06:25',
		deadline='2015-03-29 20:34:19',
		amount=2000000,
		signature='0' * 128,
		transaction_type=257,
		is_inner=False,
		sender_address=Address('NAGHXD63C4V6REWGXCVKJ2SBS3GUAXGTRQZQXPRO'),
		recipient_address=Address('NBFWZ4IVRHEIBRCGHLYDS62FSFTBM3VDFA7E6LSQ'),
		payload={
			'message': {
				'payload': 'Test message',
				'is_plain': 1
			}
		}
	),
	Transaction(  # Account Link
		transaction_hash='0' * 63 + '3',
		height=2,
		sender_public_key=PublicKey('f9bd190dd0c364261f5c8a74870cc7f7374e631352293c62ecc437657e5de2cd'),
		fee=150000,
		timestamp='2015-03-29 00:06:25',
		deadline='2015-03-29 20:34:19',
		amount=None,
		signature='0' * 128,
		transaction_type=2049,
		is_inner=False,
		sender_address=Address('NAGHXD63C4V6REWGXCVKJ2SBS3GUAXGTRQZQXPRO'),
		recipient_address=None,
		payload={
			'mode': 1,
			'remote_account': 'a5f06d59b97aa40c82afb941a61fb6483bdb7491805cdb9dc47d92136983b9a5'
		}
	),
	Transaction(  # Multisig account modification
		transaction_hash='0' * 63 + '4',
		height=2,
		sender_public_key=PublicKey('f9bd190dd0c364261f5c8a74870cc7f7374e631352293c62ecc437657e5de2cd'),
		fee=150000,
		timestamp='2015-03-29 00:06:25',
		deadline='2015-03-29 20:34:19',
		amount=None,
		signature='0' * 128,
		transaction_type=4097,
		is_inner=False,
		sender_address=Address('NAGHXD63C4V6REWGXCVKJ2SBS3GUAXGTRQZQXPRO'),
		recipient_address=None,
		payload={
			'min_cosignatories': 1,
			'modifications': [
				{
					'modification_type': 0,
					'cosignatory_account': 'a5f06d59b97aa40c82afb941a61fb6483bdb7491805cdb9dc47d92136983b9a5'
				}
			]
		}
	),
	Transaction(  # Multisig transaction
		transaction_hash='0' * 63 + '5',
		height=2,
		sender_public_key=PublicKey('f9bd190dd0c364261f5c8a74870cc7f7374e631352293c62ecc437657e5de2cd'),
		fee=150000,
		timestamp='2015-03-29 00:06:25',
		deadline='2015-03-29 20:34:19',
		amount=None,
		signature='0' * 128,
		transaction_type=4100,
		is_inner=False,
		sender_address=Address('NAGHXD63C4V6REWGXCVKJ2SBS3GUAXGTRQZQXPRO'),
		recipient_address=None,
		payload={
			'inner_hash': '0' * 63 + '6',
			'signatures': [
				{
					'transaction_type': 4098,
					'timestamp': '2015-03-29 00:06:25',
					'deadline': '2015-03-29 20:34:19',
					'fee': 150000,
					'other_hash': '0' * 63 + '6',
					'other_account': 'a5f06d59b97aa40c82afb941a61fb6483bdb7491805cdb9dc47d92136983b9a5',
					'sender': '8D07F90FB4BBE7715FA327C926770166A11BE2E494A970605F2E12557F66C9B9',
					'signature': '0' * 128
				}
			]
		}
	),
	Transaction(  # inner Transfer transaction
		transaction_hash='0' * 63 + '6',
		height=2,
		sender_public_key=PublicKey('f9bd190dd0c364261f5c8a74870cc7f7374e631352293c62ecc437657e5de2cd'),
		fee=150000,
		timestamp='2015-03-29 00:06:25',
		deadline='2015-03-29 20:34:19',
		amount=5000000,
		signature='0' * 128,
		transaction_type=257,
		is_inner=True,
		sender_address=Address('NAGHXD63C4V6REWGXCVKJ2SBS3GUAXGTRQZQXPRO'),
		recipient_address=Address('NBFWZ4IVRHEIBRCGHLYDS62FSFTBM3VDFA7E6LSQ'),
		payload={
			'message': None
		}
	),
	Transaction(  # Namespace registration
		transaction_hash='0' * 63 + '7',
		height=2,
		sender_public_key=PublicKey('f9bd190dd0c364261f5c8a74870cc7f7374e631352293c62ecc437657e5de2cd'),
		fee=150000,
		timestamp='2015-03-29 00:06:25',
		deadline='2015-03-29 20:34:19',
		amount=None,
		signature='0' * 128,
		transaction_type=8193,
		is_inner=False,
		sender_address=Address('NAGHXD63C4V6REWGXCVKJ2SBS3GUAXGTRQZQXPRO'),
		recipient_address=Address('NBFWZ4IVRHEIBRCGHLYDS62FSFTBM3VDFA7E6LSQ'),
		payload={
			'rental_fee': 100000000,
			'parent': 'test',
			'namespace': 'namespace'
		}
	),
	Transaction(  # Mosaic definition
		transaction_hash='0' * 63 + '8',
		height=2,
		sender_public_key=PublicKey('f9bd190dd0c364261f5c8a74870cc7f7374e631352293c62ecc437657e5de2cd'),
		fee=150000,
		timestamp='2015-03-29 00:06:25',
		deadline='2015-03-29 20:34:19',
		amount=None,
		signature='0' * 128,
		transaction_type=16385,
		is_inner=False,
		sender_address=Address('NAGHXD63C4V6REWGXCVKJ2SBS3GUAXGTRQZQXPRO'),
		recipient_address=Address('NBFWZ4IVRHEIBRCGHLYDS62FSFTBM3VDFA7E6LSQ'),
		payload={
			'creation_fee': 200000000,
			'creator': 'f9bd190dd0c364261f5c8a74870cc7f7374e631352293c62ecc437657e5de2cd',
			'description': 'Test mosaic',
			'namespace_name': 'root.mosaic',
			'mosaic_properties': {
				'divisibility': 0,
				'initial_supply': 1000000,
				'supply_mutable': False,
				'transferable': True
			},
			'levy': {
				'type': 1,
				'fee': 1000000,
				'recipient': 'NAGHXD63C4V6REWGXCVKJ2SBS3GUAXGTRQZQXPRO',
				'namespace_name': 'nem.xem'
			}
		}
	),
	Transaction(  # Mosaic supply change
		transaction_hash='0' * 63 + '9',
		height=2,
		sender_public_key=PublicKey('f9bd190dd0c364261f5c8a74870cc7f7374e631352293c62ecc437657e5de2cd'),
		fee=150000,
		timestamp='2015-03-29 00:06:25',
		deadline='2015-03-29 20:34:19',
		amount=None,
		signature='0' * 128,
		transaction_type=16386,
		is_inner=False,
		sender_address=Address('NAGHXD63C4V6REWGXCVKJ2SBS3GUAXGTRQZQXPRO'),
		recipient_address=None,
		payload={
			'namespace_name': 'root.mosaic',
			'supply_type': 1,
			'delta': 1000000
		}
	)
]

TRANSACTIONS_MOSAIC = [
	TransactionMosaic(  # use for transaction v2
		transaction_id=2,
		namespace_name='nem.xem',
		quantity=2000000
	),
	TransactionMosaic(
		transaction_id=2,
		namespace_name='root.mosaic',
		quantity=2000000
	)
]

BLOCK_VIEWS = [
	BlockView(*BLOCKS[0]._replace(
		total_fee=102.0,
		beneficiary='NANEMOABLAGR72AZ2RV3V4ZHDCXW25XQ73O7OBT5',
		signer='NANEMOABLAGR72AZ2RV3V4ZHDCXW25XQ73O7OBT5')
	),
	BlockView(*BLOCKS[1]._replace(
		total_fee=201.0,
		beneficiary='NALICEPFLZQRZGPRIJTMJOCPWDNECXTNNG7QLSG3',
		signer='NALICEPFLZQRZGPRIJTMJOCPWDNECXTNNG7QLSG3')
	)
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
		}, {
			'namespace_name': 'root.mosaic',
			'quantity': 10
		}],
		harvested_fees=0.0,
		harvested_blocks=ACCOUNTS[0].harvested_blocks,
		status=ACCOUNTS[0].status,
		remote_status=ACCOUNTS[0].remote_status,
		last_harvested_height=0,
		min_cosignatories=ACCOUNTS[0].min_cosignatories,
		cosignatory_of=ACCOUNTS[0].cosignatory_of,
		cosignatories=ACCOUNTS[0].cosignatories
	),
	AccountView(
		address=str(ACCOUNTS[1].address),
		public_key=str(ACCOUNTS[1].public_key) if ACCOUNTS[1].public_key else None,
		remote_address=None,
		importance=0.123456,
		balance=3.0,
		vested_balance=0.099999,
		mosaics=[{
			'namespace_name': 'nem.xem',
			'quantity': 3000000
		}, {
			'namespace_name': 'root.mosaic',
			'quantity': 15
		}],
		harvested_fees=0.0,
		harvested_blocks=ACCOUNTS[1].harvested_blocks,
		status=ACCOUNTS[1].status,
		remote_status=ACCOUNTS[1].remote_status,
		last_harvested_height=0,
		min_cosignatories=ACCOUNTS[1].min_cosignatories,
		cosignatory_of=ACCOUNTS[1].cosignatory_of,
		cosignatories=ACCOUNTS[1].cosignatories
	)
]

ACCOUNT_STATISTIC_VIEW = StatisticAccountView(
	total_accounts=2,
	accounts_with_balance=2,
	harvested_accounts=2,
	total_importance=0.2469120000,
	eligible_harvest_accounts=2
)

NAMESPACE_VIEWS = [
	NamespaceView(
		root_namespace=NAMESPACES[0].root_namespace,
		owner=str(NAMESPACES[0].owner),
		registered_height=NAMESPACES[0].registered_height,
		registered_timestamp=BLOCKS[0].timestamp,
		expiration_height=NAMESPACES[0].expiration_height,
		sub_namespaces=NAMESPACES[0].sub_namespaces
	),
	NamespaceView(
		root_namespace=NAMESPACES[1].root_namespace,
		owner=str(NAMESPACES[1].owner),
		registered_height=NAMESPACES[1].registered_height,
		registered_timestamp=BLOCKS[1].timestamp,
		expiration_height=NAMESPACES[1].expiration_height,
		sub_namespaces=NAMESPACES[1].sub_namespaces
	),
	NamespaceView(
		root_namespace=NAMESPACES[2].root_namespace,
		owner=str(NAMESPACES[2].owner),
		registered_height=NAMESPACES[2].registered_height,
		registered_timestamp=BLOCKS[1].timestamp,
		expiration_height=NAMESPACES[2].expiration_height,
		sub_namespaces=NAMESPACES[2].sub_namespaces
	)
]

MOSAIC_VIEWS = [
	MosaicView(
		namespace_name=MOSAICS[0].namespace_name,
		description=MOSAICS[0].description,
		creator='NBFWZ4IVRHEIBRCGHLYDS62FSFTBM3VDFA7E6LSQ',
		mosaic_registered_height=MOSAICS[0].registered_height,
		mosaic_registered_timestamp=BLOCKS[0].timestamp,
		initial_supply=MOSAICS[0].initial_supply,
		total_supply=MOSAICS[0].total_supply,
		divisibility=MOSAICS[0].divisibility,
		supply_mutable=MOSAICS[0].supply_mutable,
		transferable=MOSAICS[0].transferable,
		levy_type=None,
		levy_namespace_name=None,
		levy_fee=None,
		levy_recipient=None,
		root_namespace_registered_height=NAMESPACES[0].registered_height,
		root_namespace_registered_timestamp=BLOCKS[0].timestamp,
		root_namespace_expiration_height=NAMESPACES[0].expiration_height
	),
	MosaicView(
		namespace_name=MOSAICS[1].namespace_name,
		description=MOSAICS[1].description,
		creator='NBFWZ4IVRHEIBRCGHLYDS62FSFTBM3VDFA7E6LSQ',
		mosaic_registered_height=MOSAICS[1].registered_height,
		mosaic_registered_timestamp=BLOCKS[1].timestamp,
		initial_supply=MOSAICS[1].initial_supply,
		total_supply=MOSAICS[1].total_supply,
		divisibility=MOSAICS[1].divisibility,
		supply_mutable=MOSAICS[1].supply_mutable,
		transferable=MOSAICS[1].transferable,
		levy_type='absolute fee',
		levy_namespace_name=MOSAICS[1].levy_namespace_name,
		levy_fee=1.0,
		levy_recipient='NBFWZ4IVRHEIBRCGHLYDS62FSFTBM3VDFA7E6LSQ',
		root_namespace_registered_height=NAMESPACES[1].registered_height,
		root_namespace_registered_timestamp=BLOCKS[1].timestamp,
		root_namespace_expiration_height=NAMESPACES[1].expiration_height
	),
	MosaicView(
		namespace_name=MOSAICS[2].namespace_name,
		description=MOSAICS[2].description,
		creator='NBFWZ4IVRHEIBRCGHLYDS62FSFTBM3VDFA7E6LSQ',
		mosaic_registered_height=MOSAICS[2].registered_height,
		mosaic_registered_timestamp=BLOCKS[1].timestamp,
		initial_supply=MOSAICS[2].initial_supply,
		total_supply=MOSAICS[2].total_supply,
		divisibility=MOSAICS[2].divisibility,
		supply_mutable=MOSAICS[2].supply_mutable,
		transferable=MOSAICS[2].transferable,
		levy_type=None,
		levy_namespace_name=None,
		levy_fee=None,
		levy_recipient=None,
		root_namespace_registered_height=NAMESPACES[1].registered_height,
		root_namespace_registered_timestamp=BLOCKS[1].timestamp,
		root_namespace_expiration_height=NAMESPACES[1].expiration_height
	)
]

MOSAIC_RICH_LIST_VIEWS = [
	MosaicRichListView(
		address=str(ACCOUNTS[0].address),
		remark='Test remark A',
		balance=1.0
	),
	MosaicRichListView(
		address=str(ACCOUNTS[1].address),
		remark='Test remark B',
		balance=3.0
	)
]

TRANSACTIONS_VIEWS = [
	TransactionView(
		transaction_hash='0' * 63 + '1',
		transaction_type='TRANSFER',
		from_address=str(TRANSACTIONS[0].sender_address),
		to_address=str(TRANSACTIONS[0].recipient_address),
		value=[
			{
				'namespace': 'nem.xem',
				'amount': 5.0
			}
		],
		embedded_transactions=None,
		fee=0.15,
		height=TRANSACTIONS[0].height,
		timestamp=TRANSACTIONS[0].timestamp,
		deadline=TRANSACTIONS[0].deadline,
		signature=TRANSACTIONS[0].signature.upper()
	),
	TransactionView(
		transaction_hash='0' * 63 + '2',
		transaction_type='TRANSFER',
		from_address=str(TRANSACTIONS[1].sender_address),
		to_address=str(TRANSACTIONS[1].recipient_address),
		value=[
			{
				'message': {
					'isPlain': 1,
					'payload': 'Test message'
				}
			},
			{
				'namespace': 'nem.xem',
				'amount': 4.0
			},
			{
				'namespace': 'root.mosaic',
				'amount': 4000000.0
			}
		],
		embedded_transactions=None,
		fee=0.15,
		height=TRANSACTIONS[1].height,
		timestamp=TRANSACTIONS[1].timestamp,
		deadline=TRANSACTIONS[1].deadline,
		signature=TRANSACTIONS[1].signature.upper()
	),
	TransactionView(
		transaction_hash='0' * 63 + '3',
		transaction_type='ACCOUNT_KEY_LINK',
		from_address=str(TRANSACTIONS[2].sender_address),
		to_address=None,
		value=[{
			'mode': 1,
			'remoteAccount': 'a5f06d59b97aa40c82afb941a61fb6483bdb7491805cdb9dc47d92136983b9a5'
		}],
		embedded_transactions=None,
		fee=0.15,
		height=TRANSACTIONS[2].height,
		timestamp=TRANSACTIONS[2].timestamp,
		deadline=TRANSACTIONS[2].deadline,
		signature=TRANSACTIONS[2].signature.upper()
	),
	TransactionView(
		transaction_hash='0' * 63 + '4',
		transaction_type='MULTISIG_ACCOUNT_MODIFICATION',
		from_address=str(TRANSACTIONS[3].sender_address),
		to_address=None,
		value=[{
			'minCosignatories': 1,
			'modifications': [{
				'cosignatoryAccount': 'NBFWZ4IVRHEIBRCGHLYDS62FSFTBM3VDFA7E6LSQ',
				'modificationType': 0,
			}]
		}],
		embedded_transactions=None,
		fee=0.15,
		height=TRANSACTIONS[3].height,
		timestamp=TRANSACTIONS[3].timestamp,
		deadline=TRANSACTIONS[3].deadline,
		signature=TRANSACTIONS[3].signature.upper()
	),
	TransactionView(
		transaction_hash='0' * 63 + '5',
		transaction_type='MULTISIG',
		from_address=str(TRANSACTIONS[5].sender_address),
		to_address=str(TRANSACTIONS[5].recipient_address),
		value=None,
		embedded_transactions=[{
			'initiator': 'NAGHXD63C4V6REWGXCVKJ2SBS3GUAXGTRQZQXPRO',
			'transactionHash': '0' * 63 + '6',
			'transactionType': 'TRANSFER',
			'signatures': [{
				'fee': 0.15,
				'signature': '0' * 128,
				'signer': 'NANEMOABLAGR72AZ2RV3V4ZHDCXW25XQ73O7OBT5'
			}],
			'fee': 0.15,
			'value': [{
				'namespace': 'nem.xem',
				'amount': 5.0
			}]
		}],
		fee=0.15,
		height=TRANSACTIONS[4].height,
		timestamp=TRANSACTIONS[4].timestamp,
		deadline=TRANSACTIONS[4].deadline,
		signature=TRANSACTIONS[4].signature.upper()
	),
	TransactionView(
		transaction_hash='0' * 63 + '7',
		transaction_type='NAMESPACE_REGISTRATION',
		from_address=str(TRANSACTIONS[6].sender_address),
		to_address=str(TRANSACTIONS[6].recipient_address),
		value=[{
			'sinkFee': 100.0,
			'parent': 'test',
			'namespaceName': 'namespace'
		}],
		embedded_transactions=None,
		fee=0.15,
		height=TRANSACTIONS[6].height,
		timestamp=TRANSACTIONS[6].timestamp,
		deadline=TRANSACTIONS[6].deadline,
		signature=TRANSACTIONS[6].signature.upper()
	),
	TransactionView(
		transaction_hash='0' * 63 + '8',
		transaction_type='MOSAIC_DEFINITION',
		from_address=str(TRANSACTIONS[7].sender_address),
		to_address=str(TRANSACTIONS[7].recipient_address),
		value=[{
			'sinkFee': 200.0,
			'mosaicNamespaceName': 'root.mosaic'
		}],
		embedded_transactions=None,
		fee=0.15,
		height=TRANSACTIONS[7].height,
		timestamp=TRANSACTIONS[7].timestamp,
		deadline=TRANSACTIONS[7].deadline,
		signature=TRANSACTIONS[7].signature.upper()
	),
	TransactionView(
		transaction_hash='0' * 63 + '9',
		transaction_type='MOSAIC_SUPPLY_CHANGE',
		from_address=str(TRANSACTIONS[8].sender_address),
		to_address=None,
		value=[{
			'supplyType': 1,
			'delta': 1000000,
			'namespaceName': 'root.mosaic'
		}],
		embedded_transactions=None,
		fee=0.15,
		height=TRANSACTIONS[8].height,
		timestamp=TRANSACTIONS[8].timestamp,
		deadline=TRANSACTIONS[8].deadline,
		signature=TRANSACTIONS[8].signature.upper()
	),
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
				total_fee bigint DEFAULT 0,
				total_transactions int DEFAULT 0,
				difficulty bigInt NOT NULL,
				hash bytea NOT NULL,
				beneficiary bytea NOT NULL,
				signer bytea NOT NULL,
				signature bytea NOT NULL,
				size bigint DEFAULT 0
		)
		''')

		cursor.execute(
			'''
			CREATE TABLE IF NOT EXISTS namespaces (
				id serial PRIMARY KEY,
				root_namespace varchar(16) NOT NULL UNIQUE,
				owner bytea NOT NULL,
				registered_height bigint NOT NULL,
				expiration_height bigint NOT NULL,
				sub_namespaces VARCHAR(146)[] DEFAULT '{}'
			)
			'''
		)

		cursor.execute(
			'''
			CREATE TABLE IF NOT EXISTS mosaics (
				id serial PRIMARY KEY,
				root_namespace varchar(16) NOT NULL,
				namespace_name varchar(146) NOT NULL UNIQUE,
				description varchar(512),
				creator bytea NOT NULL,
				registered_height bigint NOT NULL,
				initial_supply bigint,
				total_supply bigint,
				divisibility int NOT NULL,
				supply_mutable boolean,
				transferable boolean,
				levy_type int,
				levy_namespace_name varchar(146),
				levy_fee bigint,
				levy_recipient bytea
			)
			'''
		)

		cursor.execute(
			'''
			CREATE TABLE IF NOT EXISTS account_remarks (
				id serial PRIMARY KEY,
				address bytea UNIQUE,
				remarks varchar NOT NULL
			)
			'''
		)

		cursor.execute(
			'''
			CREATE TABLE IF NOT EXISTS transactions (
				id serial PRIMARY KEY,
				transaction_hash bytea UNIQUE NOT NULL,
				transaction_type int NOT NULL,
				height bigint NOT NULL,
				sender_public_key bytea NOT NULL,
				sender_address bytea NOT NULL,
				recipient_address bytea,
				fee bigint DEFAULT 0,
				timestamp timestamp NOT NULL,
				deadline timestamp NOT NULL,
				signature bytea,
				amount bigint,
				is_inner boolean DEFAULT false,
				payload jsonb
			)
			'''
		)

		cursor.execute(
			'''
			CREATE TABLE IF NOT EXISTS transactions_mosaic (
				id serial PRIMARY KEY,
				transaction_id int NOT NULL,
				namespace_name varchar(146),
				quantity bigint
			)
			'''
		)

		# Insert data
		for block in BLOCKS:
			cursor.execute(
				'''
				INSERT INTO blocks (height, timestamp, total_fee, total_transactions, difficulty, hash, beneficiary, signer, signature, size)
				VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
				''', (
					block.height,
					block.timestamp,
					block.total_fee,
					block.total_transactions,
					block.difficulty,
					unhexlify(block.block_hash),
					block.beneficiary.bytes,
					block.signer.bytes,
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

		for namespace in NAMESPACES:
			cursor.execute(
				'''
				INSERT INTO namespaces (
					root_namespace,
					owner,
					registered_height,
					expiration_height,
					sub_namespaces
				)
				VALUES (%s, %s, %s, %s, %s)
				''', (
					namespace.root_namespace,
					namespace.owner.bytes,
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
					mosaic.creator.bytes,
					mosaic.registered_height,
					mosaic.initial_supply,
					mosaic.total_supply,
					mosaic.divisibility,
					mosaic.supply_mutable,
					mosaic.transferable,
					mosaic.levy_type,
					mosaic.levy_namespace_name,
					mosaic.levy_fee,
					mosaic.levy_recipient.bytes if mosaic.levy_recipient else None
				)
			)

		for address_remark in ADDRESS_REMARKS:
			cursor.execute(
				'''
				INSERT INTO account_remarks (
					address,
					remarks
				)
				VALUES (%s, %s)
				''', (
					address_remark.address.bytes,
					address_remark.remarks
				)
			)

		for transaction in TRANSACTIONS:
			cursor.execute(
				'''
				INSERT INTO transactions (
					transaction_hash,
					transaction_type,
					height,
					sender_public_key,
					sender_address,
					recipient_address,
					fee,
					timestamp,
					deadline,
					signature,
					amount,
					is_inner,
					payload
				)
				VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
				''',
				(
					unhexlify(transaction.transaction_hash),
					transaction.transaction_type,
					transaction.height,
					transaction.sender_public_key.bytes,
					transaction.sender_address.bytes,
					transaction.recipient_address.bytes if transaction.recipient_address else None,
					transaction.fee,
					transaction.timestamp,
					transaction.deadline,
					unhexlify(transaction.signature) if transaction.signature else None,
					transaction.amount,
					transaction.is_inner,
					json.dumps(transaction.payload) if transaction.payload else None
				)
			)

		for transaction_mosaic in TRANSACTIONS_MOSAIC:
			cursor.execute(
				'''
				INSERT INTO transactions_mosaic (
					transaction_id,
					namespace_name,
					quantity
				)
				VALUES (%s, %s, %s)
				''',
				(
					transaction_mosaic.transaction_id,
					transaction_mosaic.namespace_name,
					transaction_mosaic.quantity
				)
			)

		connection.commit()


class DatabaseTestBase(unittest.TestCase):

	def setUp(self):
		self.postgresql = testing.postgresql.Postgresql()
		self.db_config = DatabaseConfig(**self.postgresql.dsn(), password='')
		self.network = Network.MAINNET
		initialize_database(self.db_config, self.network)

	def tearDown(self):
		self.postgresql.stop()
