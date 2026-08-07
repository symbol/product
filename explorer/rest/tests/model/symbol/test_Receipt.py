from unittest import TestCase

from common.symbol.NativeMosaic import NativeMosaicInfo

from rest.model.symbol.Receipt import SymbolReceiptView

NATIVE_MOSAIC_INFO = NativeMosaicInfo('72C0212E67A08BCE', 6)
TARGET_ADDRESS = bytes.fromhex('9889432DE263BB8FE88444A4DA28D3609BD8BB8FAE18AE95')
SENDER_ADDRESS = bytes.fromhex('98' + '11' * 23)
RECIPIENT_ADDRESS = bytes.fromhex('98' + '22' * 23)


def _create_row(**overrides):
	row = {
		'height': 1234,
		'receipt_type': 'lockHashCreated',
		'receipt_group': 'balanceChange',
		'version': 1,
		'sender_address': None,
		'recipient_address': None,
		'target_address': None,
		'mosaic_id': None,
		'amount': 10,
		'artifact_id': None,
		'mosaic_divisibility': None
	}
	row.update(overrides)
	return row


def _expected_receipt(mosaics, target_address=None, sender=None, recipient=None, artifact_id=None):
	return {
		'version': 1,
		'height': 1234,
		'type': 'lockHashCreated',
		'group': 'balanceChange',
		'targetAddress': target_address,
		'sender': sender,
		'to': recipient,
		'artifactId': artifact_id,
		'mosaics': mosaics
	}


class SymbolReceiptViewTest(TestCase):
	def test_serializes_receipt_without_mosaic(self):
		# Arrange:
		view = SymbolReceiptView(_create_row(), NATIVE_MOSAIC_INFO)

		# Act:
		result = view.to_dict()

		# Assert:
		self.assertEqual(_expected_receipt([]), result)

	def test_formats_native_amount_without_metadata(self):
		# Arrange:
		view = SymbolReceiptView(_create_row(mosaic_id='72c0212e67a08bce', amount=1000000), NATIVE_MOSAIC_INFO)

		# Act:
		result = view.to_dict()

		# Assert:
		self.assertEqual(_expected_receipt([{
			'id': '72C0212E67A08BCE',
			'name': '72C0212E67A08BCE',
			'amount': 1.0,
			'isNative': True
		}]), result)

	def test_formats_non_native_amount_with_metadata(self):
		# Arrange:
		view = SymbolReceiptView(_create_row(
			mosaic_id='abcdef0123456789', amount=12345, mosaic_divisibility=3),
			NATIVE_MOSAIC_INFO)

		# Act:
		result = view.to_dict()

		# Assert:
		self.assertEqual(_expected_receipt([{
			'id': 'ABCDEF0123456789',
			'name': 'ABCDEF0123456789',
			'amount': 12.345,
			'isNative': False
		}]), result)

	def test_keeps_non_native_absolute_amount_without_metadata(self):
		# Arrange:
		view = SymbolReceiptView(_create_row(mosaic_id='abcdef0123456789', amount=12345), NATIVE_MOSAIC_INFO)

		# Act:
		result = view.to_dict()

		# Assert:
		self.assertEqual(_expected_receipt([{
			'id': 'ABCDEF0123456789',
			'name': 'ABCDEF0123456789',
			'amount': 12345,
			'isNative': False
		}]), result)

	def test_formats_addresses_and_artifact_id(self):
		# Arrange:
		view = SymbolReceiptView(_create_row(
			target_address=TARGET_ADDRESS,
			sender_address=SENDER_ADDRESS,
			recipient_address=RECIPIENT_ADDRESS,
			artifact_id='abcdef0123456789'), NATIVE_MOSAIC_INFO)

		# Act:
		result = view.to_dict()

		# Assert:
		self.assertEqual(_expected_receipt(
			[],
			target_address='TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI',
			sender='TAIRCEIRCEIRCEIRCEIRCEIRCEIRCEIRCEIRCEI',
			recipient='TARCEIRCEIRCEIRCEIRCEIRCEIRCEIRCEIRCEIQ',
			artifact_id='ABCDEF0123456789'), result)
