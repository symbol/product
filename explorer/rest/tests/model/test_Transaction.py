import unittest

from rest.model.Transaction import TransactionView


class TransactionViewTest(unittest.TestCase):
	@staticmethod
	def _create_default_transaction_view(override=None):
		transaction_view = TransactionView(
			transaction_hash='0000000000000000000000000000000000000000000000000000000000000001',
			transaction_type='TRANSFER',
			from_address='TBZWVEKB2XMTO4F3RAOEIBWRBMPQ5N23G56ZJM4I',
			to_address='TCJLCZSOQ6RGWHTPSV2DW467WZSHK4NBSITND4OF',
			value=[
				{
					'namespace': 'nem.xem',
					'amount': 10.5
				}
			],
			embedded_transactions=None,
			fee=3.0,
			height=1000,
			timestamp='2015-03-29 00:06:25',
			deadline='2015-03-29 00:21:25',
			signature='0' * 128
		)

		if override:
			setattr(transaction_view, override[0], override[1])

		return transaction_view

	def test_can_create_transaction_view(self):
		# Act:
		transaction_view = self._create_default_transaction_view()

		# Assert:
		self.assertEqual('0' * 63 + '1', transaction_view.transaction_hash)
		self.assertEqual('TRANSFER', transaction_view.transaction_type)
		self.assertEqual('TBZWVEKB2XMTO4F3RAOEIBWRBMPQ5N23G56ZJM4I', transaction_view.from_address)
		self.assertEqual('TCJLCZSOQ6RGWHTPSV2DW467WZSHK4NBSITND4OF', transaction_view.to_address)
		self.assertEqual([{'namespace': 'nem.xem', 'amount': 10.5}], transaction_view.value)
		self.assertEqual(None, transaction_view.embedded_transactions)
		self.assertEqual(3.0, transaction_view.fee)
		self.assertEqual(1000, transaction_view.height)
		self.assertEqual('2015-03-29 00:06:25', transaction_view.timestamp)
		self.assertEqual('2015-03-29 00:21:25', transaction_view.deadline)
		self.assertEqual('0' * 128, transaction_view.signature)

	def test_can_convert_to_simple_dict(self):
		# Arrange:
		transaction_view = self._create_default_transaction_view()

		# Act:
		transaction_view_dict = transaction_view.to_dict()

		# Assert:
		self.assertEqual({
			'transactionHash': '0000000000000000000000000000000000000000000000000000000000000001',
			'transactionType': 'TRANSFER',
			'fromAddress': 'TBZWVEKB2XMTO4F3RAOEIBWRBMPQ5N23G56ZJM4I',
			'toAddress': 'TCJLCZSOQ6RGWHTPSV2DW467WZSHK4NBSITND4OF',
			'value': [{'namespace': 'nem.xem', 'amount': 10.5}],
			'embeddedTransactions': None,
			'fee': 3.0,
			'height': 1000,
			'timestamp': '2015-03-29 00:06:25',
			'deadline': '2015-03-29 00:21:25',
			'signature': '0' * 128,
		}, transaction_view_dict)

	def test_eq_is_supported(self):
		# Arrange:
		transaction_view = self._create_default_transaction_view()

		# Assert:
		self.assertEqual(transaction_view, self._create_default_transaction_view())
		self.assertNotEqual(transaction_view, None)
		self.assertNotEqual(transaction_view, 'transaction_view')
		self.assertNotEqual(transaction_view, self._create_default_transaction_view(('transaction_hash', '0' * 64)))
		self.assertNotEqual(transaction_view, self._create_default_transaction_view(('transaction_type', 'ACCOUNT_KEY_LINK')))
		self.assertNotEqual(transaction_view, self._create_default_transaction_view(('from_address', 'TCJLCZSOQ6RGWHTPSV2DW467WZSHK4NBSITND4OF')))
		self.assertNotEqual(transaction_view, self._create_default_transaction_view(('to_address', 'TBZWVEKB2XMTO4F3RAOEIBWRBMPQ5N23G56ZJM4I')))
		self.assertNotEqual(transaction_view, self._create_default_transaction_view(('value', [{'namespace': 'nem.other', 'amount': 5.0}])))
		self.assertNotEqual(transaction_view, self._create_default_transaction_view(('embedded_transactions', [None])))
		self.assertNotEqual(transaction_view, self._create_default_transaction_view(('fee', 5000000)))
		self.assertNotEqual(transaction_view, self._create_default_transaction_view(('height', 2000)))
		self.assertNotEqual(transaction_view, self._create_default_transaction_view(('timestamp', '2015-03-29 01:06:25')))
		self.assertNotEqual(transaction_view, self._create_default_transaction_view(('deadline', '2015-03-29 01:21:25')))
		self.assertNotEqual(transaction_view, self._create_default_transaction_view(('signature', 'ABCDEF0123456789ABCDEF0123456789')))
