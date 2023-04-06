import unittest

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

	def test_can_convert_to_simple_dict(self):
		# Arrange:
		block = self._create_default_block()

		# Act:
		block_dict = block.to_dict()

		# Assert:
		self.assertEqual({
			'height': 5,
			'timestamp': '2015-03-29 00:06:25',
			'totalFees': 0,
			'totalTransactions': 10,
			'difficulty': '100%',
			'hash': '1dd9d4d7b6af603d29c082f9aa4e123f07d18154ddbcd7ddc6702491b854c5e4',
			'signer': 'NALICEPFLZQRZGPRIJTMJOCPWDNECXTNNG7QLSG3'
		}, block_dict)

	def test_convert_timestamp_to_datetime(self):
		# Act:
		timestamp = Block.convert_timestamp_to_datetime(0)

		# Assert:
		self.assertEqual('2015-03-29 00:06:25', timestamp)
