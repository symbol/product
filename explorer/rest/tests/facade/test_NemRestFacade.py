import unittest

import testing.postgresql

from rest.db.NemDatabase import NemDatabase
from rest.facade.NemRestFacade import NemRestFacade

from ..test.DatabaseTestUtils import DatabaseConfig, initialize_database

# region test data

EXPECTED_BLOCK_1 = {
	'height': 1,
	'timestamp': '2015-03-29 00:06:25',
	'totalFees': 102000000,
	'totalTransactions': 5,
	'difficulty': 100000000000000,
	'hash': '438CF6375DAB5A0D32F9B7BF151D4539E00A590F7C022D5572C7D41815A24BE4',
	'signer': '8D07F90FB4BBE7715FA327C926770166A11BE2E494A970605F2E12557F66C9B9',
	'signature': (
		'2ABDD19AD3EFAB0413B42772A586FAA19DEDB16D35F665F90D598046A2132C4A'
		'D1E71001545CEAA44E63C04345591E7AADBFD330AF82A0D8A1DA5643E791FF0F'
	)
}

EXPECTED_BLOCK_2 = {
	'height': 2,
	'timestamp': '2015-03-29 20:34:19',
	'totalFees': 201000000,
	'totalTransactions': 3,
	'difficulty': 80000000000000,
	'hash': '1DD9D4D7B6AF603D29C082F9AA4E123F07D18154DDBCD7DDC6702491B854C5E4',
	'signer': 'F9BD190DD0C364261F5C8A74870CC7F7374E631352293C62ECC437657E5DE2CD',
	'signature': (
		'1B81379847241E45DA86B27911E5C9A9192EC04F644D98019657D32838B49C14'
		'3EAA4815A3028B80F9AFFDBF0B94CD620F7A925E02783DDA67B8627B69DDF70E'
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
		self._assert_can_retrieve_block(1, EXPECTED_BLOCK_1)

	def test_returns_none_for_nonexistent_block(self):
		self._assert_can_retrieve_block(3, None)

	def test_blocks_filtered_by_limit(self):
		self._assert_can_retrieve_blocks(1, 0, 0, [EXPECTED_BLOCK_1])

	def test_blocks_filtered_by_offset(self):
		self._assert_can_retrieve_blocks(1, 1, 0, [EXPECTED_BLOCK_2])

	def test_blocks_filtered_by_min_height(self):
		self._assert_can_retrieve_blocks(10, 0, 2, [EXPECTED_BLOCK_2])

	def test_returns_empty_list_on_no_matches(self):
		self._assert_can_retrieve_blocks(10, 0, 3, [])
