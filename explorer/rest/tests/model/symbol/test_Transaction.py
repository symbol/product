from datetime import datetime
from unittest import TestCase

from common.symbol.NativeMosaic import NativeMosaicInfo
from symbolchain.sc import TransactionType

from rest.db.SymbolDatabase import TransactionMosaicRecord, TransactionRecord
from rest.model.symbol.Transaction import SymbolTransactionView

NATIVE_MOSAIC_INFO = NativeMosaicInfo('72C0212E67A08BCE', 6)
SENDER_ADDRESS = bytes.fromhex('9889432DE263BB8FE88444A4DA28D3609BD8BB8FAE18AE95')
RECIPIENT_ADDRESS = bytes.fromhex('98534F7E1D0A26CA4E316F901E23E55C8701DB20DF11A7B2')


def _create_transaction(**overrides):
	transaction = TransactionRecord(
		1,
		bytes.fromhex('ab' * 32),
		False,
		None,
		None,
		1234,
		TransactionType.TRANSFER.value,
		SENDER_ADDRESS,
		RECIPIENT_ADDRESS,
		0,
		datetime(2026, 6, 9, 0, 0),
		'plain',
		'48656C6C6F',
		())
	return transaction._replace(**overrides)


class SymbolTransactionViewTest(TestCase):
	def test_to_dict_formats_complete_top_level_transaction_from_saved_values(self):
		# Arrange:
		transaction = _create_transaction(
			aggregate_hash=bytes.fromhex('ef' * 32),
			embedded_index=5,
			mosaics=(
				TransactionMosaicRecord('72c0212e67a08bce', 1234567, 'transfer', 0, None, []),
				TransactionMosaicRecord('1234567890abcdef', 12345, 'transfer', 1, 2, ['alpha', 'beta']),
				TransactionMosaicRecord('abcdef0123456789', 54321, 'transfer', 2, None, None),
				TransactionMosaicRecord('fedcba9876543210', 5, 'transfer', 3, 0, [])
			))

		# Act:
		result = SymbolTransactionView(transaction).to_dict(NATIVE_MOSAIC_INFO)

		# Assert:
		self.assertEqual({
			'hash': 'AB' * 32,
			'isEmbedded': False,
			'aggregateHash': None,
			'embeddedIndex': None,
			'height': 1234,
			'type': 'TRANSFER',
			'sender': 'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI',
			'recipient': 'TBJU67Q5BITMUTRRN6IB4I7FLSDQDWZA34I2PMQ',
			'value': [
				{'id': '72C0212E67A08BCE', 'name': '72C0212E67A08BCE', 'amount': 1.234567},
				{'id': '1234567890ABCDEF', 'name': 'alpha', 'amount': 123.45},
				{'id': 'ABCDEF0123456789', 'name': 'ABCDEF0123456789', 'amount': 54321},
				{'id': 'FEDCBA9876543210', 'name': 'FEDCBA9876543210', 'amount': 5.0}
			],
			'amount': 1.234567,
			'fee': 0.0,
			'timestamp': '2026-06-09T00:00:00Z',
			'message': {'type': 'plain', 'text': 'Hello'}
		}, result)

	def test_to_dict_returns_embedded_identity_null_fee_and_saved_timestamp(self):
		# Arrange:
		transaction = _create_transaction(
			hash=bytes.fromhex('ab' * 32),
			is_embedded=True,
			aggregate_hash=bytes.fromhex('cd' * 32),
			embedded_index=0,
			effective_fee=None,
			message_type='encrypted',
			message_payload='00FF',
			mosaics=())

		# Act:
		result = SymbolTransactionView(transaction).to_dict(NATIVE_MOSAIC_INFO)

		# Assert:
		self.assertEqual({
			'hash': None,
			'isEmbedded': True,
			'aggregateHash': 'CD' * 32,
			'embeddedIndex': 0,
			'height': 1234,
			'type': 'TRANSFER',
			'sender': 'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI',
			'recipient': 'TBJU67Q5BITMUTRRN6IB4I7FLSDQDWZA34I2PMQ',
			'value': [],
			'amount': 0,
			'fee': None,
			'timestamp': '2026-06-09T00:00:00Z',
			'message': {'type': 'encrypted', 'text': '00FF'}
		}, result)

	def test_to_dict_returns_null_message_without_saved_payload(self):
		# Arrange:
		transaction = _create_transaction(message_type=None, message_payload=None)

		# Act:
		result = SymbolTransactionView(transaction).to_dict(NATIVE_MOSAIC_INFO)

		# Assert:
		self.assertIsNone(result['message'])

	def test_to_dict_preserves_non_utf8_plain_payload_as_hex(self):
		# Arrange:
		transaction = _create_transaction(message_type='plain', message_payload='FF')

		# Act:
		result = SymbolTransactionView(transaction).to_dict(NATIVE_MOSAIC_INFO)

		# Assert:
		self.assertEqual({'type': 'plain', 'text': 'FF'}, result['message'])
