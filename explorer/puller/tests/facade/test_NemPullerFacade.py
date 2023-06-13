import datetime
import unittest
from tempfile import NamedTemporaryFile
from unittest.mock import AsyncMock

import testing.postgresql

from client.NemClient import NemClient
from db.NemDatabase import NemDatabase
from facade.NemPullerFacade import NemPullerFacade
from tests.test_data import CHAIN_BLOCK_1, CHAIN_BLOCK_2


class NemPullerFacadeTest(unittest.IsolatedAsyncioTestCase):

	def setUp(self):
		self.postgresql = testing.postgresql.Postgresql()
		self.db_config = {
			'database': self.postgresql.url().split('/')[-1],
			'user': 'postgres',
			'password': '',
			'host': self.postgresql.url().split('/')[2].split('@')[1].split(':')[0],
			'port': self.postgresql.url().split('/')[-2].split(':')[-1]
		}

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
			2,
			datetime.datetime(2015, 3, 29, 20, 39, 21),
			0,
			0,
			100000000000000,
			bytes.fromhex('1dd9d4d7b6af603d29c082f9aa4e123f07d18154ddbcd7ddc6702491b854c5e4'),
			bytes.fromhex('f9bd190dd0c364261f5c8a74870cc7f7374e631352293c62ecc437657e5de2cd'),
			bytes.fromhex(
				'fdf6a9830e9320af79123f467fcb03d6beab735575ff50eab363d812c5581436'
				'2ad7be0503db2ee70e60ac3408d83cdbcbd941067a6df703e0c21c7bf389f105')
		)
		self.expected_result_1 = (
			3,
			datetime.datetime(2015, 3, 29, 20, 39, 21),
			0,
			0,
			90250000000000,
			bytes.fromhex('9708256e8a8dfb76eed41dcfa2e47f4af520b7b3286afb7f60dca02851f8a53e'),
			bytes.fromhex('45c1553fb1be7f25b6f79278b9ede1129bb9163f3b85883ea90f1c66f497e68b'),
			bytes.fromhex(
				'919ae66a34119b49812b335827b357f86884ab08b628029fd6e8db3572faeb4f'
				'323a7bf9488c76ef8faa5b513036bbcce2d949ba3e41086d95a54c0007403c0b')
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
		facade = NemPullerFacade(node_url, config_file)

		# Mock nem api endpoint data
		if return_values:
			for method, value in return_values.items():
				setattr(facade._client, method, value)

		return facade

	@staticmethod
	def _convert_memoryview_to_bytes(data):
		# Convert memoryview objects to bytes
		return [tuple(bytes(item) if isinstance(item, memoryview) else item for item in row) for row in data]

	def test_initialization(self):
		# Act:
		facade = self._create_facade_and_setup()

		# Assert:
		self.assertIsInstance(facade.database(), NemDatabase)
		self.assertIsInstance(facade.client(), NemClient)
		self.assertEqual(facade.client().endpoint, 'http://localhost:7890')
		self.assertIsNone(facade.nem_facade)

	async def test_can_setup_facade(self):
		# Arrange:
		facade = self._create_facade_and_setup({
			'node_network': AsyncMock(return_value='mainnet')
		})

		# Act:
		await facade.setup_facade()

		# Assert:
		self.assertIsNotNone(facade.nem_facade)
		self.assertEqual(str(facade.nem_facade.network), 'mainnet')

	async def test_can_insert_nemesis_block(self):
		# Arrange:
		facade = self._create_facade_and_setup({
			'node_network': AsyncMock(return_value='mainnet'),
			'get_block': AsyncMock(return_value=CHAIN_BLOCK_1)
		})

		await facade.setup_facade()

		with facade.database() as databases:
			databases.create_tables()

			# Act:
			await facade.sync_nemesis_block()

			# Assert:
			cursor = facade.nem_db.connection.cursor()

			cursor.execute('SELECT * FROM blocks WHERE height = %s', (2, ))
			result = cursor.fetchone()

			result = self._convert_memoryview_to_bytes([result])[0]

			facade._client.get_block.assert_called_once_with(1)
			self.assertEqual(result, self.expected_result_0)
			self.assertIsNotNone(result)

	async def test_can_insert_blocks(self):
		# Arrange:
		facade = self._create_facade_and_setup({
			'node_network': AsyncMock(return_value='mainnet'),
			'get_blocks_after': AsyncMock(return_value={
				'data': [CHAIN_BLOCK_1, CHAIN_BLOCK_2]
			})
		})

		await facade.setup_facade()

		with facade.database() as databases:
			databases.create_tables()

			# Act:
			await facade.sync_blocks(1, 2)

			# Assert:
			cursor = facade.nem_db.connection.cursor()

			cursor.execute('SELECT * FROM blocks')
			results = cursor.fetchall()

			results = self._convert_memoryview_to_bytes(results)

			facade._client.get_blocks_after.assert_called_once_with(1)
			self.assertEqual(len(results), 2)
			self.assertEqual(results[0], self.expected_result_0)
			self.assertEqual(results[1], self.expected_result_1)

	async def test_skip_block_insert_if_db_height_exceeds_chain_height(self):
		# Arrange:
		facade = self._create_facade_and_setup({
			'node_network': AsyncMock(return_value='mainnet'),
			'get_blocks_after': AsyncMock(return_value={
				'data': [CHAIN_BLOCK_1, CHAIN_BLOCK_2]
			})
		})

		await facade.setup_facade()

		with facade.database() as databases:
			databases.create_tables()

			# Act:
			await facade.sync_blocks(2, 1)

			# Assert:
			cursor = facade.nem_db.connection.cursor()

			cursor.execute('SELECT * FROM blocks')
			results = cursor.fetchall()

			facade._client.get_blocks_after.assert_not_called()
			self.assertEqual(len(results), 0)
