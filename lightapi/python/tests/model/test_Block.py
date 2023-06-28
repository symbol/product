import unittest

from symbollightapi.model.Block import Block


class BlockTest(unittest.TestCase):
	@staticmethod
	def _create_default_block(override=None):
		block = Block(
			10,
			21447079270401,
			[],
			90000000000000,
			'a785cac7259bdd4cf423fd1079cbe0e24e119958a8075f302f9e17a1c407abe0',
			'7e6d6a11c4a79f6eb1f0e3489fd683a9381c8e1bef6bcaedbbc9f03c70b65a57',
			(
				'a4bbf324a3480f58c2d15bdb15d0232da94db9519d5b727a3ea12c11cc11d368'
				'e0037c08e1994bc07adc4f790bcb09c1d727066b0308463e406e175572c4150a'
			)
		)

		if override:
			setattr(block, override[0], override[1])

		return block

	def test_can_create_block(self):
		# Act:
		block = self._create_default_block()

		# Assert:
		self.assertEqual(10, block.height)
		self.assertEqual(21447079270401, block.timestamp)
		self.assertEqual([], block.transactions)
		self.assertEqual(90000000000000, block.difficulty)
		self.assertEqual('a785cac7259bdd4cf423fd1079cbe0e24e119958a8075f302f9e17a1c407abe0', block.block_hash)
		self.assertEqual('7e6d6a11c4a79f6eb1f0e3489fd683a9381c8e1bef6bcaedbbc9f03c70b65a57', block.signer)
		self.assertEqual(
			(
				'a4bbf324a3480f58c2d15bdb15d0232da94db9519d5b727a3ea12c11cc11d368'
				'e0037c08e1994bc07adc4f790bcb09c1d727066b0308463e406e175572c4150a'
			), block.signature)

	def test_eq_is_supported(self):
		# Arrange:
		block = self._create_default_block()

		# Act + Assert:
		self.assertEqual(block, self._create_default_block())
		self.assertNotEqual(block, None)
		self.assertNotEqual(block, 17)
		self.assertNotEqual(block, self._create_default_block(('height', 3)))
		self.assertNotEqual(block, self._create_default_block(('timestamp', 73977)))
		self.assertNotEqual(block, self._create_default_block(('transactions', [1, 2, 3])))
		self.assertNotEqual(block, self._create_default_block(('difficulty', 10000)))
		self.assertNotEqual(block, self._create_default_block(('block_hash', 'invalid hash')))
		self.assertNotEqual(block, self._create_default_block(('signer', 'invalid signer')))
		self.assertNotEqual(block, self._create_default_block(('signature', 'invalid signature')))
