import asyncio
import datetime
import tempfile
import unittest
from unittest.mock import patch

import testing.postgresql
from symbollightapi.model.Block import Block
from symbollightapi.model.Transaction import TransferTransaction

from puller.facade.NemPuller import DatabaseConfig, NemPuller

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
		'f9bd190dd0c364261f5c8a74870cc7f7374e631352293c62ecc437657e5de2cd',
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
		'45c1553fb1be7f25b6f79278b9ede1129bb9163f3b85883ea90f1c66f497e68b',
		(
			'919ae66a34119b49812b335827b357f86884ab08b628029fd6e8db3572faeb4f'
			'323a7bf9488c76ef8faa5b513036bbcce2d949ba3e41086d95a54c0007403c0b'
		),
		168
	),
]

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
			'total_fees, total_transactions, difficulty, '
			'encode(hash, \'hex\'), encode(signer, \'hex\'), encode(signature, \'hex\'), size '
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
			self.assertEqual(len(results), 2)
			self.assertEqual(results[0], (
				1,
				datetime.datetime(2015, 3, 29, 22, 2, 41),
				9000000,
				1,
				100,
				'1dd9d4d7b6af603d29c082f9aa4e123f07d18154ddbcd7ddc6702491b854c5e4',
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
				'45c1553fb1be7f25b6f79278b9ede1129bb9163f3b85883ea90f1c66f497e68b',
				(
					'919ae66a34119b49812b335827b357f86884ab08b628029fd6e8db3572faeb4f'
					'323a7bf9488c76ef8faa5b513036bbcce2d949ba3e41086d95a54c0007403c0b'
				),
				168
			))

	@patch('puller.facade.NemPuller.NemConnector.get_blocks_after')
	@patch('puller.facade.NemPuller.log')
	def test_sync_blocks_raise_error_connector_fail(self, mock_log, mock_get_blocks_after):
		# Arrange:
		mock_get_blocks_after.side_effect = Exception('fail to get blocks')

		with self.puller.nem_db as databases:
			databases.create_tables()

			# Act & Assert:
			with self.assertRaises(Exception):
				asyncio.run(self.puller.sync_blocks(0, 100))

			mock_log.error.assert_called_once_with('Sync error: fail to get blocks')

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
					'b' * 64,  # signer
					'c' * 128,  # signature
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
