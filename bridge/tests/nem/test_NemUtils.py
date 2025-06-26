import unittest
from binascii import hexlify

from symbolchain.CryptoTypes import Hash256
from symbolchain.nc import MessageType, NetworkType, TransactionType, TransferTransactionV1, TransferTransactionV2
from symbolchain.nem.Network import Address, Network

from bridge.models.WrapRequest import WrapError, WrapRequest
from bridge.nem.NemUtils import calculate_transfer_transaction_fee, extract_wrap_request_from_transaction


class NemUtilsTest(unittest.TestCase):
	# region calculate_transfer_transaction_fee

	def test_can_calculate_xem_transfer_fee_without_message(self):
		self.assertEqual(50000 * 25, calculate_transfer_transaction_fee(500000))
		self.assertEqual(50000 * 25, calculate_transfer_transaction_fee(250000))
		self.assertEqual(50000 * 20, calculate_transfer_transaction_fee(200000))
		self.assertEqual(50000 * 20, calculate_transfer_transaction_fee(201111))
		self.assertEqual(50000 * 1, calculate_transfer_transaction_fee(10000))
		self.assertEqual(50000 * 1, calculate_transfer_transaction_fee(1))

	def test_can_calculate_xem_transfer_fee_with_message(self):
		self.assertEqual(50000 * 20, calculate_transfer_transaction_fee(200000, b''))
		self.assertEqual(50000 * 21, calculate_transfer_transaction_fee(200000, b'0' * 31))
		self.assertEqual(50000 * 22, calculate_transfer_transaction_fee(200000, b'0' * 32))
		self.assertEqual(50000 * 22, calculate_transfer_transaction_fee(200000, b'0' * 33))
		self.assertEqual(50000 * 30, calculate_transfer_transaction_fee(200000, b'0' * 319))
		self.assertEqual(50000 * 31, calculate_transfer_transaction_fee(200000, b'0' * 320))
		self.assertEqual(50000 * 31, calculate_transfer_transaction_fee(200000, b'0' * 321))

	# endregion

	# region extract_wrap_request_from_transaction - transfer (success)

	@staticmethod
	def _create_simple_wrap_request():
		return WrapRequest(
			1234,
			Hash256('C0B52BE17C2F41539E50857855A226A24AFE8B23B51E42F3186FBC725EA63550'),
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
		transaction_meta_json = {
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
					'payload': hexlify(request.target_address_eth.encode('utf8')).decode('utf8')
				}
			}
		}

		if 1 < transaction_version:
			transaction_meta_json['transaction']['mosaics'] = []

		return transaction_meta_json

	def _assert_wrap_request_success(self, result, expected_request):
		self.assertEqual(False, result.is_error)
		self.assertEqual(expected_request, result.request)
		self.assertEqual(None, result.error)

	def _assert_wrap_request_failure(self, result, expected_error):
		self.assertEqual(True, result.is_error)
		self.assertEqual(None, result.request)
		self.assertEqual(expected_error, result.error)

	def _assert_can_create_wrap_request_from_simple_transfer(self, **kwargs):
		# Arrange:
		request = self._create_simple_wrap_request()
		transaction_meta_json = self._create_transfer_json(request, **kwargs)

		# Act:
		result = extract_wrap_request_from_transaction(Network.TESTNET, transaction_meta_json)

		# Assert:
		self._assert_wrap_request_success(result, request)

	def test_can_create_wrap_request_from_simple_transfer_v1(self):
		self._assert_can_create_wrap_request_from_simple_transfer(transaction_version=TransferTransactionV1.TRANSACTION_VERSION)

	def test_can_create_wrap_request_from_simple_transfer_v2(self):
		self._assert_can_create_wrap_request_from_simple_transfer(transaction_version=TransferTransactionV2.TRANSACTION_VERSION)

	@staticmethod
	def _create_transfer_json_with_single_bag(request, amount, mosaic_amount):
		transaction_meta_json = NemUtilsTest._create_transfer_json(request, transaction_version=TransferTransactionV2.TRANSACTION_VERSION)
		transaction_meta_json['transaction']['amount'] = amount  # override amount from request
		transaction_meta_json['transaction']['mosaics'] = [
			{
				'mosaicId': {'namespaceId': 'nem', 'name': 'xem'},
				'quantity': mosaic_amount
			}
		]

		return transaction_meta_json

	@staticmethod
	def _change_request_amount(request, new_amount):
		return WrapRequest(
			request.transaction_height,
			request.transaction_hash,
			request.sender_address,
			new_amount,
			request.target_address_eth)

	def _assert_can_create_wrap_request_from_single_xem_mosaic_in_bag(self, amount, mosaic_amount, expected_amount):
		# Arrange:
		request = self._create_simple_wrap_request()
		transaction_meta_json = self._create_transfer_json_with_single_bag(request, amount, mosaic_amount)

		# Act:
		result = extract_wrap_request_from_transaction(Network.TESTNET, transaction_meta_json)

		# Assert:
		self._assert_wrap_request_success(result, self._change_request_amount(request, expected_amount))

	def test_can_create_wrap_request_from_single_bag_transfer_v2(self):
		self._assert_can_create_wrap_request_from_single_xem_mosaic_in_bag(2_000000, 12345_000000, 24690_000000)

	def test_can_create_wrap_request_from_single_bag_transfer_v2_large_amount(self):
		# notice that amount * mosaicAmount > Number.MAX_SAFE_INTEGER
		self._assert_can_create_wrap_request_from_single_xem_mosaic_in_bag(1_000000, 14570747_490000, 14570747_490000)

	def test_can_create_wrap_request_from_single_bag_transfer_v2_fractional_1(self):
		self._assert_can_create_wrap_request_from_single_xem_mosaic_in_bag(50000, 34_152375, 1_707618)

	def test_can_create_wrap_request_from_single_bag_transfer_v2_fractional_2(self):
		self._assert_can_create_wrap_request_from_single_xem_mosaic_in_bag(32_495622, 1_000000, 32_495622)

	def test_can_create_wrap_request_from_multi_bag_transfer_v2_with_xem(self):
		# Arrange:
		request = self._create_simple_wrap_request()
		transaction_meta_json = self._create_transfer_json(request, transaction_version=TransferTransactionV2.TRANSACTION_VERSION)
		transaction_meta_json['transaction']['amount'] = 2_000000
		transaction_meta_json['transaction']['mosaics'] = [
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
		result = extract_wrap_request_from_transaction(Network.TESTNET, transaction_meta_json)

		# Assert:
		self._assert_wrap_request_success(result, self._change_request_amount(request, 2222_000000))

	def test_can_create_wrap_request_from_multi_bag_transfer_v2_without_xem(self):
		# Arrange:
		request = self._create_simple_wrap_request()
		transaction_meta_json = self._create_transfer_json(request, transaction_version=TransferTransactionV2.TRANSACTION_VERSION)
		transaction_meta_json['transaction']['amount'] = 2_000000
		transaction_meta_json['transaction']['mosaics'] = [
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
		result = extract_wrap_request_from_transaction(Network.TESTNET, transaction_meta_json)

		# Assert:
		self._assert_wrap_request_success(result, self._change_request_amount(request, 0))

	# endregion

	# region extract_wrap_request_from_transaction - transfer (failure)

	@staticmethod
	def _make_wrap_error_from_request(request, message):
		return WrapError(
			request.transaction_height,
			request.transaction_hash,
			request.sender_address,
			message)

	def _assert_cannot_create_wrap_request_from_simple_transfer(self, expected_error_message, **kwargs):
		# Arrange:
		request = self._create_simple_wrap_request()
		transaction_meta_json = self._create_transfer_json(request, **kwargs)

		if kwargs.get('clear_message', False):
			transaction_meta_json['transaction']['message'] = {}

		# Act:
		result = extract_wrap_request_from_transaction(Network.TESTNET, transaction_meta_json)

		# Assert:
		self._assert_wrap_request_failure(result, self._make_wrap_error_from_request(request, expected_error_message))

	def test_cannot_create_wrap_request_from_simple_transfer_with_invalid_message_type(self):
		self._assert_cannot_create_wrap_request_from_simple_transfer(
			'message type 2 is not supported',
			message_type=MessageType.ENCRYPTED.value)

	def test_cannot_create_wrap_request_from_simple_transfer_without_message(self):
		self._assert_cannot_create_wrap_request_from_simple_transfer(
			'required message is missing',
			clear_message=True)

	def test_cannot_create_wrap_request_from_other_transaction(self):
		self._assert_cannot_create_wrap_request_from_simple_transfer(
			'transaction type 8193 is not supported',
			transaction_type=TransactionType.NAMESPACE_REGISTRATION.value)

	def test_cannot_create_wrap_request_from_transfer_with_invalid_message(self):
		# Arrange:
		request = self._create_simple_wrap_request()
		request = WrapRequest(
			request.transaction_height,
			request.transaction_hash,
			request.sender_address,
			request.amount,
			'0x4838b106fce9647bdf1e7877bf73ce8b0bad5f')  # too short
		transaction_meta_json = self._create_transfer_json(request)

		# Act:
		result = extract_wrap_request_from_transaction(Network.TESTNET, transaction_meta_json)

		# Assert:
		expected_error_message = 'target ethereum address 0x4838b106fce9647bdf1e7877bf73ce8b0bad5f is invalid'
		self._assert_wrap_request_failure(result, self._make_wrap_error_from_request(request, expected_error_message))

	# endregion

	# region extract_wrap_request_from_transaction - aggregate (success)

	def test_can_create_wrap_request_from_aggregate_with_transfer(self):
		# Arrange:
		request = self._create_simple_wrap_request()
		transaction_meta_json = self._create_transfer_json(request)
		transaction_meta_json = {
			'meta': self._create_transfer_json(request)['meta'],
			'transaction': {
				'type': TransactionType.MULTISIG.value,
				'signer': 'E5F290755F021258ACE3CB29452BF38B322D76F62CAF6E9D2A89B48ABF7DD778',

				'otherTrans': self._create_transfer_json(request)['transaction'],
				'signatures': []
			}
		}

		# Act:
		result = extract_wrap_request_from_transaction(Network.TESTNET, transaction_meta_json)

		# Assert:
		self._assert_wrap_request_success(result, request)

	# endregion

	# region extract_wrap_request_from_transaction - aggregate (failure)

	def test_can_create_wrap_request_from_aggregate_with_other_transaction(self):
		# Arrange:
		request = self._create_simple_wrap_request()
		transaction_meta_json = self._create_transfer_json(request)
		transaction_meta_json = {
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
		result = extract_wrap_request_from_transaction(Network.TESTNET, transaction_meta_json)

		# Assert:
		expected_error_message = 'inner transaction type 8193 is not supported'
		self._assert_wrap_request_failure(result, self._make_wrap_error_from_request(request, expected_error_message))

	# endregion
