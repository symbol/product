import unittest

from symbolchain.facade.NemFacade import NemFacade

from model.Block import Block


class BlockTest(unittest.TestCase):
	@staticmethod
	def _create_default_block():
		return Block(
			5,
			'2015-03-29 00:06:25',
			0,
			10,
			'100%',
			'1dd9d4d7b6af603d29c082f9aa4e123f07d18154ddbcd7ddc6702491b854c5e4',
			'NALICEPFLZQRZGPRIJTMJOCPWDNECXTNNG7QLSG3'
		)

	def test_can_create_block(self):
		# Act:
		block = self._create_default_block()

		# Assert:
		self.assertEqual(5, block.height)
		self.assertEqual('2015-03-29 00:06:25', block.timestamp)
		self.assertEqual(0, block.total_fees)
		self.assertEqual(10, block.total_transactions)
		self.assertEqual('100%', block.difficulty)
		self.assertEqual('1dd9d4d7b6af603d29c082f9aa4e123f07d18154ddbcd7ddc6702491b854c5e4', block.block_hash)
		self.assertEqual('NALICEPFLZQRZGPRIJTMJOCPWDNECXTNNG7QLSG3', block.signer)

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
