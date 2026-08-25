# pylint: disable=too-many-function-args
import asyncio
import datetime
import tempfile
import unittest
from collections import namedtuple
from unittest.mock import AsyncMock, Mock, call, patch

import testing.postgresql
from symbolchain.CryptoTypes import PublicKey
from symbolchain.nc import TransactionType
from symbolchain.nem.Network import Address
from symbollightapi.connector.NemConnector import AccountMosaic, NemAccountInfo
from symbollightapi.model.Block import Block
from symbollightapi.model.Exceptions import NodeException
from symbollightapi.model.Transaction import (
	AccountKeyLinkTransaction,
	CosignSignatureTransaction,
	Message,
	Modification,
	Mosaic,
	MosaicDefinitionTransaction,
	MosaicLevy,
	MosaicProperties,
	MosaicSupplyChangeTransaction,
	MultisigAccountModificationTransaction,
	MultisigTransaction,
	NamespaceRegistrationTransaction,
	TransferTransaction
)

from puller.db.NemDatabase import AccountRefreshRecord, RollbackMosaicRecord, RollbackNamespaceRegistrationRecord
from puller.facade.NemPuller import (
	NEM_MAX_ROLLBACK_DEPTH,
	NEM_NAMESPACE_DURATION,
	AccountRecord,
	BlockRecord,
	DatabaseConfig,
	MosaicRecord,
	NamespaceRecord,
	NemPuller,
	RefreshedAccountRecord,
	NemRollbackError,
	NemRollbackImpact,
	RollbackPayloadAccounts,
	TransactionRecord
)

# region test data

NodeBlockHashes = namedtuple('NodeBlockHashes', ['block_hash', 'previous_block_hash'])

NEM_CONNECTOR_RESPONSE_BLOCKS = [
	Block(
		1,
		78976,
		[
			TransferTransaction(
				'd6c9902cfa23dbbdd212d720f86391dd91d215bf77d806f03a6c2dd2e730628a',
				2,
				PublicKey('8d07f90fb4bbe7715fa327c926770166a11be2e494a970605f2e12557f66c9b9'),
				9000000,
				73397,
				83397,
				'e0cc7f71e353ca0aaf2f009d74aeac5f97d4796b0f08c009058fb33d93c2e8ca'
				'68c0b63e46ff125f43314014d324ac032d2c82996a6e47068b251f1d71fdd001',
				202,
				1,
				180000040000000,
				Address('NCOPERAWEWCD4A34NP5UQCCKEX44MW4SL3QYJYS5'),
				Message('476f6f64206c75636b21', 1),
				None
			),
		],
		100,
		'1dd9d4d7b6af603d29c082f9aa4e123f07d18154ddbcd7ddc6702491b854c5e4',
		9000000,
		Address('TBZWVEKB2XMTO4F3RAOEIBWRBMPQ5N23G56ZJM4I'),
		PublicKey('f9bd190dd0c364261f5c8a74870cc7f7374e631352293c62ecc437657e5de2cd'),
		(
			'fdf6a9830e9320af79123f467fcb03d6beab735575ff50eab363d812c5581436'
			'2ad7be0503db2ee70e60ac3408d83cdbcbd941067a6df703e0c21c7bf389f105'
		),
		345
	),
	Block(
		2,
		88999,
		[],
		200,
		'9708256e8a8dfb76eed41dcfa2e47f4af520b7b3286afb7f60dca02851f8a53e',
		0,
		Address('TCJLCZSOQ6RGWHTPSV2DW467WZSHK4NBSITND4OF'),
		PublicKey('45c1553fb1be7f25b6f79278b9ede1129bb9163f3b85883ea90f1c66f497e68b'),
		(
			'919ae66a34119b49812b335827b357f86884ab08b628029fd6e8db3572faeb4f'
			'323a7bf9488c76ef8faa5b513036bbcce2d949ba3e41086d95a54c0007403c0b'
		),
		168
	),
	Block(
		3,
		73976,
		[
			AccountKeyLinkTransaction(
				'306f20260a1b7af692834809d3e7d53edd41616d5076ac0fac6cfa75982185df',
				3,
				PublicKey('22df5f43ee3739a10c346b3ec2d3878668c5514696be425f9067d3a11c777f1d'),
				8000000,
				73397,
				83397,
				'1b81379847241e45da86b27911e5c9a9192ec04f644d98019657d32838b49c14'
				'3eaa4815a3028b80f9affdbf0b94cd620f7a925e02783dda67b8627b69ddf70e',
				168,
				1,
				1,
				PublicKey('7195f4d7a40ad7e31958ae96c4afed002962229675a4cae8dc8a18e290618981')
			),
			TransferTransaction(
				'd6c9902cfa23dbbdd212d720f86391dd91d215bf77d806f03a6c2dd2e730628a',
				3,
				PublicKey('8d07f90fb4bbe7715fa327c926770166a11be2e494a970605f2e12557f66c9b9'),
				9000000,
				73397,
				83397,
				'e0cc7f71e353ca0aaf2f009d74aeac5f97d4796b0f08c009058fb33d93c2e8ca'
				'68c0b63e46ff125f43314014d324ac032d2c82996a6e47068b251f1d71fdd001',
				202,
				1,
				180000040000000,
				Address('NCOPERAWEWCD4A34NP5UQCCKEX44MW4SL3QYJYS5'),
				Message('476f6f64206c75636b21', 1),
				None
			),
			MultisigAccountModificationTransaction(
				'cc64ca69bfa95db2ff7ac1e21fe6d27ece189c603200ebc9778d8bb80ca25c3c',
				3,
				PublicKey('f41b99320549741c5cce42d9e4bb836d98c50ed5415d0c3c2912d1bb50e6a0e5'),
				40000000,
				73397,
				83397,
				'81ff2235f9ad6f3f8adbc16051bf8691a45ee5ddcace4d6260ce9a2ae63dba59'
				'4f2b486f25451a1f90da7f0e312d9e8570e4bc03798e58d19dec86feb4152307',
				220,
				1,
				2,
				[
					Modification(1, PublicKey('1fbdbdde28daf828245e4533765726f0b7790e0b7146e2ce205df3e86366980b')),
					Modification(1, PublicKey('f94e8702eb1943b23570b1b83be1b81536df35538978820e98bfce8f999e2d37'))
				]
			),
			NamespaceRegistrationTransaction(
				'7e547e45cfc9c34809ce184db6ae7b028360c0f1492cc37b7b4d31c22af07dc3',
				3,
				PublicKey('a700809530e5428066807ec0d34859c52e260fc60634aaac13e3972dcfc08736'),
				150000,
				73397,
				83397,
				'9fc70720d0333d7d8f9eb14ef45ce45a846d37e79cf7a4244b4db36dcb0d3dfe'
				'0170daefbf4d30f92f343110a6f03a14aedcf7913e465a4a1cc199639169410a',
				197,
				1,
				Address('NAMESPACEWH4MKFMBCVFERDPOOP4FK7MTBXDPZZA'),
				100000000,
				None,
				'namespace'
			),
			MosaicDefinitionTransaction(
				'4725e523e5d5a562121f38953d6da3ae695060533fc0c5634b31de29c3b766e1',
				3,
				PublicKey('a700809530e5428066807ec0d34859c52e260fc60634aaac13e3972dcfc08736'),
				150000,
				73397,
				83397,
				'a80ccd44955ded7d35ee3aa011bfafd3f30cc746f63cb59a9d02171f908a0f4a'
				'0294fcbba0b2838acd184daf1d9ae3c0f645308b442547156364192cd3d2d605',
				464,
				1,
				10000000,
				Address('NBMOSAICOD4F54EE5CDMR23CCBGOAM2XSIUX6TRS'),
				PublicKey('a700809530e5428066807ec0d34859c52e260fc60634aaac13e3972dcfc08736'),
				'NEM namespace test',
				MosaicProperties(4, 3100000, False, True),
				MosaicLevy(500, Address('NBRYCNWZINEVNITUESKUMFIENWKYCRUGNFZV25AV'), 1, 'nem.xem'),
				'namespace.test'
			),
			MosaicSupplyChangeTransaction(
				'cb805b4499479135934e70452d12ad9ecc26c46a111fe0cdda8e09741d257708',
				3,
				PublicKey('da04b4a1d64add6c70958d383f9d247af1aaa957cb89f15b2d059b278e0594d5'),
				150000,
				73397,
				83397,
				'7fef5a89a1c6c98347b8d488a8dd28902e8422680f917c28f3ef0100d394b91c'
				'd85f7cdfd7bdcd6f0cb8089ae9d4e6ef24a8caca35d1cfec7e33c9ccab5e1503',
				165,
				1,
				2,
				500000,
				'namespace.test'
			),
			MultisigTransaction(
				'3375969dbc2aaae1cad0d89854d4f41b4fef553dbe9c7d39bdf72e3c538f98fe',
				3,
				PublicKey('aa455d831430872feb0c6ae14265209182546c985a321c501be7fdc96ed04757'),
				500000,
				73397,
				83397,
				'0e7112b029e030d2d1c7dff79c88a29812f7254422d80e37a7aac5228fff5706'
				'133500b0119a1327cab8787416b5873cc873e3181066c46cb2b108c5da10d90f',
				468,
				1,
				[
					CosignSignatureTransaction(
						261593985,
						'edcc8d1c48165f5b771087fbe3c4b4d41f5f8f6c4ce715e050b86fb4e7fdeb64',
						Address('NAGJG3QFWYZ37LMI7IQPSGQNYADGSJZGJRD2DIYA'),
						PublicKey('ae6754c70b7e3ba0c51617c8f9efd462d0bf680d45e09c3444e817643d277826'),
						500000,
						261680385,
						'249bc2dbad96e827eabc991b59dff7f12cc27f3e0da8ab3db6a3201169431786'
						'72f712ba14ed7a3b890e161357a163e7408aa22e1d6d1382ebada57973862706'
					)
				],
				TransferTransaction(
					None,
					None,
					PublicKey('fbae41931de6a0cc25153781321f3de0806c7ba9a191474bb9a838118c8de4d3'),
					750000,
					73397,
					83397,
					None,
					184,
					1,
					150000000000,
					Address('NBUH72UCGBIB64VYTAAJ7QITJ62BLISFFQOHVP65'),
					None,
					None
				),
				'edcc8d1c48165f5b771087fbe3c4b4d41f5f8f6c4ce715e050b86fb4e7fdeb64'
			)
		],
		300,
		'1dd9d4d7b6af603d29c082f9aa4e123f07d18154ddbcd7ddc6702491b854c5e4',
		57950000,
		Address('TCJLCZSOQ6RGWHTPSV2DW467WZSHK4NBSITND4OF'),
		PublicKey('f9bd190dd0c364261f5c8a74870cc7f7374e631352293c62ecc437657e5de2cd'),
		(
			'fdf6a9830e9320af79123f467fcb03d6beab735575ff50eab363d812c5581436'
			'2ad7be0503db2ee70e60ac3408d83cdbcbd941067a6df703e0c21c7bf389f105'
		),
		2052
	)
]

NEM_CONNECTOR_RESPONSE_ACCOUNT_INFO = NemAccountInfo(Address('TALICE6XEEEOBFJVY3ZCENZ7WBG6LB4KB7P7KMQX'))

# endregion


class NemPullerTest(unittest.TestCase):  # pylint: disable=too-many-public-methods, too-many-lines

	def setUp(self):
		self.postgresql = testing.postgresql.Postgresql()
		self.config_ini = self.create_temp_config_file(DatabaseConfig(**self.postgresql.dsn(), password=''))
		self.puller = NemPuller('http://localhost:7890', self.config_ini, 'testnet')

	def tearDown(self):
		# Destroy the temporary PostgreSQL database
		self.postgresql.stop()

	def create_temp_config_file(self, db_config):  # pylint: disable=no-self-use
		"""Helper method to create temporary config file"""

		config_content = f"""[nem_db]
			database = {db_config.database}
			user = {db_config.user}
			password = {db_config.password}
			host = {db_config.host}
			port = {db_config.port}
		"""

		with tempfile.NamedTemporaryFile(mode='w', suffix='.ini', delete=False) as temp_file:
			temp_file.write(config_content)
			return temp_file.name

	def _assert_puller_instance(self, puller, expected_network_str):
		# Assert
		self.assertIsNotNone(puller.nem_db)
		self.assertIsNotNone(puller.nem_connector)
		self.assertIsNotNone(puller.nem_facade)
		self.assertEqual(str(puller.nem_facade.network), expected_network_str)

	def test_create_default_puller_instance(self):
		# Act:
		puller = NemPuller('http://localhost:7890', self.config_ini)

		# Assert
		self._assert_puller_instance(puller, 'mainnet')

	def test_create_testnet_puller_instance(self):
		# Act + Assert:
		self._assert_puller_instance(self.puller, 'testnet')

	def _query_fetch_blocks(self, facade, where_clause='', params=None):  # pylint: disable=no-self-use
		cursor = facade.nem_db.connection.cursor()

		query = (
			'SELECT height, timestamp, '
			'total_fee, total_transactions, difficulty, '
			'encode(hash, \'hex\'), encode(beneficiary, \'hex\'), encode(signer, \'hex\'), encode(signature, \'hex\'), size '
			'FROM blocks'
		)

		if where_clause:
			query += f' {where_clause}'

		cursor.execute(query, params or ())
		results = cursor.fetchall()

		return results

	def _query_fetch_accounts(self, facade, where_clause='', params=None):  # pylint: disable=no-self-use
		cursor = facade.nem_db.connection.cursor()

		query = (
			'SELECT encode(address, \'hex\') '
			'FROM accounts'
		)

		if where_clause:
			query += f' {where_clause}'

		cursor.execute(query, params or ())
		results = cursor.fetchall()

		return results

	@patch('puller.facade.NemPuller.NemConnector.get_block')
	@patch('puller.facade.NemPuller.NemConnector.account_info')
	@patch('puller.facade.NemPuller.NemConnector.account_mosaics')
	@patch('puller.facade.NemPuller.NemPuller._process_transactions')
	@patch('puller.facade.NemPuller.NemDatabase.seed_network_currency')
	def test_can_sync_nemesis_block(  # pylint: disable=too-many-arguments, too-many-positional-arguments
		self,
		mock_seed_network_currency,
		mock_process_transactions,
		mock_account_mosaics,
		mock_account_info,
		mock_get_block):
		# Arrange:
		sender_address = Address('TALICE6XEEEOBFJVY3ZCENZ7WBG6LB4KB7P7KMQX')
		recipient_address = Address('NCOPERAWEWCD4A34NP5UQCCKEX44MW4SL3QYJYS5')
		signer_address = Address('TBEM6SFOHU5PORIGAVG3NNJIMCG73R2TWH35O2VF')
		beneficiary_address = Address('TBZWVEKB2XMTO4F3RAOEIBWRBMPQ5N23G56ZJM4I')

		mock_get_block.return_value = NEM_CONNECTOR_RESPONSE_BLOCKS[0]
		mock_account_info.side_effect = [
			NemAccountInfo(sender_address),
			NemAccountInfo(recipient_address),
			NemAccountInfo(signer_address),
			NemAccountInfo(beneficiary_address)
		]
		mock_account_mosaics.return_value = [AccountMosaic(('nem', 'xem'), 0), ]

		with self.puller.nem_db as databases:
			databases.create_tables()

			asyncio.run(self.puller.sync_nemesis_block())

			# Assert:
			block_results = self._query_fetch_blocks(self.puller, 'WHERE height = %s', (1, ))
			self.assertEqual(block_results[0], (
				1,
				datetime.datetime(2015, 3, 29, 22, 2, 41),
				9000000,
				1,
				100,
				'1dd9d4d7b6af603d29c082f9aa4e123f07d18154ddbcd7ddc6702491b854c5e4',
				'98736a9141d5d93770bb881c4406d10b1f0eb75b377d94b388',
				'f9bd190dd0c364261f5c8a74870cc7f7374e631352293c62ecc437657e5de2cd',
				(
					'fdf6a9830e9320af79123f467fcb03d6beab735575ff50eab363d812c5581436'
					'2ad7be0503db2ee70e60ac3408d83cdbcbd941067a6df703e0c21c7bf389f105'
				),
				345
			))

			account_results = self._query_fetch_accounts(self.puller)
			self.assertCountEqual(
				[
					sender_address.bytes.hex(),
					recipient_address.bytes.hex(),
					signer_address.bytes.hex(),
					beneficiary_address.bytes.hex()
				],
				[row[0] for row in account_results],
			)
			mock_seed_network_currency.assert_called_once()
			self.assertEqual(mock_seed_network_currency.call_args[0][1], NEM_CONNECTOR_RESPONSE_BLOCKS[0].signer)
			self.assertEqual(mock_process_transactions.call_count, 1)
			self.assertEqual(mock_process_transactions.call_args[0][1], NEM_CONNECTOR_RESPONSE_BLOCKS[0].transactions)
			self.assertEqual(mock_process_transactions.call_args[0][2], NEM_CONNECTOR_RESPONSE_BLOCKS[0].height)

	@patch('puller.facade.NemPuller.NemConnector.get_blocks_after')
	@patch('puller.facade.NemPuller.NemPuller._process_account_batch')
	@patch('puller.facade.NemPuller.NemPuller._process_transactions')
	def test_can_sync_blocks(self, mock_process_transactions, mock_process_account_batch, mock_get_blocks_after):
		# Arrange:
		mock_get_blocks_after.return_value = NEM_CONNECTOR_RESPONSE_BLOCKS
		mock_process_account_batch.return_value = AsyncMock()

		# the accumulator is cleared after each flush, so snapshot it at call time
		captured_address_heights = []
		mock_process_account_batch.side_effect = lambda _cursor, address_heights: captured_address_heights.append(
			dict(address_heights)
		)

		with self.puller.nem_db as databases:
			databases.create_tables()

			# Act:
			asyncio.run(self.puller.sync_blocks(0, 2))
			# Assert:
			results = self._query_fetch_blocks(self.puller)
			self.assertEqual(len(results), 3)
			self.assertEqual(results[0], (
				1,
				datetime.datetime(2015, 3, 29, 22, 2, 41),
				9000000,
				1,
				100,
				'1dd9d4d7b6af603d29c082f9aa4e123f07d18154ddbcd7ddc6702491b854c5e4',
				'98736a9141d5d93770bb881c4406d10b1f0eb75b377d94b388',
				'f9bd190dd0c364261f5c8a74870cc7f7374e631352293c62ecc437657e5de2cd',
				(
					'fdf6a9830e9320af79123f467fcb03d6beab735575ff50eab363d812c5581436'
					'2ad7be0503db2ee70e60ac3408d83cdbcbd941067a6df703e0c21c7bf389f105'
				),
				345
			))
			self.assertEqual(results[1], (
				2,
				datetime.datetime(2015, 3, 30, 0, 49, 44),
				0,
				0,
				200,
				'9708256e8a8dfb76eed41dcfa2e47f4af520b7b3286afb7f60dca02851f8a53e',
				'9892b1664e87a26b1e6f95743b73dfb6647571a19226d1f1c5',
				'45c1553fb1be7f25b6f79278b9ede1129bb9163f3b85883ea90f1c66f497e68b',
				(
					'919ae66a34119b49812b335827b357f86884ab08b628029fd6e8db3572faeb4f'
					'323a7bf9488c76ef8faa5b513036bbcce2d949ba3e41086d95a54c0007403c0b'
				),
				168
			))
			self.assertEqual(results[2], (
				3,
				datetime.datetime(2015, 3, 29, 20, 39, 21),
				57950000,
				7,
				300,
				'1dd9d4d7b6af603d29c082f9aa4e123f07d18154ddbcd7ddc6702491b854c5e4',
				'9892b1664e87a26b1e6f95743b73dfb6647571a19226d1f1c5',
				'f9bd190dd0c364261f5c8a74870cc7f7374e631352293c62ecc437657e5de2cd',
				(
					'fdf6a9830e9320af79123f467fcb03d6beab735575ff50eab363d812c5581436'
					'2ad7be0503db2ee70e60ac3408d83cdbcbd941067a6df703e0c21c7bf389f105'
				),
				2052
			))

			address_heights = captured_address_heights[0]
			self.assertEqual(len(address_heights), 21)
			self.assertIn(1, address_heights.values())
			self.assertIn(2, address_heights.values())
			self.assertIn(3, address_heights.values())

			self.assertEqual(mock_process_transactions.call_count, 3)
			process_transactions_calls = mock_process_transactions.call_args_list
			for i in range(mock_process_transactions.call_count):
				self.assertEqual(process_transactions_calls[i][0][1], NEM_CONNECTOR_RESPONSE_BLOCKS[i].transactions)
				self.assertEqual(process_transactions_calls[i][0][2], NEM_CONNECTOR_RESPONSE_BLOCKS[i].height)

	@patch('puller.facade.NemPuller.NemPuller._retry_get_blocks_after')
	@patch('puller.facade.NemPuller.log')
	def test_sync_blocks_raise_error_connector_fail(self, mock_log, mock_retry_get_blocks_after):
		# Arrange:
		mock_retry_get_blocks_after.side_effect = Exception('Connection timeout')

		with self.puller.nem_db as databases:
			databases.create_tables()

			# Act & Assert:
			with self.assertRaises(Exception):
				asyncio.run(self.puller.sync_blocks(0, 100))

			mock_log.error.assert_called_once_with('Sync error: Connection timeout')

	@patch('puller.facade.NemPuller.NemConnector.get_blocks_after')
	@patch('puller.facade.NemPuller.NemPuller._commit_blocks')
	@patch('puller.facade.NemPuller.NemPuller._process_account_batch')
	@patch('puller.facade.NemPuller.NemPuller._process_harvested_fees')
	@patch('puller.facade.NemPuller.NemPuller._process_transactions')
	def test_db_writer_can_commits_in_batches(
		self,
		mock_process_transactions,
		mock_process_harvested_fees,
		mock_process_account_batch,
		mock_commit_blocks,
		mock_get_blocks_after
	):
		# pylint: disable=too-many-arguments,too-many-positional-arguments
		# Arrange:
		# Create 5 blocks to test batch commit (batch_size=2 means 2 commits + 1 final)
		test_blocks = []
		for i in range(1, 6):
			test_blocks.append(
				Block(
					i,
					78976 + (i * 1000),
					[],
					100 + i,
					'a' * 64,  # hash
					1000000,  # total_fee
					Address('T' + 'A' * 39),  # beneficiary
					PublicKey('A' * 64),  # signer
					'd' * 128,  # signature
					200
				)
			)

		mock_get_blocks_after.return_value = test_blocks
		mock_process_account_batch.return_value = AsyncMock()
		mock_process_harvested_fees.return_value = Mock()
		mock_process_transactions.return_value = Mock()

		# the accumulator is cleared after each flush, so snapshot it at call time
		captured_harvested_fees = []
		mock_process_harvested_fees.side_effect = lambda _cursor, harvested_fees: captured_harvested_fees.append(
			dict(harvested_fees)
		)

		with self.puller.nem_db as databases:
			databases.create_tables()

			# Act: Use batch_size=2 to trigger multiple commits
			asyncio.run(self.puller.sync_blocks(0, 5, batch_size=2))

			# Assert:
			# Verify _commit_blocks was called 3 times:
			# - After 2 blocks processed (batch commit)
			# - After 4 blocks processed (batch commit)
			# - Final commit for remaining block
			self.assertEqual(mock_commit_blocks.call_count, 3)

			# # Verify the commit messages
			expected_calls = [
				'Committed 2 blocks',
				'Committed 4 blocks',
				None  # Final commit has no message
			]
			actual_calls = [call[0][0] if call[0] else None for call in mock_commit_blocks.call_args_list]
			self.assertEqual(actual_calls, expected_calls)

			# two batch flushes plus a trailing flush for the fifth block
			self.assertEqual(captured_harvested_fees, [
				{Address('T' + 'A' * 39): (2000000, 2)},
				{Address('T' + 'A' * 39): (2000000, 4)},
				{Address('T' + 'A' * 39): (1000000, 5)}
			])

			process_transactions_calls = mock_process_transactions.call_args_list
			self.assertEqual(len(process_transactions_calls), 5)
			for i in range(5):
				self.assertEqual(process_transactions_calls[i][0][1], test_blocks[i].transactions)

	def _assert_retry_operation_successful(self, mock_connector_method, operation, expected_result):
		# Arrange:
		mock_connector_method.return_value = expected_result

		# Act:
		result = asyncio.run(operation(1))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual(result, expected_result)
		mock_connector_method.assert_called_once_with(1)

	def test_retry_operation_succeeds_on_first_attempt(self):
		# Arrange:
		mock_operation = AsyncMock()
		mock_operation.return_value = 'success'

		# Act:
		result = asyncio.run(self.puller._retry_operation(mock_operation, 'testing'))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual(result, 'success')
		mock_operation.assert_called_once()

	@patch('asyncio.sleep')
	def test_retry_operation_succeeds_on_second_attempt(self, mock_sleep):
		# Arrange:
		mock_operation = AsyncMock()
		mock_operation.side_effect = [
			NodeException('Connection refused'),
			'success'
		]
		mock_sleep.return_value = AsyncMock()

		# Act:
		result = asyncio.run(self.puller._retry_operation(mock_operation, 'testing'))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual(result, 'success')
		self.assertEqual(mock_operation.call_count, 2)
		self.assertEqual(mock_sleep.call_count, 1)
		sleep_calls = [call[0][0] for call in mock_sleep.call_args_list]
		self.assertEqual(sleep_calls, [2])

	@patch('asyncio.sleep')
	def test_retry_operation_succeeds_on_last_attempt(self, mock_sleep):
		# Arrange:
		mock_operation = AsyncMock()
		mock_operation.side_effect = [
			NodeException('Connection refused'),
			NodeException('Connection refused'),
			'success'
		]
		mock_sleep.return_value = AsyncMock()

		# Act:
		result = asyncio.run(self.puller._retry_operation(mock_operation, 'testing'))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual(result, 'success')
		self.assertEqual(mock_operation.call_count, 3)
		self.assertEqual(mock_sleep.call_count, 2)
		sleep_calls = [call[0][0] for call in mock_sleep.call_args_list]
		self.assertEqual(sleep_calls, [2, 4])

	@patch('asyncio.sleep')
	def test_retry_operation_raises_error_after_max_retries(self, mock_sleep):
		# Arrange:
		mock_operation = AsyncMock()
		mock_operation.side_effect = NodeException('Connection refused')
		mock_sleep.return_value = AsyncMock()

		# Act & Assert:
		with self.assertRaises(NodeException) as context:
			asyncio.run(self.puller._retry_operation(mock_operation, 'testing'))  # pylint: disable=protected-access

		self.assertEqual(str(context.exception), 'Connection refused')
		self.assertEqual(mock_operation.call_count, 3)
		self.assertEqual(mock_sleep.call_count, 2)

	@patch('puller.facade.NemPuller.NemConnector.get_blocks_after')
	def test_retry_get_blocks_after(self, mock_get_blocks_after):
		# Arrange:
		mock_get_blocks_after.return_value = NEM_CONNECTOR_RESPONSE_BLOCKS

		# Act:
		result = asyncio.run(self.puller._retry_get_blocks_after(1))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual(result, NEM_CONNECTOR_RESPONSE_BLOCKS)
		mock_get_blocks_after.assert_called_once_with(1)

	@patch('puller.facade.NemPuller.NemConnector.account_info')
	def test_retry_get_account_info(self, mock_account_info):
		# Arrange:
		mock_account_info.return_value = NEM_CONNECTOR_RESPONSE_ACCOUNT_INFO
		address = str(NEM_CONNECTOR_RESPONSE_ACCOUNT_INFO.address)

		# Act:
		result = asyncio.run(self.puller._retry_get_account_info(address))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual(result, NEM_CONNECTOR_RESPONSE_ACCOUNT_INFO)
		mock_account_info.assert_called_once_with(address)

	@patch('puller.facade.NemPuller.NemConnector.account_mosaics')
	def test_retry_get_account_mosaics(self, mock_account_mosaics):
		# Arrange:
		mosaics = [
			AccountMosaic(('nem', 'xem'), 8000000),
			AccountMosaic(('foo', 'bar'), 500)
		]
		mock_account_mosaics.return_value = mosaics
		address = str(NEM_CONNECTOR_RESPONSE_ACCOUNT_INFO.address)

		# Act:
		result = asyncio.run(self.puller._retry_get_account_mosaics(address))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual(result, mosaics)
		mock_account_mosaics.assert_called_once_with(address)

	@patch('puller.facade.NemPuller.NemConnector.get_block')
	def test_retry_get_block(self, mock_get_block):
		# Arrange:
		mock_get_block.return_value = NEM_CONNECTOR_RESPONSE_BLOCKS[0]

		# Act:
		result = asyncio.run(self.puller._retry_get_block(1))  # pylint: disable=protected-access

		# Assert:
		self.assertEqual(result, NEM_CONNECTOR_RESPONSE_BLOCKS[0])
		mock_get_block.assert_called_once_with(1)

	@patch('puller.facade.NemPuller.NemDatabase.get_mosaic_levy_recipients')
	def test_can_extract_addresses_from_block_signer_and_beneficiary(self, mock_get_mosaic_levy_recipients):
		# Arrange:
		block = NEM_CONNECTOR_RESPONSE_BLOCKS[1]
		cursor = Mock()
		mock_get_mosaic_levy_recipients.return_value = []

		# Act:
		addresses = self.puller._extract_addresses_from_block(cursor, block)  # pylint: disable=protected-access

		# Assert:
		self.assertEqual(addresses, {
			'TALICE6XEEEOBFJVY3ZCENZ7WBG6LB4KB7P7KMQX',
			'TCJLCZSOQ6RGWHTPSV2DW467WZSHK4NBSITND4OF'
		})
		mock_get_mosaic_levy_recipients.assert_called_once_with(cursor, set())

	@patch('puller.facade.NemPuller.NemDatabase.get_mosaic_levy_recipients')
	def test_extract_addresses_does_not_duplicate_beneficiary_equal_to_signer(self, mock_get_mosaic_levy_recipients):
		# Arrange:
		signer = PublicKey('f9bd190dd0c364261f5c8a74870cc7f7374e631352293c62ecc437657e5de2cd')
		signer_address = self.puller._convert_public_key_to_address(signer)  # pylint: disable=protected-access
		block = Block(9, 78976, [], 100, 'a' * 64, 1000000, signer_address, signer, 'd' * 128, 200)
		cursor = Mock()
		mock_get_mosaic_levy_recipients.return_value = []

		# Act:
		addresses = self.puller._extract_addresses_from_block(cursor, block)  # pylint: disable=protected-access

		# Assert:
		self.assertEqual(addresses, {str(signer_address)})
		mock_get_mosaic_levy_recipients.assert_called_once_with(cursor, set())

	@patch('puller.facade.NemPuller.NemDatabase.get_mosaic_levy_recipients')
	def test_can_extract_addresses_from_block(self, mock_get_mosaic_levy_recipients):
		# Arrange:
		block = NEM_CONNECTOR_RESPONSE_BLOCKS[2]
		cursor = Mock()
		mock_get_mosaic_levy_recipients.return_value = []

		# Act:
		addresses = self.puller._extract_addresses_from_block(cursor, block)  # pylint: disable=protected-access

		# Assert:
		self.assertEqual(addresses, {
			'TBKQWJJGPOHL462DBVMTYOAERXGG2BOS5XRFO2P6',
			'TCC4NPREMOSTSKVODMW3T7OWDL4SRBT5BPVDTUSZ',
			'TCMARKECQXP3SQZSJPCBKOQWIXRRI7LIS66LNC4X',
			'TAGJG3QFWYZ37LMI7IQPSGQNYADGSJZGJROECHCG',
			'TANEMOABLAGR72AZ2RV3V4ZHDCXW25XQ7YP7HX57',
			'NCOPERAWEWCD4A34NP5UQCCKEX44MW4SL3QYJYS5',
			'NAMESPACEWH4MKFMBCVFERDPOOP4FK7MTBXDPZZA',
			'NBUH72UCGBIB64VYTAAJ7QITJ62BLISFFQOHVP65',
			'TCTWKWGD564GIQQCZ5X5TC4YM46VXWLT3QPGJBHA',
			'NBMOSAICOD4F54EE5CDMR23CCBGOAM2XSIUX6TRS',
			'TBRYCNWZINEVNITUESKUMFIENWKYCRUGNE63PMQQ',
			'NAGJG3QFWYZ37LMI7IQPSGQNYADGSJZGJRD2DIYA',
			'TBRFW5P3FIXAWV7AOXE6EOEZLZWCBIWHPXVD4V2J',
			'TALICEPFLZQRZGPRIJTMJOCPWDNECXTNNFEN6XWA',
			'NBRYCNWZINEVNITUESKUMFIENWKYCRUGNFZV25AV',
			'TANIBAXPVLBP37YXSGREVD77NXIFZML5FANIVEXX',
			'TBEM6SFOHU5PORIGAVG3NNJIMCG73R2TWH35O2VF',
			'TADMEHCFJD45GPTDL4HZP2LJLZVAZRLYWY2K4OOH',
			'TCJLCZSOQ6RGWHTPSV2DW467WZSHK4NBSITND4OF'
		})
		mock_get_mosaic_levy_recipients.assert_called_once_with(cursor, set())

	@patch('puller.facade.NemPuller.NemDatabase.get_mosaic_levy_recipients')
	def test_can_extract_levy_recipient_addresses_from_transfer_mosaics(self, mock_get_mosaic_levy_recipients):
		# Arrange:
		sender = PublicKey('8d07f90fb4bbe7715fa327c926770166a11be2e494a970605f2e12557f66c9b9')
		recipient = Address('NCOPERAWEWCD4A34NP5UQCCKEX44MW4SL3QYJYS5')
		levy_recipient = Address('TBRYCNWZINEVNITUESKUMFIENWKYCRUGNE63PMQQ')
		transaction = TransferTransaction(
			'd6c9902cfa23dbbdd212d720f86391dd91d215bf77d806f03a6c2dd2e730628a',
			3,
			sender,
			9000000,
			73397,
			83397,
			'e0cc7f71e353ca0aaf2f009d74aeac5f97d4796b0f08c009058fb33d93c2e8ca'
			'68c0b63e46ff125f43314014d324ac032d2c82996a6e47068b251f1d71fdd001',
			202,
			2,
			1999999,
			recipient,
			None,
			[
				Mosaic('namespace.test', 20),
				Mosaic('nem.xem', 8000000)
			]
		)
		block = Block(
			3,
			73976,
			[transaction],
			300,
			'1dd9d4d7b6af603d29c082f9aa4e123f07d18154ddbcd7ddc6702491b854c5e4',
			9000000,
			recipient,
			sender,
			'fdf6a9830e9320af79123f467fcb03d6beab735575ff50eab363d812c5581436'
			'2ad7be0503db2ee70e60ac3408d83cdbcbd941067a6df703e0c21c7bf389f105',
			345
		)
		cursor = Mock()
		mock_get_mosaic_levy_recipients.return_value = [levy_recipient]

		# Act:
		addresses = self.puller._extract_addresses_from_block(cursor, block)  # pylint: disable=protected-access

		# Assert:
		self.assertEqual(addresses, {
			str(self.puller.nem_facade.network.public_key_to_address(sender)),
			str(recipient),
			str(levy_recipient)
		})
		mock_get_mosaic_levy_recipients.assert_called_once_with(cursor, {'namespace.test'})

	@staticmethod
	def _exclude_account_status(account):
		return {
			key: value
			for key, value in vars(account).items()
			if key != 'status'  # Exclude status from the record
		}

	@patch('puller.facade.NemPuller.NemConnector.account_info')
	@patch('puller.facade.NemPuller.NemConnector.account_mosaics')
	@patch('puller.facade.NemPuller.NemDatabase.upsert_account')
	def test_can_process_account_batch(self, mock_upsert_account, mock_account_mosaics, mock_account_info):
		# Arrange:
		mock_account_info.return_value = NEM_CONNECTOR_RESPONSE_ACCOUNT_INFO
		mock_account_mosaics.return_value = [
			AccountMosaic(('nem', 'xem'), 8000000),
		]

		cursor = Mock()
		address_heights = {
			str(NEM_CONNECTOR_RESPONSE_ACCOUNT_INFO.address): 3,
		}

		# Act:
		asyncio.run(self.puller._process_account_batch(cursor, address_heights))  # pylint: disable=protected-access

		# Assert:
		mock_account_info.assert_called_once_with(str(NEM_CONNECTOR_RESPONSE_ACCOUNT_INFO.address))
		mock_account_mosaics.assert_called_once_with(str(NEM_CONNECTOR_RESPONSE_ACCOUNT_INFO.address))
		mock_upsert_account.assert_called_once_with(
			cursor,
			AccountRecord(
				height=3,
				mosaics=[{
					'namespace_name': 'nem.xem',
					'quantity': 8000000
				}],
				remote_address=None,
				**self._exclude_account_status(NEM_CONNECTOR_RESPONSE_ACCOUNT_INFO)
			)
		)

	@patch('puller.facade.NemPuller.NemDatabase.update_account_harvested_fees')
	def test_can_process_harvested_fees(self, mock_update_account_harvested_fees):
		# Arrange:
		harvested_fees = {
			Address('TALICEPFLZQRZGPRIJTMJOCPWDNECXTNNFEN6XWA'): (59200000, 3),
		}

		cursor = Mock()

		# Act:
		self.puller._process_harvested_fees(cursor, harvested_fees)  # pylint: disable=protected-access

		# Assert:
		update_fees_calls = mock_update_account_harvested_fees.call_args_list
		self.assertEqual(len(update_fees_calls), 1)
		self.assertEqual(update_fees_calls[0][0], (
			cursor,
			Address('TALICEPFLZQRZGPRIJTMJOCPWDNECXTNNFEN6XWA'),
			59200000,
			3
		))

	@patch('puller.facade.NemPuller.NemPuller._retry_get_account_info')
	@patch('puller.facade.NemPuller.NemDatabase.get_accounts_for_refresh')
	@patch('puller.facade.NemPuller.NemDatabase.update_refreshed_account')
	def test_can_refresh_accounts_in_batches(
		self,
		mock_update_refreshed_account,
		mock_get_accounts_for_refresh,
		mock_retry_get_account_info
	):
		# Arrange:
		cursor = Mock()
		self.puller.nem_db.connection = Mock()
		self.puller.nem_db.connection.cursor.return_value = cursor

		account_1 = AccountRefreshRecord(1, Address('TBZWVEKB2XMTO4F3RAOEIBWRBMPQ5N23G56ZJM4I'))
		account_2 = AccountRefreshRecord(2, Address('TCJLCZSOQ6RGWHTPSV2DW467WZSHK4NBSITND4OF'))
		account_3 = AccountRefreshRecord(5, Address('TALICE6XEEEOBFJVY3ZCENZ7WBG6LB4KB7P7KMQX'))

		mock_get_accounts_for_refresh.side_effect = [
			[account_1, account_2],
			[account_3],
			[]
		]

		account_info_1 = Mock()
		account_info_1.address = account_1.address
		account_info_1.importance = 0.1
		account_info_1.vested_balance = 6449.201816
		account_info_1.remote_status = 'ACTIVE'

		account_info_2 = Mock()
		account_info_2.address = account_2.address
		account_info_2.importance = 0.2
		account_info_2.vested_balance = 1234.000001
		account_info_2.remote_status = 'INACTIVE'

		account_info_3 = Mock()
		account_info_3.address = account_3.address
		account_info_3.importance = 0.3
		account_info_3.vested_balance = 0
		account_info_3.remote_status = 'DEACTIVATING'

		mock_retry_get_account_info.side_effect = [
			account_info_1,
			account_info_2,
			account_info_3
		]

		# Act:
		result = asyncio.run(self.puller.refresh_accounts(2))

		# Assert:
		self.assertEqual(result, 3)

		get_accounts_for_refresh_calls = mock_get_accounts_for_refresh.call_args_list
		self.assertEqual(len(get_accounts_for_refresh_calls), 3)
		self.assertEqual(get_accounts_for_refresh_calls[0][0], (2, 0))
		self.assertEqual(get_accounts_for_refresh_calls[1][0], (2, 2))
		self.assertEqual(get_accounts_for_refresh_calls[2][0], (2, 5))

		retry_get_account_info_calls = mock_retry_get_account_info.call_args_list
		self.assertEqual(len(retry_get_account_info_calls), 3)
		self.assertEqual(retry_get_account_info_calls[0][0], (str(account_1.address),))
		self.assertEqual(retry_get_account_info_calls[1][0], (str(account_2.address),))
		self.assertEqual(retry_get_account_info_calls[2][0], (str(account_3.address),))

		update_account_calls = mock_update_refreshed_account.call_args_list
		self.assertEqual(len(update_account_calls), 3)
		self.assertEqual(update_account_calls[0][0], (
			cursor,
			RefreshedAccountRecord(account_1.address, 0.1, 6449201816, 'ACTIVE')
		))
		self.assertEqual(update_account_calls[1][0], (
			cursor,
			RefreshedAccountRecord(account_2.address, 0.2, 1234000001, 'INACTIVE')
		))
		self.assertEqual(update_account_calls[2][0], (
			cursor,
			RefreshedAccountRecord(account_3.address, 0.3, 0, 'DEACTIVATING')
		))
		self.assertEqual(self.puller.nem_db.connection.commit.call_count, 2)

	@patch('puller.facade.NemPuller.NemDatabase.upsert_namespace')
	def test_can_process_root_namespace(self, mock_upsert_namespace):
		# Arrange:
		namespace_transaction = NEM_CONNECTOR_RESPONSE_BLOCKS[2].transactions[3]

		cursor = Mock()

		# Act:
		self.puller._process_namespace(cursor, namespace_transaction, namespace_transaction.height)  # pylint: disable=protected-access

		# Assert:
		upsert_namespace_calls = mock_upsert_namespace.call_args_list
		self.assertEqual(len(upsert_namespace_calls), 1)
		self.assertEqual(upsert_namespace_calls[0][0], (
			cursor,
			NamespaceRecord(
				root_namespace='namespace',
				owner=PublicKey('a700809530e5428066807ec0d34859c52e260fc60634aaac13e3972dcfc08736'),
				registered_height=3,
				expiration_height=3 + NEM_NAMESPACE_DURATION
			)
		))

	@patch('puller.facade.NemPuller.NemDatabase.update_sub_namespaces')
	def test_can_process_sub_namespace(self, mock_update_sub_namespaces):
		# Arrange:
		namespace_transaction = NamespaceRegistrationTransaction(
			'7e547e45cfc9c34809ce184db6ae7b028360c0f1492cc37b7b4d31c22af07dc3',
			2,
			PublicKey('a700809530e5428066807ec0d34859c52e260fc60634aaac13e3972dcfc08736'),
			150000,
			73397,
			83397,
			'9fc70720d0333d7d8f9eb14ef45ce45a846d37e79cf7a4244b4db36dcb0d3dfe'
			'0170daefbf4d30f92f343110a6f03a14aedcf7913e465a4a1cc199639169410a',
			197,
			1,
			'NAMESPACEWH4MKFMBCVFERDPOOP4FK7MTBXDPZZA',
			100000000,
			'root.root_1',
			'namespace'
		)

		cursor = Mock()

		# Act:
		self.puller._process_namespace(cursor, namespace_transaction, namespace_transaction.height)  # pylint: disable=protected-access

		# Assert:
		update_sub_namespaces_calls = mock_update_sub_namespaces.call_args_list
		self.assertEqual(len(update_sub_namespaces_calls), 1)
		self.assertEqual(update_sub_namespaces_calls[0][0], (
			cursor,
			'root.root_1.namespace',
			'root'
		))

	@patch('puller.facade.NemPuller.NemDatabase.upsert_mosaic')
	def test_can_process_mosaic_definition(self, mock_upsert_mosaic):
		# Arrange:
		mosaic_transaction = NEM_CONNECTOR_RESPONSE_BLOCKS[2].transactions[4]

		cursor = Mock()

		# Act:
		self.puller._process_mosaic_definition(cursor, mosaic_transaction, mosaic_transaction.height)  # pylint: disable=protected-access

		# Assert:
		upsert_mosaic_calls = mock_upsert_mosaic.call_args_list
		self.assertEqual(len(upsert_mosaic_calls), 1)
		self.assertEqual(upsert_mosaic_calls[0][0], (
			cursor,
			MosaicRecord(
				root_namespace='namespace',
				namespace_name='namespace.test',
				description='NEM namespace test',
				creator=PublicKey('a700809530e5428066807ec0d34859c52e260fc60634aaac13e3972dcfc08736'),
				registered_height=3,
				initial_supply=3100000,
				total_supply=3100000,
				divisibility=4,
				supply_mutable=False,
				transferable=True,
				levy_type=1,
				levy_namespace_name='nem.xem',
				levy_fee=500,
				levy_recipient=Address('NBRYCNWZINEVNITUESKUMFIENWKYCRUGNFZV25AV')
			),
		))

	def _assert_mosaic_supply_change(self, mock_update_mosaic_total_supply, supply_type, expected_supply_change):
		# Arrange:
		supply_change_transaction = MosaicSupplyChangeTransaction(
			'cb805b4499479135934e70452d12ad9ecc26c46a111fe0cdda8e09741d257708',
			2,
			PublicKey('da04b4a1d64add6c70958d383f9d247af1aaa957cb89f15b2d059b278e0594d5'),
			150000,
			73397,
			83397,
			'7fef5a89a1c6c98347b8d488a8dd28902e8422680f917c28f3ef0100d394b91c'
			'd85f7cdfd7bdcd6f0cb8089ae9d4e6ef24a8caca35d1cfec7e33c9ccab5e1503',
			165,
			1,
			supply_type,
			500000,
			'namespace.test'
		)

		cursor = Mock()

		# Act:
		self.puller._process_mosaic_supply_change(cursor, supply_change_transaction)  # pylint: disable=protected-access

		# Assert:
		update_total_supply_calls = mock_update_mosaic_total_supply.call_args_list
		self.assertEqual(len(update_total_supply_calls), 1)
		self.assertEqual(update_total_supply_calls[0][0], (
			cursor,
			'namespace.test',
			expected_supply_change
		))

	@patch('puller.facade.NemPuller.NemDatabase.update_mosaic_total_supply')
	def test_can_process_mosaic_supply_change_decrease(self, mock_update_mosaic_total_supply):
		self._assert_mosaic_supply_change(
			mock_update_mosaic_total_supply,
			supply_type=2,
			expected_supply_change=-500000
		)

	@patch('puller.facade.NemPuller.NemDatabase.update_mosaic_total_supply')
	def test_can_process_mosaic_supply_change_increase(self, mock_update_mosaic_total_supply):
		self._assert_mosaic_supply_change(
			mock_update_mosaic_total_supply,
			supply_type=1,
			expected_supply_change=500000
		)

	def _assert_account_key_link(self, mode, expects_remote_address):
		# Arrange:
		transaction = AccountKeyLinkTransaction(
			'a1cd7bc6d3b13d5eb0e1b6a4c40b1e0c2ea6d6f9f3e0c1a7b2d5e8f0a3c6d9e2',
			3,
			PublicKey('da04b4a1d64add6c70958d383f9d247af1aaa957cb89f15b2d059b278e0594d5'),
			150000,
			73397,
			83397,
			'7fef5a89a1c6c98347b8d488a8dd28902e8422680f917c28f3ef0100d394b91c'
			'd85f7cdfd7bdcd6f0cb8089ae9d4e6ef24a8caca35d1cfec7e33c9ccab5e1503',
			165,
			1,
			mode,
			PublicKey('7195f4d7a40ad7e31958ae96c4afed002962229675a4cae8dc8a18e290618981')
		)

		network = self.puller.nem_facade.network
		pending_remote_links = {}

		# Act:
		self.puller._process_account_key_link(transaction, pending_remote_links)  # pylint: disable=protected-access

		# Assert:
		self.assertEqual(pending_remote_links, {
			network.public_key_to_address(transaction.sender):
				network.public_key_to_address(transaction.remote_account) if expects_remote_address else None
		})

	def test_can_process_account_key_link_activate(self):
		self._assert_account_key_link(mode=1, expects_remote_address=True)

	def test_can_process_account_key_link_deactivate(self):
		self._assert_account_key_link(mode=2, expects_remote_address=False)

	def test_can_apply_remote_links_after_accounts_exist(self):
		# Arrange: an account whose link arrives in the same batch in which the account first appears
		network = self.puller.nem_facade.network
		main_address = network.public_key_to_address(
			PublicKey('aa455d831430872feb0c6ae14265209182546c985a321c501be7fdc96ed04757'))
		remote_address = network.public_key_to_address(
			PublicKey('7195f4d7a40ad7e31958ae96c4afed002962229675a4cae8dc8a18e290618981'))
		pending_addresses = {str(main_address): 3}
		pending_remote_links = {main_address: remote_address}
		call_order = []
		# the accumulator is cleared after the flush, so snapshot it at call time
		captured_addresses = []
		cursor = Mock()

		def record_upsert_accounts(_cursor, address_heights):
			captured_addresses.append(dict(address_heights))
			call_order.append('upsert_accounts')

		with patch.object(self.puller, '_process_account_batch', new=AsyncMock()) as mock_process_account_batch, \
			patch('puller.facade.NemPuller.NemDatabase.update_account_remote_address') as mock_update_remote:
			mock_process_account_batch.side_effect = record_upsert_accounts
			mock_update_remote.side_effect = lambda *_: call_order.append('update_remote_address')

			# Act:
			self.puller._flush_pending_account_state(  # pylint: disable=protected-access
				cursor, pending_addresses, {}, pending_remote_links)

		# Assert: the link is written only once the account it belongs to has been upserted
		self.assertEqual(['upsert_accounts', 'update_remote_address'], call_order)
		self.assertEqual([{str(main_address): 3}], captured_addresses)
		mock_update_remote.assert_called_with(cursor, main_address, remote_address)
		self.assertEqual({}, pending_remote_links)

	@patch('puller.facade.NemPuller.NemDatabase.insert_transaction')
	def test_can_process_multisig_account_key_link_links_multisig_account(self, mock_insert_transaction):
		# Arrange:
		multisig_account = PublicKey('fbae41931de6a0cc25153781321f3de0806c7ba9a191474bb9a838118c8de4d3')
		cosignatory = PublicKey('aa455d831430872feb0c6ae14265209182546c985a321c501be7fdc96ed04757')
		remote_account = PublicKey('7195f4d7a40ad7e31958ae96c4afed002962229675a4cae8dc8a18e290618981')

		inner_transaction = AccountKeyLinkTransaction(
			None, None, multisig_account, 750000, 73397, 83397, None, 184, 1, 1, remote_account
		)
		multisig_transaction = MultisigTransaction(
			'3375969dbc2aaae1cad0d89854d4f41b4fef553dbe9c7d39bdf72e3c538f98fe',
			3,
			cosignatory,
			500000,
			73397,
			83397,
			'0e7112b029e030d2d1c7dff79c88a29812f7254422d80e37a7aac5228fff5706'
			'133500b0119a1327cab8787416b5873cc873e3181066c46cb2b108c5da10d90f',
			468,
			1,
			[],
			inner_transaction,
			'edcc8d1c48165f5b771087fbe3c4b4d41f5f8f6c4ce715e050b86fb4e7fdeb64'
		)

		mock_insert_transaction.return_value = 1
		cursor = Mock()
		network = self.puller.nem_facade.network
		pending_remote_links = {}

		# Act:
		self.puller._process_transactions(  # pylint: disable=protected-access
			cursor, [multisig_transaction], 3, pending_remote_links)

		# Assert: the link belongs to the multisig account, not to the cosignatory that announced it
		self.assertEqual(pending_remote_links, {
			network.public_key_to_address(multisig_account): network.public_key_to_address(remote_account)
		})

	def _assert_transaction_record(self, transaction, payload, recipient_address=None):
		# Act:
		record = self.puller._build_transaction_record(transaction, False)  # pylint: disable=protected-access

		# Assert:
		self.assertEqual(record, TransactionRecord(
			transaction_hash=transaction.transaction_hash,
			height=3,
			sender_public_key=transaction.sender,
			fee=transaction.fee,
			timestamp='2015-03-29 20:29:42+00:00',
			deadline='2015-03-29 23:16:22+00:00',
			signature=transaction.signature,
			transaction_type=transaction.transaction_type,
			is_inner=False,
			sender_address=self.puller.nem_facade.network.public_key_to_address(transaction.sender),
			recipient_address=recipient_address,
			payload=payload,
			size=transaction.size,
			version=transaction.version
		))

	def test_can_build_transaction_record_transfer(self):
		# Arrange:
		transaction = NEM_CONNECTOR_RESPONSE_BLOCKS[2].transactions[1]

		self._assert_transaction_record(
			transaction, {
				'message': {
					'payload': '476f6f64206c75636b21',
					'type': 1
				}
			},
			recipient_address=transaction.recipient
		)

	def test_can_build_transaction_record_transfer_without_message(self):
		# Arrange:
		transaction = NEM_CONNECTOR_RESPONSE_BLOCKS[2].transactions[1]

		transaction.message = None

		self._assert_transaction_record(
			transaction,
			{'message': None},
			recipient_address=transaction.recipient
		)

	def test_can_build_transaction_record_account_key_link(self):
		# Arrange:
		transaction = NEM_CONNECTOR_RESPONSE_BLOCKS[2].transactions[0]

		self._assert_transaction_record(
			transaction, {
				'mode': 1,
				'remote_account': '7195F4D7A40AD7E31958AE96C4AFED002962229675A4CAE8DC8A18E290618981'
			})

	def test_can_build_transaction_record_multisig_account_modification(self):
		# Arrange:
		transaction = NEM_CONNECTOR_RESPONSE_BLOCKS[2].transactions[2]

		self._assert_transaction_record(
			transaction, {
				'min_cosignatories': 2,
				'modifications': [
					{
						'modification_type': 1,
						'cosignatory_account': '1FBDBDDE28DAF828245E4533765726F0B7790E0B7146E2CE205DF3E86366980B'
					},
					{
						'modification_type': 1,
						'cosignatory_account': 'F94E8702EB1943B23570B1B83BE1B81536DF35538978820E98BFCE8F999E2D37'
					}
				]
			}
		)

	def test_can_build_transaction_record_multisig(self):
		# Arrange:
		transaction = NEM_CONNECTOR_RESPONSE_BLOCKS[2].transactions[6]

		self._assert_transaction_record(
			transaction, {
				'inner_hash': transaction.inner_hash,
				'signatures': [
					{
						'transaction_type': signature.transaction_type,
						'timestamp': '2023-07-12 17:06:10+00:00',
						'deadline': '2023-07-13 17:06:10+00:00',
						'fee': signature.fee,
						'other_hash': signature.other_hash,
						'other_account': str(signature.other_account),
						'sender': str(signature.sender),
						'signature': signature.signature
					} for signature in transaction.signatures
				]
			}
		)

	def test_can_build_transaction_record_namespace_registration(self):
		# Arrange:
		transaction = NEM_CONNECTOR_RESPONSE_BLOCKS[2].transactions[3]

		self._assert_transaction_record(
			transaction, {
				'rental_fee': transaction.rental_fee,
				'parent': transaction.parent,
				'namespace': transaction.namespace,
			},
			recipient_address=transaction.rental_fee_sink
		)

	def test_can_build_transaction_record_mosaic_definition(self):
		# Arrange:
		transaction = NEM_CONNECTOR_RESPONSE_BLOCKS[2].transactions[4]

		self._assert_transaction_record(
			transaction, {
				'creation_fee': transaction.creation_fee,
				'creator': str(transaction.sender),
				'description': transaction.description,
				'namespace_name': transaction.namespace_name,
				'mosaic_properties': {
					'divisibility': transaction.properties.divisibility,
					'initial_supply': transaction.properties.initial_supply,
					'supply_mutable': transaction.properties.supply_mutable,
					'transferable': transaction.properties.transferable
				},
				'levy': {
					'type': transaction.levy.type,
					'namespace_name': transaction.levy.namespace_name,
					'fee': transaction.levy.fee,
					'recipient': str(transaction.levy.recipient)
				}
			},
			recipient_address=transaction.creation_fee_sink
		)

	def test_can_build_transaction_record_mosaic_definition_without_levy(self):
		# Arrange:
		mosaic_definition = NEM_CONNECTOR_RESPONSE_BLOCKS[2].transactions[4]

		transaction = MosaicDefinitionTransaction(
			mosaic_definition.transaction_hash,
			mosaic_definition.height,
			mosaic_definition.sender,
			mosaic_definition.fee,
			mosaic_definition.timestamp,
			mosaic_definition.deadline,
			mosaic_definition.signature,
			mosaic_definition.size,
			mosaic_definition.version,
			mosaic_definition.creation_fee,
			mosaic_definition.creation_fee_sink,
			mosaic_definition.creator,
			mosaic_definition.description,
			mosaic_definition.properties,
			None,
			mosaic_definition.namespace_name
		)

		self._assert_transaction_record(
			transaction, {
				'creation_fee': transaction.creation_fee,
				'creator': str(transaction.sender),
				'description': transaction.description,
				'namespace_name': transaction.namespace_name,
				'mosaic_properties': {
					'divisibility': transaction.properties.divisibility,
					'initial_supply': transaction.properties.initial_supply,
					'supply_mutable': transaction.properties.supply_mutable,
					'transferable': transaction.properties.transferable
				},
				'levy': None
			},
			recipient_address=transaction.creation_fee_sink
		)

	def test_can_build_transaction_record_mosaic_supply_change(self):
		# Arrange:
		transaction = NEM_CONNECTOR_RESPONSE_BLOCKS[2].transactions[5]

		self._assert_transaction_record(
			transaction, {
				'supply_type': transaction.supply_type,
				'delta': transaction.delta,
				'namespace_name': transaction.namespace_name
			})

	@patch('puller.facade.NemPuller.NemPuller._build_transaction_record')
	@patch('puller.facade.NemPuller.NemDatabase.insert_transaction')
	@patch('puller.facade.NemPuller.NemDatabase.insert_transaction_mosaic')
	def test_can_process_transaction_transfer(self, mock_insert_transaction_mosaic, mock_insert_transaction, mock_build_transaction_record):
		# Arrange:
		mock_insert_transaction.return_value = 1  # Simulate inserted transaction ID for linking mosaics
		transfer = NEM_CONNECTOR_RESPONSE_BLOCKS[2].transactions[1]

		transaction = TransferTransaction(
			transfer.transaction_hash,
			transfer.height,
			transfer.sender,
			transfer.fee,
			transfer.timestamp,
			transfer.deadline,
			transfer.signature,
			transfer.size,
			transfer.version,
			1999999,
			transfer.recipient,
			transfer.message,
			[
				Mosaic('namespace.test', 20),
				Mosaic('nem.xem', 8000000)
			]
		)

		cursor = Mock()

		# Act:
		self.puller._process_transaction(cursor, transaction, 3, is_inner=False, pending_remote_links={})  # pylint: disable=protected-access

		# Assert:
		mock_build_transaction_record.assert_called_once()
		mock_insert_transaction.assert_called_once()
		insert_transaction_mosaic_calls = mock_insert_transaction_mosaic.call_args_list
		expected_mosaics = [
			Mosaic('namespace.test', 39),
			Mosaic('nem.xem', 15999992)
		]
		for index, mosaic in enumerate(expected_mosaics):
			self.assertEqual(insert_transaction_mosaic_calls[index][0], (
				cursor,
				1,  # transaction_id from insert_transaction mock
				mosaic
			))

	@patch('puller.facade.NemPuller.NemPuller._build_transaction_record')
	@patch('puller.facade.NemPuller.NemDatabase.insert_transaction')
	@patch('puller.facade.NemPuller.NemDatabase.insert_transaction_mosaic')
	def test_can_process_transaction_transfer_without_mosaic(
		self,
		mock_insert_transaction_mosaic,
		mock_insert_transaction,
		mock_build_transaction_record
	):
		# Arrange:
		transaction = NEM_CONNECTOR_RESPONSE_BLOCKS[2].transactions[1]

		cursor = Mock()

		# Act:
		self.puller._process_transaction(cursor, transaction, 3, is_inner=False, pending_remote_links={})  # pylint: disable=protected-access

		# Assert:
		mock_build_transaction_record.assert_called_once()
		mock_insert_transaction.assert_called_once()
		mock_insert_transaction_mosaic.assert_called_once_with(
			cursor,
			mock_insert_transaction.return_value,
			Mosaic('nem.xem', transaction.amount)
		)

	@patch('puller.facade.NemPuller.NemPuller._build_transaction_record')
	@patch('puller.facade.NemPuller.NemDatabase.insert_transaction')
	@patch('puller.facade.NemPuller.NemPuller._process_namespace')
	def test_can_process_transaction_namespace_registration(
		self,
		mock_process_namespace,
		mock_insert_transaction,
		mock_build_transaction_record
	):
		# Arrange:
		transaction = NEM_CONNECTOR_RESPONSE_BLOCKS[2].transactions[3]

		cursor = Mock()

		# Act:
		self.puller._process_transaction(cursor, transaction, 3, is_inner=False, pending_remote_links={})  # pylint: disable=protected-access

		# Assert:
		mock_build_transaction_record.assert_called_once()
		mock_insert_transaction.assert_called_once()
		mock_process_namespace.assert_called_once_with(cursor, transaction, 3)

	@patch('puller.facade.NemPuller.NemPuller._build_transaction_record')
	@patch('puller.facade.NemPuller.NemDatabase.insert_transaction')
	@patch('puller.facade.NemPuller.NemPuller._process_mosaic_definition')
	def test_can_process_transaction_mosaic_definition(
		self,
		mock_process_mosaic_definition,
		mock_insert_transaction,
		mock_build_transaction_record
	):
		# Arrange:
		transaction = NEM_CONNECTOR_RESPONSE_BLOCKS[2].transactions[4]

		cursor = Mock()

		# Act:
		self.puller._process_transaction(cursor, transaction, 3, is_inner=False, pending_remote_links={})  # pylint: disable=protected-access

		# Assert:
		mock_build_transaction_record.assert_called_once()
		mock_insert_transaction.assert_called_once()
		mock_process_mosaic_definition.assert_called_once_with(cursor, transaction, 3)

	@patch('puller.facade.NemPuller.NemPuller._build_transaction_record')
	@patch('puller.facade.NemPuller.NemDatabase.insert_transaction')
	@patch('puller.facade.NemPuller.NemPuller._process_mosaic_supply_change')
	def test_can_process_transaction_mosaic_supply_change(
		self,
		mock_process_mosaic_supply_change,
		mock_insert_transaction,
		mock_build_transaction_record
	):
		# Arrange:
		transaction = NEM_CONNECTOR_RESPONSE_BLOCKS[2].transactions[5]

		cursor = Mock()

		# Act:
		self.puller._process_transaction(cursor, transaction, 3, is_inner=False, pending_remote_links={})  # pylint: disable=protected-access

		# Assert:
		mock_build_transaction_record.assert_called_once()
		mock_insert_transaction.assert_called_once()
		mock_process_mosaic_supply_change.assert_called_once_with(cursor, transaction)

	@patch('puller.facade.NemPuller.NemPuller._process_transaction')
	def test_can_process_transactions_inner_outer(self, mock_process_transaction):
		# Arrange:
		block_data = NEM_CONNECTOR_RESPONSE_BLOCKS[2]

		block = Block(
			block_data.height,
			block_data.timestamp,
			[
				block_data.transactions[6]
			],
			block_data.difficulty,
			block_data.block_hash,
			block_data.total_fee,
			block_data.beneficiary,
			block_data.signer,
			block_data.signature,
			block_data.size
		)

		cursor = Mock()
		pending_remote_links = {}

		# Act:
		self.puller._process_transactions(  # pylint: disable=protected-access
			cursor, block.transactions, block.height, pending_remote_links)

		# Assert:
		process_transaction_calls = mock_process_transaction.call_args_list
		self.assertEqual(len(process_transaction_calls), 2)  # 1 for outer transaction, 1 for inner transaction

		# Ensure the inner transaction is correctly linked to the outer transaction
		self.assertEqual(block.transactions[0].other_transaction.height, block.transactions[0].height)
		self.assertEqual(block.transactions[0].other_transaction.transaction_hash, block.transactions[0].inner_hash)

		# first call is inner transaction, pointing back at the aggregate that owns it
		self.assertEqual(process_transaction_calls[0][0], (cursor,))
		self.assertEqual(process_transaction_calls[0][1], {
			'transaction': block.transactions[0].other_transaction,
			'block_height': 3,
			'is_inner': True,
			'pending_remote_links': pending_remote_links,
			'aggregate_hash': block.transactions[0].transaction_hash
		})

		# second call is outer transaction
		self.assertEqual(process_transaction_calls[1][0], (cursor,))
		self.assertEqual(process_transaction_calls[1][1], {
			'transaction': block.transactions[0],
			'block_height': 3,
			'is_inner': False,
			'pending_remote_links': pending_remote_links
		})

	def _run_detect_rollback_test(
		self,
		database_hashes_map,
		node_block_hashes_map,
		db_height,
		chain_height
	):
		self.puller.nem_db.get_block_hash = Mock(
			side_effect=lambda height: database_hashes_map.get(height, 'db-hash')
		)
		self.puller._retry_get_block = AsyncMock(  # pylint: disable=protected-access
			side_effect=lambda height: Mock(
				**node_block_hashes_map.get(
					height,
					NodeBlockHashes('chain-hash', 'chain-previous-hash')
				)._asdict()
			)
		)

		# Act:
		return asyncio.run(self.puller.detect_rollback(db_height, chain_height))

	def test_returns_none_when_comparison_hash_matches(self):
		# Act + Assert: no exception
		self._run_detect_rollback_test(
			{2: '012345', 3: 'ABCDEF'},
			{3: NodeBlockHashes('abcdef', '012345')},
			3,
			3
		)

	def test_returns_chain_height_when_database_is_ahead(self):
		# Arrange + Act:
		fork_height = self._run_detect_rollback_test(
			{2: 'parent', 3: 'common'},
			{3: NodeBlockHashes('common', 'parent')},
			5,
			3
		)

		# Assert:
		self.assertEqual(3, fork_height)

	def test_walks_back_when_only_current_block_hash_matches(self):
		# Arrange + Act:
		fork_height = self._run_detect_rollback_test(
			{1: 'parent', 2: 'common', 3: 'same-current'},
			{
				2: NodeBlockHashes('common', 'parent'),
				3: NodeBlockHashes('SAME-CURRENT', 'different-parent')
			},
			3,
			3
		)

		# Assert:
		self.assertEqual(2, fork_height)
		self.assertEqual(
			[call(3), call(2)],
			self.puller._retry_get_block.await_args_list  # pylint: disable=protected-access
		)

	def test_returns_none_when_nemesis_hash_matches(self):
		# Act + Assert: no exception
		self._run_detect_rollback_test(
			{1: 'common'},
			{1: NodeBlockHashes('COMMON', 'unused')},
			1,
			1
		)
		self.puller.nem_db.get_block_hash.assert_called_once_with(1)

	def test_walks_back_without_checking_parent_when_current_hash_does_not_match(self):
		fork_height = self._run_detect_rollback_test(
			{
				1: 'parent',
				2: 'common',
				3: 'database-fork'
			},
			{
				2: NodeBlockHashes('COMMON', 'PARENT'),
				3: NodeBlockHashes('node-fork', 'common')
			},
			3,
			3
		)

		self.assertEqual(2, fork_height)
		self.assertEqual(
			[call(3), call(2), call(1)],
			self.puller.nem_db.get_block_hash.call_args_list
		)

	def test_common_block_at_360_block_boundary_is_allowed(self):
		# Arrange:
		db_height = NEM_MAX_ROLLBACK_DEPTH + 1

		# Act:
		fork_height = self._run_detect_rollback_test(
			{1: 'common'},
			{1: NodeBlockHashes('COMMON', 'unused')},
			db_height,
			db_height
		)

		# Assert:
		self.assertEqual(1, fork_height)

	def test_no_matching_block_hash_within_360_blocks_requires_manual_investigation(self):
		# Arrange:
		db_height = NEM_MAX_ROLLBACK_DEPTH + 1
		expected_message = (
			f'No matching NEM block hash found within {NEM_MAX_ROLLBACK_DEPTH} blocks '
			f'(database height: {db_height}, chain height: {db_height}); '
			'manual investigation is required'
		)

		# Act + Assert:
		with self.assertRaises(NemRollbackError) as context:
			self._run_detect_rollback_test({}, {}, db_height, db_height)

		self.assertEqual(expected_message, str(context.exception))

	@staticmethod
	def _create_rollback_account(address, height):
		return AccountRecord(address, height, None, None, 0, 0, 0, [], 0, 'INACTIVE', None, [], [])

	@staticmethod
	def _create_rollback_transaction(
		transaction_id,
		transaction_type,
		height,
		sender_address,
		recipient_address=None,
		payload=None,
		is_inner=False
	):  # pylint: disable=too-many-arguments,too-many-positional-arguments
		return TransactionRecord(
			f'{transaction_id:064X}',
			height,
			PublicKey('11' * 32),
			0,
			'2015-03-29 00:00:00+00:00',
			'2015-03-29 01:00:00+00:00',
			None,
			transaction_type,
			is_inner,
			sender_address,
			recipient_address,
			payload,
			100,
			1
		)

	@staticmethod
	def _create_surviving_account_rollback_impact(address, height=1):
		return NemRollbackImpact(
			fork_height=10,
			affected_accounts={address},
			account_creation_heights={address: height},
			orphan_created_accounts=set(),
			surviving_affected_accounts={address},
			orphan_harvested_fees_map={},
			affected_remote_link_accounts=set(),
			affected_namespace_roots=set(),
			affected_mosaic_names=set()
		)

	def test_extracts_multisig_account_and_all_signature_senders(self):
		# Arrange:
		multisig_account = Address('TAWUGAUSWSVB35T5QE44ICIK2WE3AUOTSGZBO5O4')
		first_signature_sender = PublicKey(
			'f94e8702eb1943b23570b1b83be1b81536df35538978820e98bfce8f999e2d37'
		)
		second_signature_sender = PublicKey(
			'1fbdbdde28daf828245e4533765726f0b7790e0b7146e2ce205df3e86366980b'
		)
		transaction = self._create_rollback_transaction(
			1,
			TransactionType.MULTISIG.value,
			11,
			Address('TCJLCZSOQ6RGWHTPSV2DW467WZSHK4NBSITND4OF'),
			payload={'signatures': [
				{
					'other_account': str(multisig_account),
					'sender': str(first_signature_sender)
				},
				{
					'other_account': str(multisig_account),
					'sender': str(second_signature_sender)
				}
			]}
		)

		# Act:
		accounts = self.puller._extract_affected_payload_accounts(  # pylint: disable=protected-access
			transaction
		)

		# Assert:
		expected_accounts = RollbackPayloadAccounts({
			multisig_account,
			Address('TANIBAXPVLBP37YXSGREVD77NXIFZML5FANIVEXX'),
			Address('TADMEHCFJD45GPTDL4HZP2LJLZVAZRLYWY2K4OOH')
		}, set())
		self.assertEqual(expected_accounts, accounts)

	def test_can_capture_all_data_affected_by_rollback(self):  # pylint: disable=too-many-locals
		# Arrange:
		fork_height = 10
		orphan_height = fork_height + 1
		beneficiary = Address('TBZWVEKB2XMTO4F3RAOEIBWRBMPQ5N23G56ZJM4I')
		signer = PublicKey('8d07f90fb4bbe7715fa327c926770166a11be2e494a970605f2e12557f66c9b9')
		signer_address = self.puller._convert_public_key_to_address(signer)  # pylint: disable=protected-access
		sender = Address('TCJLCZSOQ6RGWHTPSV2DW467WZSHK4NBSITND4OF')
		inner_sender = Address('TBKQWJJGPOHL462DBVMTYOAERXGG2BOS5XRFO2P6')
		recipient = Address('TALICE6XEEEOBFJVY3ZCENZ7WBG6LB4KB7P7KMQX')
		remote_key = PublicKey('7195f4d7a40ad7e31958ae96c4afed002962229675a4cae8dc8a18e290618981')
		remote_address = self.puller._convert_public_key_to_address(remote_key)  # pylint: disable=protected-access
		cosignatory_key = PublicKey('1fbdbdde28daf828245e4533765726f0b7790e0b7146e2ce205df3e86366980b')
		cosignatory_address = self.puller._convert_public_key_to_address(cosignatory_key)  # pylint: disable=protected-access
		signature_sender_key = PublicKey(
			'f94e8702eb1943b23570b1b83be1b81536df35538978820e98bfce8f999e2d37'
		)
		signature_sender_address = self.puller._convert_public_key_to_address(  # pylint: disable=protected-access
			signature_sender_key
		)
		multisig_account = Address('TAWUGAUSWSVB35T5QE44ICIK2WE3AUOTSGZBO5O4')
		rental_fee_recipient = Address('TAMESPACEWH4MKFMBCVFERDPOOP4FK7MTDJEYP35')
		creation_fee_recipient = Address('TBMOSAICOD4F54EE5CDMR23CCBGOAM2XSJBR5OLC')
		definition_levy_recipient = Address('NBRYCNWZINEVNITUESKUMFIENWKYCRUGNFZV25AV')
		transfer_levy_recipient = Address('TBEM6SFOHU5PORIGAVG3NNJIMCG73R2TWH35O2VF')

		transactions = [
			self._create_rollback_transaction(
				1, TransactionType.TRANSFER.value, orphan_height, sender, recipient
			),
			self._create_rollback_transaction(
				2,
				TransactionType.ACCOUNT_KEY_LINK.value,
				orphan_height,
				sender,
				payload={'mode': 1, 'remote_account': str(remote_key)}
			),
			self._create_rollback_transaction(
				3,
				TransactionType.MULTISIG_ACCOUNT_MODIFICATION.value,
				orphan_height,
				sender,
				payload={'modifications': [{'cosignatory_account': str(cosignatory_key)}]}
			),
			self._create_rollback_transaction(
				4,
				TransactionType.MULTISIG.value,
				orphan_height,
				sender,
				payload={'signatures': [{
					'other_account': str(multisig_account),
					'sender': str(signature_sender_key)
				}]}
			),
			self._create_rollback_transaction(
				5,
				TransactionType.NAMESPACE_REGISTRATION.value,
				orphan_height,
				sender,
				rental_fee_recipient,
				{'parent': None, 'namespace': 'root'}
			),
			self._create_rollback_transaction(
				6,
				TransactionType.NAMESPACE_REGISTRATION.value,
				orphan_height,
				sender,
				rental_fee_recipient,
				{'parent': 'root.child', 'namespace': 'grandchild'}
			),
			self._create_rollback_transaction(
				7,
				TransactionType.MOSAIC_DEFINITION.value,
				orphan_height,
				sender,
				creation_fee_recipient,
				{
					'namespace_name': 'root.token',
					'levy': {'recipient': str(definition_levy_recipient)}
				}
			),
			self._create_rollback_transaction(
				8,
				TransactionType.MOSAIC_SUPPLY_CHANGE.value,
				orphan_height,
				inner_sender,
				payload={'namespace_name': 'root.supply'},
				is_inner=True
			)
		]
		expected_accounts = {
			beneficiary,
			signer_address,
			sender,
			inner_sender,
			recipient,
			remote_address,
			cosignatory_address,
			multisig_account,
			signature_sender_address,
			rental_fee_recipient,
			creation_fee_recipient,
			definition_levy_recipient,
			transfer_levy_recipient
		}
		expected_account_creation_heights = {
			address: orphan_height if recipient == address else fork_height
			for address in expected_accounts
		}

		with self.puller.nem_db as database:
			database.create_tables()
			cursor = database.connection.cursor()
			database.insert_block(cursor, BlockRecord(
				orphan_height,
				'2015-03-29 00:00:00+00:00',
				20,
				len(transactions),
				1,
				'AA' * 32,
				beneficiary,
				signer,
				'BB' * 64,
				100
			))
			database.insert_block(cursor, BlockRecord(
				orphan_height + 1,
				'2015-03-29 00:01:00+00:00',
				30,
				0,
				1,
				'CC' * 32,
				beneficiary,
				signer,
				'DD' * 64,
				100
			))
			database.upsert_mosaic(cursor, MosaicRecord(
				'levy',
				'levy.token',
				'levy mosaic',
				signer,
				fork_height,
				1,
				1,
				0,
				True,
				True,
				1,
				'nem.xem',
				1,
				transfer_levy_recipient
			))
			transfer_transaction_id = database.insert_transaction(cursor, transactions[0])
			for transaction in transactions[1:]:
				database.insert_transaction(cursor, transaction)
			database.insert_transaction_mosaic(
				cursor,
				transfer_transaction_id,
				Mosaic('levy.token', 1)
			)
			for address, height in expected_account_creation_heights.items():
				database.upsert_account(
					cursor,
					self._create_rollback_account(address, height)
				)
			database.connection.commit()

			# Act:
			capture = self.puller.capture_rollback_impact(fork_height)

		# Assert:
		self.assertEqual(fork_height, capture.fork_height)
		self.assertEqual(expected_accounts, capture.affected_accounts)
		self.assertEqual({recipient}, capture.orphan_created_accounts)
		self.assertEqual(expected_accounts - {recipient}, capture.surviving_affected_accounts)
		self.assertEqual({beneficiary: 50}, capture.orphan_harvested_fees_map)
		self.assertEqual({sender}, capture.affected_remote_link_accounts)
		self.assertEqual({'root'}, capture.affected_namespace_roots)
		self.assertEqual({'root.token', 'root.supply'}, capture.affected_mosaic_names)
		self.assertEqual(expected_account_creation_heights, capture.account_creation_heights)

	def test_rejects_invalid_fork_height_before_reading_database(self):
		with patch.object(self.puller.nem_db, 'get_orphan_chain_records') as mock_get_orphan_chain_records:
			# Act:
			with self.assertRaisesRegex(NemRollbackError, 'Invalid NEM fork height 0'):
				self.puller.capture_rollback_impact(0)

			# Assert:
			mock_get_orphan_chain_records.assert_not_called()

	def test_accepts_empty_multisig_collections(self):
		# Arrange:
		fork_height = 10
		orphan_height = fork_height + 1
		multisig_account = Address('TCJLCZSOQ6RGWHTPSV2DW467WZSHK4NBSITND4OF')
		cosigner = Address('TALICE6XEEEOBFJVY3ZCENZ7WBG6LB4KB7P7KMQX')
		transactions = [
			self._create_rollback_transaction(
				9,
				TransactionType.MULTISIG_ACCOUNT_MODIFICATION.value,
				orphan_height,
				multisig_account,
				payload={'modifications': []}
			),
			self._create_rollback_transaction(
				10,
				TransactionType.MULTISIG.value,
				orphan_height,
				cosigner,
				payload={'signatures': []}
			)
		]

		with self.puller.nem_db as database:
			database.create_tables()
			cursor = database.connection.cursor()
			for transaction in transactions:
				database.insert_transaction(cursor, transaction)
			for address in (multisig_account, cosigner):
				database.upsert_account(cursor, self._create_rollback_account(address, fork_height))
			database.connection.commit()

			# Act:
			impact = self.puller.capture_rollback_impact(fork_height)

		# Assert:
		expected_accounts = {multisig_account, cosigner}
		self.assertEqual(fork_height, impact.fork_height)
		self.assertEqual(expected_accounts, impact.affected_accounts)
		self.assertEqual({
			multisig_account: fork_height,
			cosigner: fork_height
		}, impact.account_creation_heights)
		self.assertEqual(set(), impact.orphan_created_accounts)
		self.assertEqual(expected_accounts, impact.surviving_affected_accounts)
		self.assertEqual({}, impact.orphan_harvested_fees_map)
		self.assertEqual(set(), impact.affected_remote_link_accounts)
		self.assertEqual(set(), impact.affected_namespace_roots)
		self.assertEqual(set(), impact.affected_mosaic_names)

	def test_rejects_affected_account_without_creation_height(self):
		# Arrange:
		fork_height = 10
		beneficiary = Address('TBZWVEKB2XMTO4F3RAOEIBWRBMPQ5N23G56ZJM4I')
		signer = PublicKey('8d07f90fb4bbe7715fa327c926770166a11be2e494a970605f2e12557f66c9b9')

		with self.puller.nem_db as database:
			database.create_tables()
			cursor = database.connection.cursor()
			database.insert_block(cursor, BlockRecord(
				fork_height + 1,
				'2015-03-29 00:00:00+00:00',
				0,
				0,
				1,
				'CC' * 32,
				beneficiary,
				signer,
				'DD' * 64,
				100
			))
			database.connection.commit()

			# Act + Assert:
			expected_message = 'Missing creation heights for 2 affected NEM account'
			with self.assertRaisesRegex(NemRollbackError, expected_message):
				self.puller.capture_rollback_impact(fork_height)

	def test_prefetches_current_state_for_surviving_affected_accounts(self):
		# Arrange:
		first_survivor = Address('TALICE6XEEEOBFJVY3ZCENZ7WBG6LB4KB7P7KMQX')
		second_survivor = Address('TCJLCZSOQ6RGWHTPSV2DW467WZSHK4NBSITND4OF')
		first_account_record = Mock()
		second_account_record = Mock()
		accounts_by_address = {
			str(first_survivor): first_account_record,
			str(second_survivor): second_account_record
		}
		self.puller._fetch_account_record = AsyncMock(  # pylint: disable=protected-access
			side_effect=lambda address, _height: accounts_by_address[address]
		)

		rollback_impact = NemRollbackImpact(
			fork_height=10,
			affected_accounts={first_survivor, second_survivor},
			account_creation_heights={first_survivor: 2, second_survivor: 5},
			orphan_created_accounts={},
			surviving_affected_accounts={first_survivor, second_survivor},
			orphan_harvested_fees_map={},
			affected_remote_link_accounts=set(),
			affected_namespace_roots=set(),
			affected_mosaic_names=set()
		)

		# Act:
		account_state = asyncio.run(self.puller.prefetch_rollback_account_state(rollback_impact))

		# Assert:
		self.assertEqual({
			first_survivor: first_account_record,
			second_survivor: second_account_record
		}, account_state)
		self.assertCountEqual(
			[(str(first_survivor), 2), (str(second_survivor), 5)],
			[call.args for call in self.puller._fetch_account_record.await_args_list]  # pylint: disable=protected-access
		)

	def test_accepts_complete_rollback_account_state(self):
		# Arrange:
		address = Address('TALICE6XEEEOBFJVY3ZCENZ7WBG6LB4KB7P7KMQX')
		rollback_impact = self._create_surviving_account_rollback_impact(address)
		account_state = {address: self._create_rollback_account(address, 1)}

		# Act + Assert: no exception
		self.puller._validate_rollback_account_state(  # pylint: disable=protected-access
			rollback_impact,
			account_state
		)

	def test_rejects_rollback_account_state_with_missing_snapshot(self):
		# Arrange:
		address = Address('TALICE6XEEEOBFJVY3ZCENZ7WBG6LB4KB7P7KMQX')
		rollback_impact = self._create_surviving_account_rollback_impact(address)

		# Act + Assert:
		with self.assertRaisesRegex(NemRollbackError, 'Rollback account snapshot does not match surviving affected accounts'):
			self.puller._validate_rollback_account_state(rollback_impact, {})  # pylint: disable=protected-access

	def test_rejects_rollback_account_state_with_mismatched_address(self):
		# Arrange:
		address = Address('TALICE6XEEEOBFJVY3ZCENZ7WBG6LB4KB7P7KMQX')
		other_address = Address('TCJLCZSOQ6RGWHTPSV2DW467WZSHK4NBSITND4OF')
		rollback_impact = self._create_surviving_account_rollback_impact(address)
		account_state = {address: self._create_rollback_account(other_address, 1)}

		# Act + Assert:
		with self.assertRaisesRegex(NemRollbackError, f'Rollback account snapshot address mismatch for {address}'):
			self.puller._validate_rollback_account_state(  # pylint: disable=protected-access
				rollback_impact,
				account_state
			)

	def test_rejects_rollback_account_state_with_mismatched_height(self):
		# Arrange:
		address = Address('TALICE6XEEEOBFJVY3ZCENZ7WBG6LB4KB7P7KMQX')
		rollback_impact = self._create_surviving_account_rollback_impact(address)
		account_state = {address: self._create_rollback_account(address, 2)}

		# Act + Assert:
		with self.assertRaisesRegex(NemRollbackError, f'Rollback account snapshot height mismatch for {address}'):
			self.puller._validate_rollback_account_state(  # pylint: disable=protected-access
				rollback_impact,
				account_state
			)

	def test_can_restore_rollback_remote_address_from_surviving_key_link(self):
		# Arrange:
		account = Address('TALICE6XEEEOBFJVY3ZCENZ7WBG6LB4KB7P7KMQX')
		surviving_remote_key = PublicKey('7195f4d7a40ad7e31958ae96c4afed002962229675a4cae8dc8a18e290618981')
		orphan_remote_key = PublicKey('1fbdbdde28daf828245e4533765726f0b7790e0b7146e2ce205df3e86366980b')
		surviving_remote_address = self.puller._convert_public_key_to_address(  # pylint: disable=protected-access
			surviving_remote_key
		)
		orphan_remote_address = self.puller._convert_public_key_to_address(  # pylint: disable=protected-access
			orphan_remote_key
		)
		rollback_impact = self._create_surviving_account_rollback_impact(account)._replace(
			fork_height=1,
			affected_remote_link_accounts={account}
		)

		with self.puller.nem_db as database:
			database.create_tables()
			cursor = database.connection.cursor()

			database.upsert_account(
				cursor,
				self._create_rollback_account(account, 1)._replace(remote_address=orphan_remote_address)
			)
			database.insert_transaction(
				cursor,
				self._create_rollback_transaction(
					1,
					TransactionType.ACCOUNT_KEY_LINK.value,
					1,
					account,
					payload={'mode': 1, 'remote_account': str(surviving_remote_key)}
				)
			)

			# Act:
			self.puller._restore_rollback_remote_addresses(  # pylint: disable=protected-access
				cursor,
				rollback_impact
			)

			cursor.execute(
				'SELECT encode(remote_address, \'hex\') FROM accounts WHERE address = %s',
				(account.bytes,)
			)
			remote_address = cursor.fetchone()[0]

		# Assert:
		self.assertEqual(surviving_remote_address.bytes.hex(), remote_address)

	def test_can_restore_rollback_namespaces_by_replaying_surviving_registrations(self):
		# Arrange:
		owner = PublicKey('11' * 32)
		namespace_registration_records = [
			RollbackNamespaceRegistrationRecord(5, owner, None, 'root'),
			RollbackNamespaceRegistrationRecord(6, owner, 'root', 'child'),
			RollbackNamespaceRegistrationRecord(7, owner, 'root.child', 'grandchild')
		]
		rollback_impact = Mock(
			fork_height=10,
			affected_namespace_roots={'root'}
		)
		database = Mock()
		database.get_surviving_namespace_history.return_value = namespace_registration_records
		cursor = Mock()
		self.puller.nem_db = database

		# Act:
		self.puller._restore_rollback_namespaces(cursor, rollback_impact)  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([
			call.delete_namespaces(cursor, {'root'}),
			call.get_surviving_namespace_history(cursor, 10, {'root'})
		], database.mock_calls[:2])
		database.get_surviving_namespace_history.assert_called_once_with(
			cursor,
			10,
			{'root'}
		)
		database.upsert_namespace.assert_called_once_with(
			cursor,
			NamespaceRecord('root', owner, 5, 5 + NEM_NAMESPACE_DURATION)
		)
		self.assertEqual([
			call(cursor, 'root.child', 'root'),
			call(cursor, 'root.child.grandchild', 'root')
		], database.update_sub_namespaces.call_args_list)

	def test_removes_orphan_root_when_it_has_no_surviving_registration(self):
		# Arrange:
		rollback_impact = Mock(
			fork_height=10,
			affected_namespace_roots={'orphan'}
		)
		database = Mock()
		database.get_surviving_namespace_history.return_value = []
		cursor = Mock()
		self.puller.nem_db = database

		# Act:
		self.puller._restore_rollback_namespaces(cursor, rollback_impact)  # pylint: disable=protected-access

		# Assert:
		database.delete_namespaces.assert_called_once_with(cursor, {'orphan'})
		database.upsert_namespace.assert_not_called()
		database.update_sub_namespaces.assert_not_called()

	def _run_rollback_mosaics_test(self, transactions, namespace_name='root.token'):
		rollback_impact = Mock(
			fork_height=10,
			affected_mosaic_names={namespace_name}
		)
		database = Mock()
		database.get_surviving_mosaic_transactions.return_value = transactions
		cursor = Mock()
		self.puller.nem_db = database

		# Act:
		self.puller._restore_rollback_mosaics(cursor, rollback_impact)  # pylint: disable=protected-access

		# Assert:
		self.assertEqual([
			call.delete_mosaics(cursor, {namespace_name}),
			call.get_surviving_mosaic_transactions(cursor, 10, {namespace_name})
		], database.mock_calls[:2])

		return database, cursor

	def test_can_restore_rollback_mosaic_definition(self):
		# Arrange:
		creator = PublicKey('11' * 32)
		levy_recipient = Address('TALICE6XEEEOBFJVY3ZCENZ7WBG6LB4KB7P7KMQX')
		definition_payload = {
			'namespace_name': 'root.token',
			'description': 'rollback mosaic',
			'mosaic_properties': {
				'initial_supply': 1000,
				'divisibility': 2,
				'supply_mutable': True,
				'transferable': False
			},
			'levy': {
				'type': 1,
				'namespace_name': 'levy.token',
				'fee': 25,
				'recipient': str(levy_recipient)
			}
		}
		transaction = RollbackMosaicRecord(
			TransactionType.MOSAIC_DEFINITION.value,
			5,
			creator,
			definition_payload
		)

		# Act:
		database, cursor = self._run_rollback_mosaics_test([transaction])

		# Assert:
		database.upsert_mosaic.assert_called_once_with(
			cursor,
			MosaicRecord(
				root_namespace='root',
				namespace_name='root.token',
				description='rollback mosaic',
				creator=creator,
				registered_height=5,
				initial_supply=1000,
				total_supply=1000,
				divisibility=2,
				supply_mutable=True,
				transferable=False,
				levy_type=1,
				levy_namespace_name='levy.token',
				levy_fee=25,
				levy_recipient=levy_recipient
			)
		)
		database.update_mosaic_total_supply.assert_not_called()

	def test_can_restore_rollback_mosaic_supply_changes(self):
		# Arrange:
		creator = PublicKey('11' * 32)
		transactions = [
			RollbackMosaicRecord(
				TransactionType.MOSAIC_SUPPLY_CHANGE.value,
				6,
				creator,
				{'namespace_name': 'root.token', 'supply_type': 1, 'delta': 300}
			),
			RollbackMosaicRecord(
				TransactionType.MOSAIC_SUPPLY_CHANGE.value,
				7,
				creator,
				{'namespace_name': 'root.token', 'supply_type': 2, 'delta': 100}
			)
		]

		# Act:
		database, cursor = self._run_rollback_mosaics_test(transactions)

		# Assert:
		database.upsert_mosaic.assert_not_called()
		self.assertEqual([
			call(cursor, 'root.token', 300),
			call(cursor, 'root.token', -100)
		], database.update_mosaic_total_supply.call_args_list)

	def test_removes_orphan_mosaic_when_it_has_no_surviving_transaction(self):
		# Act:
		database, _ = self._run_rollback_mosaics_test([], 'orphan.token')

		# Assert:
		database.upsert_mosaic.assert_not_called()
		database.update_mosaic_total_supply.assert_not_called()

	def test_can_repair_rollback_with_expected_operations(self):
		# Arrange:
		first_address = Address('TALICE6XEEEOBFJVY3ZCENZ7WBG6LB4KB7P7KMQX')
		second_address = Address('TCJLCZSOQ6RGWHTPSV2DW467WZSHK4NBSITND4OF')
		orphan_address = Address('TBKQWJJGPOHL462DBVMTYOAERXGG2BOS5XRFO2P6')
		first_account = Mock()
		second_account = Mock()
		account_state = {
			second_address: second_account,
			first_address: first_account
		}
		rollback_impact = Mock(
			fork_height=123,
			orphan_created_accounts={orphan_address},
			orphan_harvested_fees_map={first_address: 50}
		)
		database = Mock()
		cursor = database.connection.cursor.return_value
		self.puller.nem_db = database

		with patch.object(self.puller, '_validate_rollback_account_state') as mock_validate, patch.object(
			self.puller,
			'_restore_rollback_remote_addresses'
		) as mock_restore_remote_addresses, patch.object(
			self.puller,
			'_restore_rollback_namespaces'
		) as mock_restore_namespaces, patch.object(
			self.puller,
			'_restore_rollback_mosaics'
		) as mock_restore_mosaics:
			# Act:
			self.puller.repair_rollback(rollback_impact, account_state)

			# Assert:
			mock_validate.assert_called_once_with(rollback_impact, account_state)
			database.rollback_account_harvesting.assert_called_once_with(cursor, {first_address: 50}, 123)
			database.delete_orphan_chain_data.assert_called_once_with(cursor, 123)
			self.assertLess(
				database.mock_calls.index(call.rollback_account_harvesting(cursor, {first_address: 50}, 123)),
				database.mock_calls.index(call.delete_orphan_chain_data(cursor, 123))
			)
			database.delete_accounts.assert_called_once_with(cursor, {orphan_address})

			refresh_calls = database.refresh_account_from_snapshot.call_args_list
			self.assertEqual(2, len(refresh_calls))
			self.assertEqual((cursor, first_account), refresh_calls[0][0])
			self.assertEqual((cursor, second_account), refresh_calls[1][0])

			mock_restore_remote_addresses.assert_called_once_with(cursor, rollback_impact)
			mock_restore_namespaces.assert_called_once_with(cursor, rollback_impact)
			mock_restore_mosaics.assert_called_once_with(cursor, rollback_impact)
			database.connection.commit.assert_called_once_with()
			database.connection.rollback.assert_not_called()

	def test_repair_rollback_rolls_back_transaction_on_failure(self):
		# Arrange:
		address = Address('TALICE6XEEEOBFJVY3ZCENZ7WBG6LB4KB7P7KMQX')
		account_state = {address: Mock()}
		rollback_impact = Mock(fork_height=123, orphan_created_accounts=set())
		database = Mock()
		self.puller.nem_db = database

		with patch.object(self.puller, '_validate_rollback_account_state'), patch.object(
			self.puller,
			'_restore_rollback_remote_addresses',
			side_effect=RuntimeError('forced repair failure')
		):
			# Act + Assert:
			with self.assertRaisesRegex(RuntimeError, 'forced repair failure'):
				self.puller.repair_rollback(rollback_impact, account_state)

		database.connection.rollback.assert_called_once_with()
		database.connection.commit.assert_not_called()
