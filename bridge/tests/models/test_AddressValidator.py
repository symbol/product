import unittest

from symbolchain.symbol.Network import Network

from bridge.models.AddressValidator import try_convert_network_address_to_string


class AddressValidatorTest(unittest.TestCase):
	def _assert_is_valid_address(self, address, expected_formatted_address):
		# Act:
		result = try_convert_network_address_to_string(Network.TESTNET, address)

		# Assert:
		self.assertEqual(expected_formatted_address, result)

	def _assert_is_invalid_address(self, address):
		# Act:
		result = try_convert_network_address_to_string(Network.TESTNET, address)

		# Assert:
		self.assertEqual(None, result)

	def test_try_convert_network_address_to_string_handles_string_input(self):
		self._assert_is_valid_address(
			'TAUPP4BRGNQP5KG2QY53FNYZVZ7SDXQVS5BG2IQ',
			'TAUPP4BRGNQP5KG2QY53FNYZVZ7SDXQVS5BG2IQ')  # symbol testnet
		self._assert_is_invalid_address('NCHEST3QRQS4JZGOO64TH7NFJ2A63YA7TPM5PXI')     # symbol mainnet
		self._assert_is_invalid_address('0x4838b106fce9647bdf1e7877bf73ce8b0bad5f97')  # ethereum
		self._assert_is_invalid_address('TAHTNAEQNDJOBDHHRON7SKU7PO6GAWXAJZ4CB2QG')    # nem testnet

	def test_try_convert_network_address_to_string_handles_bytes_input(self):
		self._assert_is_valid_address(
			b'\x98(\xf7\xf013`\xfe\xa8\xda\x86;\xb2\xb7\x19\xae\x7f!\xde\x15\x97Bm"',
			'TAUPP4BRGNQP5KG2QY53FNYZVZ7SDXQVS5BG2IQ')  # symbol testnet
		self._assert_is_invalid_address(b'\x68(\xf7\xf013`\xfe\xa8\xda\x86;\xb2\xb7\x19\xae\x7f!\xde\x15\x97Bm"')      # symbol mainnet
		self._assert_is_invalid_address(b'\x98(\xf7\xf013`\xfe\xa8\xda\x86;\xb2\xb7\x19\xae\x7f!\xde\x15\x97Bm')       # too short
		self._assert_is_invalid_address(b'\x98(\xf7\xf013`\xfe\xa8\xda\x86;\xb2\xb7\x19\xae\x7f!\xde\x15\x97Bm"\x05')  # too long

	def test_try_convert_network_address_to_string_handles_other_input(self):
		self._assert_is_invalid_address({})
		self._assert_is_invalid_address([])
		self._assert_is_invalid_address(123)
