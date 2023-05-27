import unittest
from test_data import BLOCK_AT_PUBLIC, CHAIN_BLOCK_1, CHAIN_BLOCK_2
from unittest.mock import AsyncMock, MagicMock

from symbolchain.facade.NemFacade import NemFacade

from model.Block import Block
from workflows.sync_nem_block import save_nemesis_block, sync_blocks


class SyncNemBlockTest(unittest.IsolatedAsyncioTestCase):

	async def test_save_nemesis_block(self):

		# Arrange:
		nem_client_mock = AsyncMock()
		nem_client_mock.get_block.return_value = BLOCK_AT_PUBLIC
		databases_mock = MagicMock()
		nem_facade = NemFacade('mainnet')

		expected_block = Block(
			1,
			Block.convert_timestamp_to_datetime(nem_facade, 0),
			0,
			0,
			0,
			'#',
			'NANEMOABLAGR72AZ2RV3V4ZHDCXW25XQ73O7OBT5'  # Expected address from the signer public key
		)

		# Act:
		await save_nemesis_block(nem_client_mock, databases_mock, nem_facade)

		# Assert:
		self.assertEqual(databases_mock.insert_block.call_count, 1)
		self.assertEqual(databases_mock.insert_block.call_args[0][0], expected_block.to_dict())

	async def test_sync_blocks(self):
		# Arrange:
		nem_client_mock = AsyncMock()
		nem_client_mock.get_blocks_after.return_value = {
			'data': [CHAIN_BLOCK_1, CHAIN_BLOCK_2]
		}

		databases_mock = MagicMock()
		nem_facade = NemFacade('mainnet')

		db_height = 1
		chain_height = 2

		expected_block_1 = Block(
			2,
			Block.convert_timestamp_to_datetime(nem_facade, 73976),
			0,
			0,
			100000000000000,
			'1dd9d4d7b6af603d29c082f9aa4e123f07d18154ddbcd7ddc6702491b854c5e4',
			'NALICEPFLZQRZGPRIJTMJOCPWDNECXTNNG7QLSG3'  # Expected address from the signer public key
		)

		expected_block_2 = Block(
			3,
			Block.convert_timestamp_to_datetime(nem_facade, 73976),
			0,
			0,
			90250000000000,
			'9708256e8a8dfb76eed41dcfa2e47f4af520b7b3286afb7f60dca02851f8a53e',
			'NALICE6XEEEOBFJVY3ZCENZ7WBG6LB4KB6CQNYKR'  # Expected address from the signer public key
		)

		# Act:
		await sync_blocks(nem_client_mock, databases_mock, db_height, chain_height, nem_facade)

		# Assert:
		self.assertEqual(nem_client_mock.get_blocks_after.call_count, 1)
		self.assertEqual(databases_mock.insert_block.call_count, 2)
		self.assertEqual(databases_mock.insert_block.call_args_list[0][0][0], expected_block_1.to_dict())
		self.assertEqual(databases_mock.insert_block.call_args_list[1][0][0], expected_block_2.to_dict())
