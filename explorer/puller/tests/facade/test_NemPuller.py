import asyncio
import tempfile
import unittest
from unittest.mock import Mock, patch

import testing.postgresql
from symbollightapi.model.Block import Block
from symbollightapi.model.Transaction import TransferTransaction

from puller.facade.NemPuller import BlockRecord, DatabaseConfig, NemPuller

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
		'block_hash_placeholder',
		'signer_hash_placeholder',
		'signature_hash_placeholder',
		345
	),
	Block(
		2,
		88999,
		[],
		200,
		'block_hash_placeholder',
		'signer_hash_placeholder',
		'signature_hash_placeholder',
		168
	),
]

# endregion


class NemPullerTest(unittest.TestCase):

	def setUp(self):
		self.postgresql = testing.postgresql.Postgresql()
		self.config_ini = self.create_temp_config_file(DatabaseConfig(**self.postgresql.dsn(), password=''))
		self.puller = NemPuller('http://localhost:7890', self.config_ini, 'testnet')
		self.puller.nem_db.connection = Mock()
		self.puller.nem_db.insert_block = Mock()
		self.puller.nem_db.connection.cursor.return_value = Mock()

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

	def test_create_testnet_puller_instance(self):
		# Act:
		puller = NemPuller('http://localhost:7890', self.config_ini, 'testnet')

		# Assert
		self._assert_puller_instance(puller, 'testnet')

	def test_create_mainnet_puller_instance(self):
		# Act:
		puller = NemPuller('http://localhost:7890', self.config_ini, 'mainnet')

		# Assert
		self._assert_puller_instance(puller, 'mainnet')

	@patch('puller.facade.NemPuller.NemConnector.get_block')
	def test_can_sync_nemesis_block(self, mock_get_block):
		# Arrange:
		mock_get_block.return_value = NEM_CONNECTOR_RESPONSE_BLOCKS[0]

		# Act:
		asyncio.run(self.puller.sync_nemesis_block())

		# Assert:
		self.puller.nem_db.connection.cursor.assert_called_once()
		self.puller.nem_db.connection.commit.assert_called_once()
		self.puller.nem_db.insert_block.assert_called_once()

		call_args = self.puller.nem_db.insert_block.call_args
		_, processed_block_1 = call_args[0]

		self.assertEqual(
			BlockRecord(
				1,
				'2015-03-29 22:02:41+00:00',
				9000000,
				1,
				100,
				'block_hash_placeholder',
				'signer_hash_placeholder',
				'signature_hash_placeholder',
				345
			), processed_block_1)

	@patch('puller.facade.NemPuller.NemConnector.get_blocks_after')
	def test_can_sync_blocks(self, mock_get_blocks_after):
		# Arrange:
		mock_get_blocks_after.return_value = NEM_CONNECTOR_RESPONSE_BLOCKS

		# Act:
		asyncio.run(self.puller.sync_blocks(0, 2))

		# Assert:
		self.puller.nem_db.connection.cursor.assert_called_once()
		self.puller.nem_db.connection.commit.assert_called_once()
		self.assertEqual(self.puller.nem_db.insert_block.call_count, 2)

		call_args = self.puller.nem_db.insert_block.call_args_list

		_, processed_block_1 = call_args[0][0]
		_, processed_block_2 = call_args[1][0]

		self.assertEqual(
			BlockRecord(
				1,
				'2015-03-29 22:02:41+00:00',
				9000000,
				1,
				100,
				'block_hash_placeholder',
				'signer_hash_placeholder',
				'signature_hash_placeholder',
				345
			), processed_block_1)
		self.assertEqual(
			BlockRecord(
				2,
				'2015-03-30 00:49:44+00:00',
				0,
				0,
				200,
				'block_hash_placeholder',
				'signer_hash_placeholder',
				'signature_hash_placeholder',
				168
			), processed_block_2)

	def _assert_skip_sync_blocks(self, db_height, chain_height):
		# Act:
		asyncio.run(self.puller.sync_blocks(db_height, chain_height))

		# Assert:
		self.puller.nem_db.connection.cursor.assert_not_called()
		self.puller.nem_db.insert_block.assert_not_called()

	@patch('puller.facade.NemPuller.NemConnector.get_blocks_after')
	def test_can_skip_sync_block_db_height_higher_than_chain_height(self, mock_get_blocks_after):
		# Act & Assert:
		self._assert_skip_sync_blocks(10, 5)
		mock_get_blocks_after.assert_not_called()

	@patch('puller.facade.NemPuller.NemConnector.get_blocks_after')
	def test_can_skip_sync_block_db_height_equal_to_chain_height(self, mock_get_blocks_after):
		# Act & Assert:
		self._assert_skip_sync_blocks(10, 10)
		mock_get_blocks_after.assert_not_called()
