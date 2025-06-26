import unittest
from binascii import hexlify

from symbolchain.CryptoTypes import Hash256
from symbolchain.nc import MessageType, NetworkType, TransferTransactionV1
from symbolchain.nem.Network import Address
from symbollightapi.connector.NemConnector import NemConnector

from bridge.models.WrapRequest import WrapRequest
from bridge.nem.NemNetworkFacade import NemNetworkFacade


class NemNetworkFacadeTest(unittest.TestCase):
	def test_can_create_facade(self):
		# Act:
		facade = NemNetworkFacade('testnet')

		# Assert:
		self.assertEqual('testnet', facade.network.name)

	def test_can_create_connector(self):
		# Arrange:
		facade = NemNetworkFacade('testnet')

		# Act:
		connector = facade.create_connector('http://foo.bar:1234')

		# Assert:
		self.assertIsInstance(connector, NemConnector)

	def test_can_make_address(self):
		# Arrange:
		facade = NemNetworkFacade('testnet')

		# Act:
		address_from_string = facade.make_address('TAHTNAEQNDJOBDHHRON7SKU7PO6GAWXAJZ4CB2QG')
		address_from_bytes = facade.make_address(b'\x98\x0f6\x80\x90h\xd2\xe0\x8c\xe7\x8b\x9b\xf9*\x9f{\xbc`Z\xe0Nx \xea\x06')

		# Assert:
		self.assertEqual(Address('TAHTNAEQNDJOBDHHRON7SKU7PO6GAWXAJZ4CB2QG'), address_from_string)
		self.assertEqual(Address('TAHTNAEQNDJOBDHHRON7SKU7PO6GAWXAJZ4CB2QG'), address_from_bytes)

	def test_can_extract_wrap_request_from_transaction(self):
		# Arrange:
		facade = NemNetworkFacade('testnet')

		# Act:
		result = facade.extract_wrap_request_from_transaction({
			'meta': {
				'height': 1234,
				'hash': {
					'data': 'FA650B75CC01187E004FCF547796930CC95D9CF55E6E6188FC7D413526A840FA'
				},
			},
			'transaction': {
				'type': TransferTransactionV1.TRANSACTION_TYPE.value,
				'version': (NetworkType.TESTNET.value << 24) | TransferTransactionV1.TRANSACTION_VERSION,
				'amount': 8888,
				'signer': '3917578FF27A88B20E137D9D2E54E775163F9C493A193A64F96748EBF8B21F3C',
				'message': {
					'type': MessageType.PLAIN.value,
					'payload': hexlify('0x4838b106fce9647bdf1e7877bf73ce8b0bad5f97'.encode('utf8')).decode('utf8')
				}
			}
		})

		# Assert:
		expected_request = WrapRequest(
			1234,
			Hash256('FA650B75CC01187E004FCF547796930CC95D9CF55E6E6188FC7D413526A840FA'),
			Address('TCQKTUUNUOPQGDQIDQT2CCJGQZ4QNAAGBZRV5YJJ'),
			8888,
			'0x4838b106fce9647bdf1e7877bf73ce8b0bad5f97')

		self.assertEqual(False, result.is_error)
		self.assertEqual(expected_request, result.request)
		self.assertEqual(None, result.error)
