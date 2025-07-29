import unittest
from binascii import hexlify

from symbolchain.CryptoTypes import Hash256
from symbolchain.nc import MessageType, NetworkType, TransactionType, TransferTransactionV1, TransferTransactionV2
from symbolchain.nem.Network import Address, Network
from symbollightapi.connector.NemConnector import MosaicFeeInformation

from bridge.models.WrapRequest import WrapRequest
from bridge.nem.NemUtils import calculate_transfer_transaction_fee, extract_wrap_request_from_transaction

from ..test.BridgeTestUtils import (
	assert_wrap_request_failure,
	assert_wrap_request_success,
	change_request_amount,
	change_request_destination_address,
	make_wrap_error_from_request
)


class NemUtilsTest(unittest.TestCase):
	# region calculate_transfer_transaction_fee

	def test_can_calculate_xem_transfer_fee_without_message(self):
		for fee_information in [None, MosaicFeeInformation(8999999999, 6)]:
			self.assertEqual(25 * 50000, calculate_transfer_transaction_fee(fee_information, 500000 * 1000000))
			self.assertEqual(25 * 50000, calculate_transfer_transaction_fee(fee_information, 250000 * 1000000))
			self.assertEqual(20 * 50000, calculate_transfer_transaction_fee(fee_information, 200000 * 1000000))
			self.assertEqual(20 * 50000, calculate_transfer_transaction_fee(fee_information, 201111 * 1000000))
			self.assertEqual(1 * 50000, calculate_transfer_transaction_fee(fee_information, 10000 * 1000000))
			self.assertEqual(1 * 50000, calculate_transfer_transaction_fee(fee_information, 1 * 1000000))

	def test_can_calculate_xem_transfer_fee_with_message(self):
		for fee_information in [None, MosaicFeeInformation(8999999999, 6)]:
			self.assertEqual(20 * 50000, calculate_transfer_transaction_fee(fee_information, 200000 * 1000000, b''))
			self.assertEqual(21 * 50000, calculate_transfer_transaction_fee(fee_information, 200000 * 1000000, b'0' * 31))
			self.assertEqual(22 * 50000, calculate_transfer_transaction_fee(fee_information, 200000 * 1000000, b'0' * 32))
			self.assertEqual(22 * 50000, calculate_transfer_transaction_fee(fee_information, 200000 * 1000000, b'0' * 33))
			self.assertEqual(30 * 50000, calculate_transfer_transaction_fee(fee_information, 200000 * 1000000, b'0' * 319))
			self.assertEqual(31 * 50000, calculate_transfer_transaction_fee(fee_information, 200000 * 1000000, b'0' * 320))
			self.assertEqual(31 * 50000, calculate_transfer_transaction_fee(fee_information, 200000 * 1000000, b'0' * 321))

	def test_can_calculate_mosaic_transfer_fee_without_message(self):
		fee_information = MosaicFeeInformation(100000000, 3)
		self.assertEqual(1 * 50000, calculate_transfer_transaction_fee(fee_information, 12))
		self.assertEqual(1 * 50000, calculate_transfer_transaction_fee(fee_information, 111 * 1000))

		self.assertEqual(1 * 50000, calculate_transfer_transaction_fee(fee_information, 1222 * 1000))
		self.assertEqual(2 * 50000, calculate_transfer_transaction_fee(fee_information, 1223 * 1000))
		self.assertEqual(2 * 50000, calculate_transfer_transaction_fee(fee_information, 1224 * 1000))

		self.assertEqual(2 * 50000, calculate_transfer_transaction_fee(fee_information, 1333 * 1000))
		self.assertEqual(3 * 50000, calculate_transfer_transaction_fee(fee_information, 1334 * 1000))
		self.assertEqual(3 * 50000, calculate_transfer_transaction_fee(fee_information, 1335 * 1000))

		self.assertEqual(3 * 50000, calculate_transfer_transaction_fee(fee_information, 1444 * 1000))
		self.assertEqual(4 * 50000, calculate_transfer_transaction_fee(fee_information, 1445 * 1000))
		self.assertEqual(4 * 50000, calculate_transfer_transaction_fee(fee_information, 1446 * 1000))

		self.assertEqual(10 * 50000, calculate_transfer_transaction_fee(fee_information, 2112 * 1000))
		self.assertEqual(13 * 50000, calculate_transfer_transaction_fee(fee_information, 2445 * 1000))
		self.assertEqual(16 * 50000, calculate_transfer_transaction_fee(fee_information, 2778 * 1000))
		self.assertEqual(16 * 50000, calculate_transfer_transaction_fee(fee_information, 3000 * 1000))
		self.assertEqual(16 * 50000, calculate_transfer_transaction_fee(fee_information, 10000 * 1000))
		self.assertEqual(16 * 50000, calculate_transfer_transaction_fee(fee_information, 100000 * 1000))

	def test_can_calculate_mosaic_transfer_fee_with_message(self):
		fee_information = MosaicFeeInformation(100000000, 3)
		self.assertEqual(13 * 50000, calculate_transfer_transaction_fee(fee_information, 2445 * 1000, b''))
		self.assertEqual(14 * 50000, calculate_transfer_transaction_fee(fee_information, 2445 * 1000, b'0' * 31))
		self.assertEqual(15 * 50000, calculate_transfer_transaction_fee(fee_information, 2445 * 1000, b'0' * 32))
		self.assertEqual(15 * 50000, calculate_transfer_transaction_fee(fee_information, 2445 * 1000, b'0' * 33))
		self.assertEqual(23 * 50000, calculate_transfer_transaction_fee(fee_information, 2445 * 1000, b'0' * 319))
		self.assertEqual(24 * 50000, calculate_transfer_transaction_fee(fee_information, 2445 * 1000, b'0' * 320))
		self.assertEqual(24 * 50000, calculate_transfer_transaction_fee(fee_information, 2445 * 1000, b'0' * 321))

	# endregion

	# region extract_wrap_request_from_transaction - transfer (success)

	@staticmethod
	def _extract_wrap_request_from_transaction(transaction_with_meta_json, mosaic_id=None):
		def is_valid_address(address):
			return '0x4838b106fce9647bdf1e7877bf73ce8b0bad5f97' == address

		return extract_wrap_request_from_transaction(Network.TESTNET, is_valid_address, mosaic_id, transaction_with_meta_json)

	@staticmethod
	def _create_simple_wrap_request(transaction_subindex=-1):
		return WrapRequest(
			1234,
			Hash256('C0B52BE17C2F41539E50857855A226A24AFE8B23B51E42F3186FBC725EA63550'),
			transaction_subindex,
			Address('TCQKTUUNUOPQGDQIDQT2CCJGQZ4QNAAGBZRV5YJJ'),
			9999_000000,
			'0x4838b106fce9647bdf1e7877bf73ce8b0bad5f97')

	@staticmethod
	def _create_transfer_json(request, **kwargs):
		# workaround to create a transaction from a request
		# use a reverse lookup because request includes address but transaction requires public key
		signer_address_to_public_key_mapping = {
			Address('TCQKTUUNUOPQGDQIDQT2CCJGQZ4QNAAGBZRV5YJJ'): '3917578FF27A88B20E137D9D2E54E775163F9C493A193A64F96748EBF8B21F3C'
		}

		transaction_version = kwargs.get('transaction_version', TransferTransactionV1.TRANSACTION_VERSION)
		transaction_with_meta_json = {
			'meta': {
				'height': request.transaction_height,
				'hash': {
					'data': str(request.transaction_hash)
				},
			},
			'transaction': {
				'type': kwargs.get('transaction_type', TransferTransactionV1.TRANSACTION_TYPE.value),
				'version': (NetworkType.TESTNET.value << 24) | transaction_version,
				'amount': request.amount,
				'signer': signer_address_to_public_key_mapping[request.sender_address],
				'message': {
					'type': kwargs.get('message_type', MessageType.PLAIN.value),
					'payload': hexlify(request.destination_address.encode('utf8')).decode('utf8')
				}
			}
		}

		if 1 < transaction_version:
			transaction_with_meta_json['transaction']['mosaics'] = []

		return transaction_with_meta_json

	def _assert_can_extract_wrap_request_from_simple_transfer(self, **kwargs):
		# Arrange:
		request = self._create_simple_wrap_request()
		transaction_with_meta_json = self._create_transfer_json(request, **kwargs)

		# Act:
		result = self._extract_wrap_request_from_transaction(transaction_with_meta_json)

		# Assert:
		assert_wrap_request_success(self, result, request)

	def test_can_extract_wrap_request_from_simple_transfer_v1(self):
		self._assert_can_extract_wrap_request_from_simple_transfer(transaction_version=TransferTransactionV1.TRANSACTION_VERSION)

	def test_can_extract_wrap_request_from_simple_transfer_v2(self):
		self._assert_can_extract_wrap_request_from_simple_transfer(transaction_version=TransferTransactionV2.TRANSACTION_VERSION)

	@staticmethod
	def _create_transfer_json_with_single_bag(request, amount, mosaic_amount):
		transaction_with_meta_json = NemUtilsTest._create_transfer_json(request, transaction_version=TransferTransactionV2.TRANSACTION_VERSION)
		transaction_with_meta_json['transaction']['amount'] = amount  # override amount from request
		transaction_with_meta_json['transaction']['mosaics'] = [
			{
				'mosaicId': {'namespaceId': 'nem', 'name': 'xem'},
				'quantity': mosaic_amount
			}
		]

		return transaction_with_meta_json

	def _assert_can_extract_wrap_request_from_single_xem_mosaic_in_bag(self, amount, mosaic_amount, expected_amount):
		# Arrange:
		request = self._create_simple_wrap_request()
		transaction_with_meta_json = self._create_transfer_json_with_single_bag(request, amount, mosaic_amount)

		# Act:
		result = self._extract_wrap_request_from_transaction(transaction_with_meta_json)

		# Assert:
		assert_wrap_request_success(self, result, change_request_amount(request, expected_amount))

	def test_can_extract_wrap_request_from_single_bag_transfer_v2(self):
		self._assert_can_extract_wrap_request_from_single_xem_mosaic_in_bag(2_000000, 12345_000000, 24690_000000)

	def test_can_extract_wrap_request_from_single_bag_transfer_v2_large_amount(self):
		# notice that amount * mosaicAmount > Number.MAX_SAFE_INTEGER
		self._assert_can_extract_wrap_request_from_single_xem_mosaic_in_bag(1_000000, 14570747_490000, 14570747_490000)

	def test_can_extract_wrap_request_from_single_bag_transfer_v2_fractional_1(self):
		self._assert_can_extract_wrap_request_from_single_xem_mosaic_in_bag(50000, 34_152375, 1_707618)

	def test_can_extract_wrap_request_from_single_bag_transfer_v2_fractional_2(self):
		self._assert_can_extract_wrap_request_from_single_xem_mosaic_in_bag(32_495622, 1_000000, 32_495622)

	def test_can_extract_wrap_request_from_multi_bag_transfer_v2_with_xem(self):
		# Arrange:
		request = self._create_simple_wrap_request()
		transaction_with_meta_json = self._create_transfer_json(request, transaction_version=TransferTransactionV2.TRANSACTION_VERSION)
		transaction_with_meta_json['transaction']['amount'] = 2_000000
		transaction_with_meta_json['transaction']['mosaics'] = [
			{
				'mosaicId': {'namespaceId': 'baz', 'name': 'baz'},
				'quantity': 7733_000000
			},
			{
				'mosaicId': {'namespaceId': 'nem', 'name': 'xem'},
				'quantity': 1111_000000
			},
			{
				'mosaicId': {'namespaceId': 'foo', 'name': 'bar'},
				'quantity': 2244_000000
			}
		]

		# Act:
		result = self._extract_wrap_request_from_transaction(transaction_with_meta_json)

		# Assert:
		assert_wrap_request_success(self, result, change_request_amount(request, 2222_000000))

	def test_can_extract_wrap_request_from_multi_bag_transfer_v2_without_xem(self):
		# Arrange:
		request = self._create_simple_wrap_request()
		transaction_with_meta_json = self._create_transfer_json(request, transaction_version=TransferTransactionV2.TRANSACTION_VERSION)
		transaction_with_meta_json['transaction']['amount'] = 2_000000
		transaction_with_meta_json['transaction']['mosaics'] = [
			{
				'mosaicId': {'namespaceId': 'baz', 'name': 'baz'},
				'quantity': 7733_000000
			},
			{
				'mosaicId': {'namespaceId': 'foo', 'name': 'bar'},
				'quantity': 2244_000000
			}
		]

		# Act:
		result = self._extract_wrap_request_from_transaction(transaction_with_meta_json)

		# Assert:
		assert_wrap_request_success(self, result, change_request_amount(request, 0))

	def test_can_extract_wrap_request_from_transfer_v2_matching_custom_mosaic(self):
		# Arrange:
		request = self._create_simple_wrap_request()
		transaction_with_meta_json = self._create_transfer_json(request, transaction_version=TransferTransactionV2.TRANSACTION_VERSION)
		transaction_with_meta_json['transaction']['amount'] = 2_000000
		transaction_with_meta_json['transaction']['mosaics'] = [
			{
				'mosaicId': {'namespaceId': 'baz', 'name': 'baz'},
				'quantity': 7733_000000
			},
			{
				'mosaicId': {'namespaceId': 'foo', 'name': 'bar'},
				'quantity': 2244_000000
			}
		]

		# Act:
		result = self._extract_wrap_request_from_transaction(transaction_with_meta_json, ('foo', 'bar'))

		# Assert:
		assert_wrap_request_success(self, result, change_request_amount(request, 4488_000000))

	# endregion

	# region extract_wrap_request_from_transaction - transfer (failure)

	def _assert_cannot_extract_wrap_request_from_simple_transfer(self, expected_error_message, **kwargs):
		# Arrange:
		request = self._create_simple_wrap_request()
		transaction_with_meta_json = self._create_transfer_json(request, **kwargs)

		if kwargs.get('clear_message', False):
			transaction_with_meta_json['transaction']['message'] = {}

		# Act:
		result = self._extract_wrap_request_from_transaction(transaction_with_meta_json)

		# Assert:
		assert_wrap_request_failure(self, result, make_wrap_error_from_request(request, expected_error_message))

	def test_cannot_extract_wrap_request_from_simple_transfer_with_invalid_message_type(self):
		self._assert_cannot_extract_wrap_request_from_simple_transfer(
			'message type 2 is not supported',
			message_type=MessageType.ENCRYPTED.value)

	def test_cannot_extract_wrap_request_from_simple_transfer_without_message(self):
		self._assert_cannot_extract_wrap_request_from_simple_transfer(
			'required message is missing',
			clear_message=True)

	def test_cannot_extract_wrap_request_from_other_transaction(self):
		self._assert_cannot_extract_wrap_request_from_simple_transfer(
			'transaction type 8193 is not supported',
			transaction_type=TransactionType.NAMESPACE_REGISTRATION.value)

	def test_cannot_extract_wrap_request_from_transfer_with_invalid_message(self):
		# Arrange:
		request = self._create_simple_wrap_request()
		request = change_request_destination_address(request, '0x4838b106fce9647bdf1e7877bf73ce8b0bad5f')  # too short
		transaction_with_meta_json = self._create_transfer_json(request)

		# Act:
		result = self._extract_wrap_request_from_transaction(transaction_with_meta_json)

		# Assert:
		expected_error_message = 'destination address 0x4838b106fce9647bdf1e7877bf73ce8b0bad5f is invalid'
		assert_wrap_request_failure(self, result, make_wrap_error_from_request(request, expected_error_message))

	def test_cannot_extract_wrap_request_from_transfer_v1_matching_custom_mosaic(self):
		# Arrange:
		request = self._create_simple_wrap_request()
		transaction_with_meta_json = self._create_transfer_json(request)

		# Act:
		result = self._extract_wrap_request_from_transaction(transaction_with_meta_json, ('foo', 'bar'))

		# Assert:
		expected_error_message = 'nem:xem is not supported, expected mosaic foo:bar'
		assert_wrap_request_failure(self, result, make_wrap_error_from_request(request, expected_error_message))

	# endregion

	# region extract_wrap_request_from_transaction - aggregate (success)

	def test_can_extract_wrap_request_from_aggregate_with_transfer(self):
		# Arrange:
		request = self._create_simple_wrap_request(transaction_subindex=0)
		transaction_with_meta_json = self._create_transfer_json(request)
		transaction_with_meta_json = {
			'meta': self._create_transfer_json(request)['meta'],
			'transaction': {
				'type': TransactionType.MULTISIG.value,
				'signer': 'E5F290755F021258ACE3CB29452BF38B322D76F62CAF6E9D2A89B48ABF7DD778',

				'otherTrans': self._create_transfer_json(request)['transaction'],
				'signatures': []
			}
		}

		# Act:
		result = self._extract_wrap_request_from_transaction(transaction_with_meta_json)

		# Assert:
		assert_wrap_request_success(self, result, request)

	# endregion

	# region extract_wrap_request_from_transaction - aggregate (failure)

	def test_can_extract_wrap_request_from_aggregate_with_other_transaction(self):
		# Arrange:
		request = self._create_simple_wrap_request(transaction_subindex=0)
		transaction_with_meta_json = self._create_transfer_json(request)
		transaction_with_meta_json = {
			'meta': self._create_transfer_json(request)['meta'],
			'transaction': {
				'type': TransactionType.MULTISIG.value,
				'signer': 'E5F290755F021258ACE3CB29452BF38B322D76F62CAF6E9D2A89B48ABF7DD778',

				'otherTrans': self._create_transfer_json(
					request,
					transaction_type=TransactionType.NAMESPACE_REGISTRATION.value)['transaction'],
				'signatures': []
			}
		}

		# Act:
		result = self._extract_wrap_request_from_transaction(transaction_with_meta_json)

		# Assert:
		expected_error_message = 'inner transaction type 8193 is not supported'
		assert_wrap_request_failure(self, result, make_wrap_error_from_request(request, expected_error_message))

	# endregion
