import unittest

from rest.model.Block import BlockView


class BlockTest(unittest.TestCase):
	@staticmethod
	def _create_default_block_view(override=None):
		block_view = BlockView(
			2,
			'2015-03-29 20:39:21',
			15000000,
			1,
			95000000000000,
			'9708256E8A8DFB76EED41DCFA2E47F4AF520B7B3286AFB7F60DCA02851F8A53E',
			'45C1553FB1BE7F25B6F79278B9EDE1129BB9163F3B85883EA90F1C66F497E68B',
			(
				'919AE66A34119B49812B335827B357F86884AB08B628029FD6E8DB3572FAEB4F'
				'323A7BF9488C76EF8FAA5B513036BBCCE2D949BA3E41086D95A54C0007403C0B'
			)
		)

		if override:
			setattr(block_view, override[0], override[1])

		return block_view

	def test_can_create_block_view(self):
		# Act:
		block_view = self._create_default_block_view()

		# Assert:
		self.assertEqual(2, block_view.height)
		self.assertEqual('2015-03-29 20:39:21', block_view.timestamp)
		self.assertEqual(15000000, block_view.total_fees)
		self.assertEqual(1, block_view.total_transactions)
		self.assertEqual(95000000000000, block_view.difficulty)
		self.assertEqual('9708256E8A8DFB76EED41DCFA2E47F4AF520B7B3286AFB7F60DCA02851F8A53E', block_view.block_hash)
		self.assertEqual('45C1553FB1BE7F25B6F79278B9EDE1129BB9163F3B85883EA90F1C66F497E68B', block_view.signer)
		self.assertEqual(
			'919AE66A34119B49812B335827B357F86884AB08B628029FD6E8DB3572FAEB4F'
			'323A7BF9488C76EF8FAA5B513036BBCCE2D949BA3E41086D95A54C0007403C0B',
			block_view.signature
		)

	def test_can_convert_to_simple_dict(self):
		# Arrange:
		block_view = self._create_default_block_view()

		# Act:
		block_view_dict = block_view.to_dict()

		# Assert:
		self.assertEqual({
			'height': 2,
			'timestamp': '2015-03-29 20:39:21',
			'totalFees': 15000000,
			'totalTransactions': 1,
			'difficulty': 95000000000000,
			'hash': '9708256E8A8DFB76EED41DCFA2E47F4AF520B7B3286AFB7F60DCA02851F8A53E',
			'signer': '45C1553FB1BE7F25B6F79278B9EDE1129BB9163F3B85883EA90F1C66F497E68B',
			'signature': (
				'919AE66A34119B49812B335827B357F86884AB08B628029FD6E8DB3572FAEB4F'
				'323A7BF9488C76EF8FAA5B513036BBCCE2D949BA3E41086D95A54C0007403C0B'
			)
		}, block_view_dict)

	def test_eq_is_supported(self):
		# Arrange:
		block_view = self._create_default_block_view()

		# Assert:
		self.assertEqual(block_view, self._create_default_block_view())
		self.assertNotEqual(block_view, None)
		self.assertNotEqual(block_view, 'block_view')
		self.assertNotEqual(block_view, self._create_default_block_view(('height', 3)))
		self.assertNotEqual(block_view, self._create_default_block_view(('timestamp', '2015-03-29 20:39:22')))
		self.assertNotEqual(block_view, self._create_default_block_view(('total_fees', 15000001)))
		self.assertNotEqual(block_view, self._create_default_block_view(('total_transactions', 2)))
		self.assertNotEqual(block_view, self._create_default_block_view(('difficulty', 95000000000001)))
		self.assertNotEqual(block_view, self._create_default_block_view(('block_hash', 'random hash')))
		self.assertNotEqual(block_view, self._create_default_block_view(('signer', 'random signer')))
		self.assertNotEqual(block_view, self._create_default_block_view(('signature', 'random signature')))
