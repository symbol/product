import datetime
import unittest
from tempfile import NamedTemporaryFile
from unittest.mock import AsyncMock

import psycopg2
from symbollightapi.connector.NemConnector import NemConnector
from symbollightapi.model.Block import Block

from puller.db.NemDatabase import NemDatabase
from puller.facade.NemPuller import NemPuller
from tests.utils import create_test_db_config

# region test data


BLOCK_HEIGHT_1 = Block(  # Test data from nem connector
	1,
	73976,
	[],
	100000000000000,
	'1dd9d4d7b6af603d29c082f9aa4e123f07d18154ddbcd7ddc6702491b854c5e4',
	'f9bd190dd0c364261f5c8a74870cc7f7374e631352293c62ecc437657e5de2cd',
	(
		'fdf6a9830e9320af79123f467fcb03d6beab735575ff50eab363d812c5581436'
		'2ad7be0503db2ee70e60ac3408d83cdbcbd941067a6df703e0c21c7bf389f105'
	),
	88
)

BLOCK_HEIGHT_2 = Block(
	2,
	78976,
	[],
	90250000000000,
	'9708256e8a8dfb76eed41dcfa2e47f4af520b7b3286afb7f60dca02851f8a53e',
	'45c1553fb1be7f25b6f79278b9ede1129bb9163f3b85883ea90f1c66f497e68b',
	(
		'919ae66a34119b49812b335827b357f86884ab08b628029fd6e8db3572faeb4f'
		'323a7bf9488c76ef8faa5b513036bbcce2d949ba3e41086d95a54c0007403c0b'
	),
	99
)


# endregion

class NemPullerTest(unittest.IsolatedAsyncioTestCase):

	def setUp(self):
		self.postgresql, self.db_config = create_test_db_config()

		with NamedTemporaryFile(mode='w+t', delete=False) as temp_config_file:
			temp_config_file.write(
				f'[nem_db]\n'
				f'database={self.db_config["database"]}\n'
				f'user={self.db_config["user"]}\n'
				f'password={self.db_config["password"]}\n'
				f'host={self.db_config["host"]}\n'
				f'port={self.db_config["port"]}'
			)
			temp_config_file.flush()

			self.temp_config_file = temp_config_file

		self.expected_result_0 = (
			1,
			datetime.datetime(2015, 3, 29, 12, 39, 21),
			0,
			0,
			100000000000000,
			'1dd9d4d7b6af603d29c082f9aa4e123f07d18154ddbcd7ddc6702491b854c5e4',
			'f9bd190dd0c364261f5c8a74870cc7f7374e631352293c62ecc437657e5de2cd',
			(
				'fdf6a9830e9320af79123f467fcb03d6beab735575ff50eab363d812c5581436'
				'2ad7be0503db2ee70e60ac3408d83cdbcbd941067a6df703e0c21c7bf389f105'
			),
			88
		)
		self.expected_result_1 = (
			2,
			datetime.datetime(2015, 3, 29, 14, 2, 41),
			0,
			0,
			90250000000000,
			'9708256e8a8dfb76eed41dcfa2e47f4af520b7b3286afb7f60dca02851f8a53e',
			'45c1553fb1be7f25b6f79278b9ede1129bb9163f3b85883ea90f1c66f497e68b',
			(
				'919ae66a34119b49812b335827b357f86884ab08b628029fd6e8db3572faeb4f'
				'323a7bf9488c76ef8faa5b513036bbcce2d949ba3e41086d95a54c0007403c0b'
			),
			99
		)

	def tearDown(self):
		# Destroy the temporary PostgreSQL database
		self.postgresql.stop()
		self.temp_config_file.close()

	def _create_facade_and_setup(self, return_values=None):
		# Arrange:
		# Creating facade and setting up the mock data
		node_url = 'http://localhost:7890'
		config_file = self.temp_config_file.name
		facade = NemPuller(node_url, config_file)

		# Mock nem connector data
		if return_values:
			for method, value in return_values.items():
				setattr(facade.nem_connector, method, value)

		return facade

	def test_initialization(self):
		# Act:
		facade = self._create_facade_and_setup()

		# Assert:
		self.assertIsInstance(facade.nem_db, NemDatabase)
		self.assertIsInstance(facade.nem_connector, NemConnector)
		self.assertEqual(facade.nem_connector.endpoint, 'http://localhost:7890')
		self.assertEqual(str(facade.nem_facade.network), 'mainnet')

	def _query_fetch_blocks(self, facade, where_clause='', params=None):  # pylint: disable=no-self-use
		cursor = facade.nem_db.connection.cursor()

		query = (
			'SELECT height, timestamp AT TIME ZONE \'UTC\', '
			'total_fees, total_transactions, difficulty, '
			'encode(hash, \'hex\'), encode(signer, \'hex\'), encode(signature, \'hex\'), size '
			'FROM blocks'
		)

		if where_clause:
			query += f' {where_clause}'

		cursor.execute(query, params or ())
		results = cursor.fetchall()

		return results

	async def test_can_insert_nemesis_block(self):
		# Arrange:
		facade = self._create_facade_and_setup({
			'get_block': AsyncMock(return_value=BLOCK_HEIGHT_1)
		})

		with facade.nem_db as databases:
			databases.create_tables()

			# Act:
			await facade.sync_nemesis_block()

			# Assert:
			results = self._query_fetch_blocks(facade, 'WHERE height = %s', (1, ))

			facade.nem_connector.get_block.assert_called_once_with(1)
			self.assertEqual(results[0], self.expected_result_0)
			self.assertIsNotNone(results[0])

	async def test_can_insert_blocks(self):
		# Arrange:
		facade = self._create_facade_and_setup({
			'get_blocks_after': AsyncMock(return_value=[BLOCK_HEIGHT_1, BLOCK_HEIGHT_2])
		})

		with facade.nem_db as databases:
			databases.create_tables()

			# Act:
			await facade.sync_blocks(1, 2)

			# Assert:
			results = self._query_fetch_blocks(facade)

			facade.nem_connector.get_blocks_after.assert_called_once_with(1)
			self.assertEqual(len(results), 2)
			self.assertEqual(results[0], self.expected_result_0)
			self.assertEqual(results[1], self.expected_result_1)

	async def test_cannot_insert_blocks_when_block_existing_in_database(self):
		# Arrange:
		facade = self._create_facade_and_setup({
			'get_blocks_after': AsyncMock(side_effect=[
				[BLOCK_HEIGHT_1, BLOCK_HEIGHT_2],  # First call
				[BLOCK_HEIGHT_2]  # Second call
			])
		})

		with facade.nem_db as databases:
			databases.create_tables()

			await facade.sync_blocks(1, 2)

			# Act + Assert:
			with self.assertRaises(psycopg2.IntegrityError):
				await facade.sync_blocks(2, 3)

	async def test_skip_block_insert_if_db_height_exceeds_chain_height(self):
		# Arrange:
		facade = self._create_facade_and_setup({
			'get_blocks_after': AsyncMock(return_value=[BLOCK_HEIGHT_1, BLOCK_HEIGHT_2])
		})

		with facade.nem_db as databases:
			databases.create_tables()

			# Act:
			await facade.sync_blocks(2, 1)

			# Assert:
			results = self._query_fetch_blocks(facade)

			facade.nem_connector.get_blocks_after.assert_not_called()
			self.assertEqual(len(results), 0)
