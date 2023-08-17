import unittest

from model.Block import BlockView


class BlockTest(unittest.TestCase):
	@staticmethod
	def _create_default_block_view(override=None):
		block_view = BlockView(
			2,
			'2015-03-29 20:39:21',
			15000000,
			1,
			95000000000000,
			'9708256e8a8dfb76eed41dcfa2e47f4af520b7b3286afb7f60dca02851f8a53e',
			'45c1553fb1be7f25b6f79278b9ede1129bb9163f3b85883ea90f1c66f497e68b',
			(
				'919ae66a34119b49812b335827b357f86884ab08b628029fd6e8db3572faeb4f'
				'323a7bf9488c76ef8faa5b513036bbcce2d949ba3e41086d95a54c0007403c0b'
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
		self.assertEqual('9708256e8a8dfb76eed41dcfa2e47f4af520b7b3286afb7f60dca02851f8a53e', block_view.block_hash)
		self.assertEqual('45c1553fb1be7f25b6f79278b9ede1129bb9163f3b85883ea90f1c66f497e68b', block_view.signer)
		self.assertEqual(
			'919ae66a34119b49812b335827b357f86884ab08b628029fd6e8db3572faeb4f'
			'323a7bf9488c76ef8faa5b513036bbcce2d949ba3e41086d95a54c0007403c0b',
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
			'hash': '9708256e8a8dfb76eed41dcfa2e47f4af520b7b3286afb7f60dca02851f8a53e',
			'signer': '45c1553fb1be7f25b6f79278b9ede1129bb9163f3b85883ea90f1c66f497e68b',
			'signature': (
				'919ae66a34119b49812b335827b357f86884ab08b628029fd6e8db3572faeb4f'
				'323a7bf9488c76ef8faa5b513036bbcce2d949ba3e41086d95a54c0007403c0b'
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
