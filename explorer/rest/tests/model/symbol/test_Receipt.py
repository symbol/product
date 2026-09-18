# pylint: disable=duplicate-code
from unittest import TestCase

from common.symbol.NativeMosaic import NativeMosaicInfo

from rest.model.symbol.Receipt import SymbolReceiptView

NATIVE_MOSAIC_INFO = NativeMosaicInfo('72C0212E67A08BCE', 6)
TARGET_ADDRESS = bytes.fromhex('98534F7E1D0A26CA4E316F901E23E55C8701DB20DF11A7B2')
SENDER_ADDRESS = bytes.fromhex('9889432DE263BB8FE88444A4DA28D3609BD8BB8FAE18AE95')


def _create_receipt(**overrides):
	receipt = {
		'height': 1234,
		'receipt_type': 'lockHashCreated',
		'receipt_group': 'balanceChange',
		'version': 1,
		'sender_address': None,
		'recipient_address': None,
		'target_address': None,
		'mosaic_id': None,
		'amount': 0,
		'artifact_id': None,
		'mosaic_divisibility': None
	}
	receipt.update(overrides)
	return SymbolReceiptView(**receipt)


class SymbolReceiptViewTest(TestCase):
	def test_to_dict_returns_receipt_without_mosaic_and_nullable_fields(self):
		# Arrange:
		receipt = _create_receipt()

		# Act:
		result = receipt.to_dict(NATIVE_MOSAIC_INFO)

		# Assert:
		self.assertEqual({
			'version': 1,
			'height': 1234,
			'type': 'lockHashCreated',
			'group': 'balanceChange',
			'targetAddress': None,
			'sender': None,
			'to': None,
			'artifactId': None,
			'mosaics': []
		}, result)

	def test_to_dict_formats_native_amount_without_mosaic_metadata(self):
		# Arrange:
		receipt = _create_receipt(mosaic_id='72c0212e67a08bce', amount=1234567)

		# Act:
		result = receipt.to_dict(NATIVE_MOSAIC_INFO)

		# Assert:
		self.assertEqual({
			'version': 1,
			'height': 1234,
			'type': 'lockHashCreated',
			'group': 'balanceChange',
			'targetAddress': None,
			'sender': None,
			'to': None,
			'artifactId': None,
			'mosaics': [{
				'id': '72C0212E67A08BCE',
				'name': '72C0212E67A08BCE',
				'amount': 1.234567,
				'isNative': True
			}]
		}, result)

	def test_to_dict_preserves_zero_native_amount(self):
		# Arrange:
		receipt = _create_receipt(mosaic_id=NATIVE_MOSAIC_INFO.id, amount=0)

		# Act:
		result = receipt.to_dict(NATIVE_MOSAIC_INFO)

		# Assert:
		self.assertEqual({
			'version': 1,
			'height': 1234,
			'type': 'lockHashCreated',
			'group': 'balanceChange',
			'targetAddress': None,
			'sender': None,
			'to': None,
			'artifactId': None,
			'mosaics': [{
				'id': NATIVE_MOSAIC_INFO.id,
				'name': NATIVE_MOSAIC_INFO.id,
				'amount': 0.0,
				'isNative': True
			}]
		}, result)

	def test_to_dict_formats_non_native_amount_with_persisted_divisibility(self):
		# Arrange:
		receipt = _create_receipt(mosaic_id='1234567890abcdef', amount=12345, mosaic_divisibility=2)

		# Act:
		result = receipt.to_dict(NATIVE_MOSAIC_INFO)

		# Assert:
		self.assertEqual({
			'version': 1,
			'height': 1234,
			'type': 'lockHashCreated',
			'group': 'balanceChange',
			'targetAddress': None,
			'sender': None,
			'to': None,
			'artifactId': None,
			'mosaics': [{
				'id': '1234567890ABCDEF',
				'name': '1234567890ABCDEF',
				'amount': 123.45,
				'isNative': False
			}]
		}, result)

	def test_to_dict_returns_non_native_absolute_amount_without_metadata(self):
		# Arrange:
		receipt = _create_receipt(mosaic_id='1234567890abcdef', amount=-12345)

		# Act:
		result = receipt.to_dict(NATIVE_MOSAIC_INFO)

		# Assert:
		self.assertEqual({
			'version': 1,
			'height': 1234,
			'type': 'lockHashCreated',
			'group': 'balanceChange',
			'targetAddress': None,
			'sender': None,
			'to': None,
			'artifactId': None,
			'mosaics': [{
				'id': '1234567890ABCDEF',
				'name': '1234567890ABCDEF',
				'amount': 12345,
				'isNative': False
			}]
		}, result)

	def test_to_dict_formats_target_address_for_balance_change(self):
		# Arrange:
		receipt = _create_receipt(
			target_address=TARGET_ADDRESS)

		# Act:
		result = receipt.to_dict(NATIVE_MOSAIC_INFO)

		# Assert:
		self.assertEqual({
			'version': 1,
			'height': 1234,
			'type': 'lockHashCreated',
			'group': 'balanceChange',
			'targetAddress': 'TBJU67Q5BITMUTRRN6IB4I7FLSDQDWZA34I2PMQ',
			'sender': None,
			'to': None,
			'artifactId': None,
			'mosaics': []
		}, result)

	def test_to_dict_formats_sender_and_recipient_for_balance_transfer(self):
		# Arrange:
		receipt = _create_receipt(
			receipt_type='mosaicRentalFee',
			receipt_group='balanceTransfer',
			sender_address=SENDER_ADDRESS,
			recipient_address=TARGET_ADDRESS)

		# Act:
		result = receipt.to_dict(NATIVE_MOSAIC_INFO)

		# Assert:
		self.assertEqual({
			'version': 1,
			'height': 1234,
			'type': 'mosaicRentalFee',
			'group': 'balanceTransfer',
			'targetAddress': None,
			'sender': 'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI',
			'to': 'TBJU67Q5BITMUTRRN6IB4I7FLSDQDWZA34I2PMQ',
			'artifactId': None,
			'mosaics': []
		}, result)

	def test_to_dict_normalizes_artifact_id_for_artifact_expiry(self):
		# Arrange:
		receipt = _create_receipt(
			receipt_type='namespaceExpired',
			receipt_group='artifactExpiry',
			artifact_id='abcdef0123456789')

		# Act:
		result = receipt.to_dict(NATIVE_MOSAIC_INFO)

		# Assert:
		self.assertEqual({
			'version': 1,
			'height': 1234,
			'type': 'namespaceExpired',
			'group': 'artifactExpiry',
			'targetAddress': None,
			'sender': None,
			'to': None,
			'artifactId': 'ABCDEF0123456789',
			'mosaics': []
		}, result)
