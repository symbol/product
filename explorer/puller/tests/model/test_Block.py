import unittest

from symbolchain.facade.NemFacade import NemFacade

from model.Block import Block


class BlockTest(unittest.TestCase):
	@staticmethod
	def _create_default_block():
		return Block(
			1,
			'2015-03-29 00:06:25',
			0,
			5,
			100000000000000,
			'438cf6375dab5a0d32f9b7bf151d4539e00a590f7c022d5572c7d41815a24be4',
			'8d07f90fb4bbe7715fa327c926770166a11be2e494a970605f2e12557f66c9b9',
			'2abdd19ad3efab0413b42772a586faa19dedb16d35f665f90d598046a2132c4ad1e71001545ceaa44e63c04345591e7aadbfd330af82a0d8a1da5643e791ff0f'
		)

	def test_can_create_block(self):
		# Act:
		block = self._create_default_block()

		# Assert:
		self.assertEqual(1, block.height)
		self.assertEqual('2015-03-29 00:06:25', block.timestamp)
		self.assertEqual(0, block.total_fees)
		self.assertEqual(5, block.total_transactions)
		self.assertEqual(100000000000000, block.difficulty)
		self.assertEqual('438cf6375dab5a0d32f9b7bf151d4539e00a590f7c022d5572c7d41815a24be4', block.block_hash)
		self.assertEqual('8d07f90fb4bbe7715fa327c926770166a11be2e494a970605f2e12557f66c9b9', block.signer)
		self.assertEqual(
			'2abdd19ad3efab0413b42772a586faa19dedb16d35f665f90d598046a2132c4ad1e71001545ceaa44e63c04345591e7aadbfd330af82a0d8a1da5643e791ff0f',
			block.signature
		)

	def test_convert_timestamp_to_datetime(self):
		# Arrange:
		nem_facade = NemFacade('mainnet')

		# Act:
		timestamp = Block.convert_timestamp_to_datetime(nem_facade, 0)

		# Assert:
		self.assertEqual('2015-03-29 00:06:25', timestamp)

	def test_can_compare_equal_blocks(self):
		# Arrange:
		block1 = self._create_default_block()
		block2 = self._create_default_block()

		# Act + Assert:
		self.assertEqual(block1, block2)

	def test_can_compare_unequal_blocks(self):
		# Arrange:
		block1 = self._create_default_block()
		block2 = self._create_default_block()
		block2.height = 6

		# Act + Assert:
		self.assertNotEqual(block1, block2)
