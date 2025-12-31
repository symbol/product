import asyncio
import datetime
import tempfile
import unittest
from unittest.mock import AsyncMock, Mock, patch

import testing.postgresql
from symbolchain.CryptoTypes import PublicKey
from symbolchain.nem.Network import Address
from symbollightapi.model.Block import Block
from symbollightapi.model.Exceptions import NodeException
from symbollightapi.model.Transaction import (
	AccountKeyLinkTransaction,
	CosignSignatureTransaction,
	Modification,
	MosaicDefinitionTransaction,
	MosaicLevy,
	MosaicProperties,
	MosaicSupplyChangeTransaction,
	MultisigAccountModificationTransaction,
	MultisigTransaction,
	NamespaceRegistrationTransaction,
	TransferTransaction
)

from puller.facade.NemPuller import DatabaseConfig, NemPuller, AccountRecord

# region test data

NEM_CONNECTOR_RESPONSE_BLOCKS = [
	Block(
		1,
		78976,
		[
			TransferTransaction(
				'd6c9902cfa23dbbdd212d720f86391dd91d215bf77d806f03a6c2dd2e730628a',
				2,
				'8d07f90fb4bbe7715fa327c926770166a11be2e494a970605f2e12557f66c9b9',
				9000000,
				73397,
				83397,
				'e0cc7f71e353ca0aaf2f009d74aeac5f97d4796b0f08c009058fb33d93c2e8ca'
				'68c0b63e46ff125f43314014d324ac032d2c82996a6e47068b251f1d71fdd001',
				180000040000000,
				'NCOPERAWEWCD4A34NP5UQCCKEX44MW4SL3QYJYS5',
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
				2,
				'22df5f43ee3739a10c346b3ec2d3878668c5514696be425f9067d3a11c777f1d',
				8000000,
				73397,
				83397,
				'1b81379847241e45da86b27911e5c9a9192ec04f644d98019657d32838b49c14'
				'3eaa4815a3028b80f9affdbf0b94cd620f7a925e02783dda67b8627b69ddf70e',
				1,
				'7195f4d7a40ad7e31958ae96c4afed002962229675a4cae8dc8a18e290618981'
			),
			TransferTransaction(
				'd6c9902cfa23dbbdd212d720f86391dd91d215bf77d806f03a6c2dd2e730628a',
				2,
				'8d07f90fb4bbe7715fa327c926770166a11be2e494a970605f2e12557f66c9b9',
				9000000,
				73397,
				83397,
				'e0cc7f71e353ca0aaf2f009d74aeac5f97d4796b0f08c009058fb33d93c2e8ca'
				'68c0b63e46ff125f43314014d324ac032d2c82996a6e47068b251f1d71fdd001',
				180000040000000,
				'NCOPERAWEWCD4A34NP5UQCCKEX44MW4SL3QYJYS5',
				('476f6f64206c75636b21', 1),
				None
			),
			MultisigAccountModificationTransaction(
				'cc64ca69bfa95db2ff7ac1e21fe6d27ece189c603200ebc9778d8bb80ca25c3c',
				2,
				'f41b99320549741c5cce42d9e4bb836d98c50ed5415d0c3c2912d1bb50e6a0e5',
				40000000,
				73397,
				83397,
				'81ff2235f9ad6f3f8adbc16051bf8691a45ee5ddcace4d6260ce9a2ae63dba59'
				'4f2b486f25451a1f90da7f0e312d9e8570e4bc03798e58d19dec86feb4152307',
				2,
				[
					Modification(1, '1fbdbdde28daf828245e4533765726f0b7790e0b7146e2ce205df3e86366980b'),
					Modification(1, 'f94e8702eb1943b23570b1b83be1b81536df35538978820e98bfce8f999e2d37')
				]
			),
			NamespaceRegistrationTransaction(
				'7e547e45cfc9c34809ce184db6ae7b028360c0f1492cc37b7b4d31c22af07dc3',
				2,
				'a700809530e5428066807ec0d34859c52e260fc60634aaac13e3972dcfc08736',
				150000,
				73397,
				83397,
				'9fc70720d0333d7d8f9eb14ef45ce45a846d37e79cf7a4244b4db36dcb0d3dfe'
				'0170daefbf4d30f92f343110a6f03a14aedcf7913e465a4a1cc199639169410a',
				'NAMESPACEWH4MKFMBCVFERDPOOP4FK7MTBXDPZZA',
				100000000,
				None,
				'namespace'
			),
			MosaicDefinitionTransaction(
				'4725e523e5d5a562121f38953d6da3ae695060533fc0c5634b31de29c3b766e1',
				2,
				'a700809530e5428066807ec0d34859c52e260fc60634aaac13e3972dcfc08736',
				150000,
				73397,
				83397,
				'a80ccd44955ded7d35ee3aa011bfafd3f30cc746f63cb59a9d02171f908a0f4a'
				'0294fcbba0b2838acd184daf1d9ae3c0f645308b442547156364192cd3d2d605',
				10000000,
				'NBMOSAICOD4F54EE5CDMR23CCBGOAM2XSIUX6TRS',
				'a700809530e5428066807ec0d34859c52e260fc60634aaac13e3972dcfc08736',
				'NEM namespace test',
				MosaicProperties(4, 3100000, False, True),
				MosaicLevy(500, 'NBRYCNWZINEVNITUESKUMFIENWKYCRUGNFZV25AV', 1, 'nem.xem'),
				'namespace.test'
			),
			MosaicSupplyChangeTransaction(
				'cb805b4499479135934e70452d12ad9ecc26c46a111fe0cdda8e09741d257708',
				2,
				'da04b4a1d64add6c70958d383f9d247af1aaa957cb89f15b2d059b278e0594d5',
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
				2,
				'aa455d831430872feb0c6ae14265209182546c985a321c501be7fdc96ed04757',
				500000,
				73397,
				83397,
				'0e7112b029e030d2d1c7dff79c88a29812f7254422d80e37a7aac5228fff5706'
				'133500b0119a1327cab8787416b5873cc873e3181066c46cb2b108c5da10d90f',
				[
					CosignSignatureTransaction(
						261593985,
						'edcc8d1c48165f5b771087fbe3c4b4d41f5f8f6c4ce715e050b86fb4e7fdeb64',
						'NAGJG3QFWYZ37LMI7IQPSGQNYADGSJZGJRD2DIYA',
						'ae6754c70b7e3ba0c51617c8f9efd462d0bf680d45e09c3444e817643d277826',
						500000,
						261680385,
						'249bc2dbad96e827eabc991b59dff7f12cc27f3e0da8ab3db6a3201169431786'
						'72f712ba14ed7a3b890e161357a163e7408aa22e1d6d1382ebada57973862706'
					)
				],
				TransferTransaction(
					None,
					None,
					'fbae41931de6a0cc25153781321f3de0806c7ba9a191474bb9a838118c8de4d3',
					750000,
					73397,
					83397,
					None,
					150000000000,
					'NBUH72UCGBIB64VYTAAJ7QITJ62BLISFFQOHVP65',
					None,
					None
				),
				'edcc8d1c48165f5b771087fbe3c4b4d41f5f8f6c4ce715e050b86fb4e7fdeb64'
			)
		],
		300,
		'1dd9d4d7b6af603d29c082f9aa4e123f07d18154ddbcd7ddc6702491b854c5e4',
		'f9bd190dd0c364261f5c8a74870cc7f7374e631352293c62ecc437657e5de2cd',
		(
			'fdf6a9830e9320af79123f467fcb03d6beab735575ff50eab363d812c5581436'
			'2ad7be0503db2ee70e60ac3408d83cdbcbd941067a6df703e0c21c7bf389f105'
		),
		2052
	)
]

NEM_CONNECTOR_RESPONSE_ACCOUNT_INFO = NemAccountInfo(Address('TALICE6XEEEOBFJVY3ZCENZ7WBG6LB4KB7P7KMQX'))

# endregion


class NemPullerTest(unittest.TestCase):

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

	@patch('puller.facade.NemPuller.NemConnector.get_block')
	def test_can_sync_nemesis_block(self, mock_get_block):
		# Arrange:
		mock_get_block.return_value = NEM_CONNECTOR_RESPONSE_BLOCKS[0]

		with self.puller.nem_db as databases:
			databases.create_tables()

			asyncio.run(self.puller.sync_nemesis_block())

			# Assert:
			results = self._query_fetch_blocks(self.puller, 'WHERE height = %s', (1, ))
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

	@patch('puller.facade.NemPuller.NemConnector.get_blocks_after')
	def test_can_sync_blocks(self, mock_get_blocks_after):
		# Arrange:
		mock_get_blocks_after.return_value = NEM_CONNECTOR_RESPONSE_BLOCKS

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
	def test_db_writer_can_commits_in_batches(self, mock_commit_blocks, mock_get_blocks_after):
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
