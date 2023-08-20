import unittest
from collections import namedtuple

import testing.postgresql

from rest.db.NemDatabase import NemDatabase
from rest.facade.NemRestFacade import NemRestFacade

from ..test.DatabaseTestUtils import initialize_database

DatabaseConfig = namedtuple('DatabaseConfig', ['database', 'user', 'password', 'host', 'port'])

# region test data

Expected_Block_1 = {
	'height': 1,
	'timestamp': '2015-03-29 00:06:25',
	'totalFees': 102000000,
	'totalTransactions': 5,
	'difficulty': 100000000000000,
	'hash': '438cf6375dab5a0d32f9b7bf151d4539e00a590f7c022d5572c7d41815a24be4',
	'signer': '8d07f90fb4bbe7715fa327c926770166a11be2e494a970605f2e12557f66c9b9',
	'signature': (
		'2abdd19ad3efab0413b42772a586faa19dedb16d35f665f90d598046a2132c4a'
		'd1e71001545ceaa44e63c04345591e7aadbfd330af82a0d8a1da5643e791ff0f'
	)
}

Expected_Block_2 = {
	'height': 2,
	'timestamp': '2015-03-29 20:34:19',
	'totalFees': 201000000,
	'totalTransactions': 3,
	'difficulty': 80000000000000,
	'hash': '1dd9d4d7b6af603d29c082f9aa4e123f07d18154ddbcd7ddc6702491b854c5e4',
	'signer': 'f9bd190dd0c364261f5c8a74870cc7f7374e631352293c62ecc437657e5de2cd',
	'signature': (
		'1b81379847241e45da86b27911e5c9a9192ec04f644d98019657d32838b49c14'
		'3eaa4815a3028b80f9affdbf0b94cd620f7a925e02783dda67b8627b69ddf70e'
	)
}

# endregion


class TestNemRestFacade(unittest.TestCase):

	@classmethod
	def setUpClass(cls):
		cls.postgresql = testing.postgresql.Postgresql()
		cls.db_config = DatabaseConfig(**cls.postgresql.dsn(), password='')
		initialize_database(cls.db_config)

	@classmethod
	def tearDownClass(cls):
		cls.postgresql.stop()

	def test_can_create_facade(self):
		# Arrange + Act:
		nem_rest_facade = NemRestFacade(self.db_config)

		# Assert:
		self.assertIsInstance(nem_rest_facade.nem_db, NemDatabase)

	def _assert_can_retrieve_block(self, height, expected_block):
		# Arrange:
		nem_rest_facade = NemRestFacade(self.db_config)

		# Act:
		block = nem_rest_facade.get_block(height)

		# Assert:
		self.assertEqual(block, expected_block)

	def _assert_can_retrieve_blocks(self, limit, offset, min_height, expected_blocks):
		# Arrange:
		nem_rest_facade = NemRestFacade(self.db_config)

		# Act:
		blocks = nem_rest_facade.get_blocks(limit, offset, min_height)

		# Assert:
		self.assertEqual(blocks, expected_blocks)

	def test_retrieve_block_by_height(self):
		self._assert_can_retrieve_block(1, Expected_Block_1)

	def test_returns_none_for_nonexistent_block(self):
		self._assert_can_retrieve_block(3, None)

	def test_blocks_filtered_by_limit(self):
		self._assert_can_retrieve_blocks(1, 0, 0, [Expected_Block_1])

	def test_blocks_filtered_by_offset(self):
		self._assert_can_retrieve_blocks(1, 1, 0, [Expected_Block_2])

	def test_blocks_filtered_by_min_height(self):
		self._assert_can_retrieve_blocks(10, 0, 2, [Expected_Block_2])

	def test_returns_empty_list_on_no_matches(self):
		self._assert_can_retrieve_blocks(10, 0, 3, [])
