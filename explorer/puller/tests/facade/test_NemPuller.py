import asyncio
import datetime
import tempfile
import unittest
from unittest.mock import AsyncMock, Mock, patch

import testing.postgresql
from symbolchain.CryptoTypes import PublicKey
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

from puller.facade.NemPuller import AccountRecord, DatabaseConfig, MosaicRecord, NamespaceRecord, NemPuller, TransactionRecord

# region test data

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
				180000040000000,
				Address('NCOPERAWEWCD4A34NP5UQCCKEX44MW4SL3QYJYS5'),
				('476f6f64206c75636b21', 1),
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
	def test_can_sync_nemesis_block(self, mock_process_transactions, mock_account_mosaics, mock_account_info, mock_get_block):
		# Arrange:
		sender_address = Address('TALICE6XEEEOBFJVY3ZCENZ7WBG6LB4KB7P7KMQX')
		recipient_address = Address('NCOPERAWEWCD4A34NP5UQCCKEX44MW4SL3QYJYS5')
		signer_address = Address('TBEM6SFOHU5PORIGAVG3NNJIMCG73R2TWH35O2VF')

		mock_get_block.return_value = NEM_CONNECTOR_RESPONSE_BLOCKS[0]
		mock_account_info.side_effect = [
			NemAccountInfo(sender_address),
			NemAccountInfo(recipient_address),
			NemAccountInfo(signer_address)
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
				[sender_address.bytes.hex(), recipient_address.bytes.hex(), signer_address.bytes.hex()],
				[row[0] for row in account_results],
			)
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

			call_args = mock_process_account_batch.call_args_list[0]
			addresses = call_args[0][1]
			self.assertEqual(len(addresses), 19)

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

			process_harvested_fees_calls = mock_process_harvested_fees.call_args_list
			self.assertEqual(len(process_harvested_fees_calls), 2)
			self.assertEqual(process_harvested_fees_calls[0][0][1], ({Address('T' + 'A' * 39): (1000000, 5)}))
			self.assertEqual(process_harvested_fees_calls[1][0][1], ({Address('T' + 'A' * 39): (1000000, 5)}))

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
		mock_account_info.assert_called_once_with(address, False)

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

	def test_can_extract_addresses_from_block_with_only_signer(self):
		# Arrange:
		block = NEM_CONNECTOR_RESPONSE_BLOCKS[1]

		# Act:
		addresses = self.puller._extract_addresses_from_block(block)  # pylint: disable=protected-access

		# Assert:
		self.assertEqual(addresses, {'TALICE6XEEEOBFJVY3ZCENZ7WBG6LB4KB7P7KMQX'})

	def test_can_extract_addresses_from_block(self):
		# Arrange:
		block = NEM_CONNECTOR_RESPONSE_BLOCKS[2]

		# Act:
		addresses = self.puller._extract_addresses_from_block(block)  # pylint: disable=protected-access

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
			'TADMEHCFJD45GPTDL4HZP2LJLZVAZRLYWY2K4OOH'
		})

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
		addresses = {
			str(NEM_CONNECTOR_RESPONSE_ACCOUNT_INFO.address),
		}

		# Act:
		asyncio.run(self.puller._process_account_batch(cursor, addresses))  # pylint: disable=protected-access

		# Assert:
		mock_account_info.assert_called_once_with(str(NEM_CONNECTOR_RESPONSE_ACCOUNT_INFO.address), False)
		mock_account_mosaics.assert_called_once_with(str(NEM_CONNECTOR_RESPONSE_ACCOUNT_INFO.address))
		mock_upsert_account.assert_called_once_with(
			cursor,
			AccountRecord(
				mosaics=[{
					'namespace': 'nem.xem',
					'quantity': 8000000
				}],
				remote_address=None,
				**vars(NEM_CONNECTOR_RESPONSE_ACCOUNT_INFO)
			)
		)

	@patch('puller.facade.NemPuller.NemConnector.account_info')
	@patch('puller.facade.NemPuller.NemConnector.account_mosaics')
	@patch('puller.facade.NemPuller.NemDatabase.upsert_account')
	def test_can_process_account_batch_with_remote_status(self, mock_upsert_account, mock_account_mosaics, mock_account_info):
		# Arrange:
		account = NEM_CONNECTOR_RESPONSE_ACCOUNT_INFO
		account.remote_status = 'REMOTE'

		remote_account = NemAccountInfo(Address('TBKQWJJGPOHL462DBVMTYOAERXGG2BOS5XRFO2P6'))

		mock_account_info.side_effect = [
			account,
			remote_account
		]

		mock_account_mosaics.side_effect = [
			[AccountMosaic(('nem', 'xem'), 0)],
			[AccountMosaic(('nem', 'xem'), 1000000)]  # for remote account
		]

		cursor = Mock()
		addresses = {
			str(account.address),
		}

		# Act:
		asyncio.run(self.puller._process_account_batch(cursor, addresses))  # pylint: disable=protected-access

		# Assert:
		account_info_calls = mock_account_info.call_args_list
		self.assertEqual(len(account_info_calls), 2)
		self.assertEqual(account_info_calls[0][0], (str(account.address), False))
		self.assertEqual(account_info_calls[1][0], (str(account.address), True))

		account_mosaics_calls = mock_account_mosaics.call_args_list
		self.assertEqual(len(account_mosaics_calls), 2)
		self.assertEqual(account_mosaics_calls[0][0], (str(account.address),))
		self.assertEqual(account_mosaics_calls[1][0], (str(remote_account.address),))

		upsert_account_calls = mock_upsert_account.call_args_list
		self.assertEqual(len(upsert_account_calls), 2)
		self.assertEqual(upsert_account_calls[0][0], (
			cursor,
			AccountRecord(
				mosaics=[{
					'namespace': 'nem.xem',
					'quantity': 0
				}],
				remote_address=None,
				**vars(account)
			),
		))
		self.assertEqual(upsert_account_calls[1][0], (
			cursor,
			AccountRecord(
				mosaics=[{
					'namespace': 'nem.xem',
					'quantity': 1000000
				}],
				remote_address=account.address,
				**vars(remote_account)
			),
		))

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
				expiration_height=3 + (365 * 1440)
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

	def _assert_transaction_record(self, transaction, payload, amount=None, recipient_address=None):
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
			amount=amount,
			signature=transaction.signature,
			transaction_type=transaction.transaction_type,
			is_inner=False,
			inner_transaction_id=None,
			sender_address=self.puller.nem_facade.network.public_key_to_address(transaction.sender),
			recipient_address=recipient_address,
			payload=payload
		))

	def test_can_build_transaction_record_transfer(self):
		# Arrange:
		transaction = NEM_CONNECTOR_RESPONSE_BLOCKS[2].transactions[1]

		self._assert_transaction_record(
			transaction, {
				'message': {
					'payload': '476f6f64206c75636b21',
					'is_plain': 1
				}
			},
			amount=180000040000000,
			recipient_address=transaction.recipient
		)

	def test_can_build_transaction_record_transfer_without_message(self):
		# Arrange:
		transaction = NEM_CONNECTOR_RESPONSE_BLOCKS[2].transactions[1]

		transaction.message = None

		self._assert_transaction_record(
			transaction,
			{'message': None},
			amount=180000040000000,
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
			transfer.amount,
			transfer.recipient,
			transfer.message,
			[
				Mosaic('namespace.test', 1000000),
				Mosaic('nem.xem', 8000000)
			]
		)

		cursor = Mock()

		# Act:
		self.puller._process_transaction(cursor, transaction, 3, is_inner=False)  # pylint: disable=protected-access

		# Assert:
		mock_build_transaction_record.assert_called_once()
		mock_insert_transaction.assert_called_once()
		insert_transaction_mosaic_calls = mock_insert_transaction_mosaic.call_args_list
		for index, mosaic in enumerate(transaction.mosaics):
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
		self.puller._process_transaction(cursor, transaction, 3, is_inner=False)  # pylint: disable=protected-access

		# Assert:
		mock_build_transaction_record.assert_called_once()
		mock_insert_transaction.assert_called_once()
		mock_insert_transaction_mosaic.assert_not_called()

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
		self.puller._process_transaction(cursor, transaction, 3, is_inner=False)  # pylint: disable=protected-access

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
		self.puller._process_transaction(cursor, transaction, 3, is_inner=False)  # pylint: disable=protected-access

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
		self.puller._process_transaction(cursor, transaction, 3, is_inner=False)  # pylint: disable=protected-access

		# Assert:
		mock_build_transaction_record.assert_called_once()
		mock_insert_transaction.assert_called_once()
		mock_process_mosaic_supply_change.assert_called_once_with(cursor, transaction)

	@patch('puller.facade.NemPuller.NemPuller._process_transaction')
	def test_can_process_transactions_inner_outer(self, mock_process_transaction):
		# Arrange:
		mock_process_transaction.return_value = 1  # Simulate inserted transaction ID for linking inner transactions
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

		# Act:
		self.puller._process_transactions(cursor, block.transactions, block.height)  # pylint: disable=protected-access

		# Assert:
		process_transaction_calls = mock_process_transaction.call_args_list
		self.assertEqual(len(process_transaction_calls), 2)  # 1 for outer transaction, 1 for inner transaction

		# Ensure the inner transaction is correctly linked to the outer transaction
		self.assertEqual(block.transactions[0].other_transaction.height, block.transactions[0].height)
		self.assertEqual(block.transactions[0].other_transaction.transaction_hash, block.transactions[0].inner_hash)

		# first call is inner transaction
		self.assertEqual(process_transaction_calls[0][0], (cursor,))
		self.assertEqual(process_transaction_calls[0][1], {
			'transaction': block.transactions[0].other_transaction,
			'block_height': 3,
			'is_inner': True
		})

		# second call is outer transaction
		self.assertEqual(process_transaction_calls[1][0], (cursor,))
		self.assertEqual(process_transaction_calls[1][1], {
			'transaction': block.transactions[0],
			'block_height': 3,
			'is_inner': False,
			'inner_transaction_id': 1
		})
