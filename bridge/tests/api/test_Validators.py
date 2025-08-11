import unittest

from bridge.api.Validators import is_valid_address_string, is_valid_decimal_string, is_valid_hash_string
from bridge.models.BridgeConfiguration import NetworkConfiguration
from bridge.nem.NemNetworkFacade import NemNetworkFacade


class ValidatorsTest(unittest.TestCase):
	def test_is_valid_address_string_returns_true_when_string_is_address(self):
		# Arrange:
		network_facade = NemNetworkFacade(NetworkConfiguration('nem', 'testnet', '', 'TCYIHED7HZQ3IPBY5WRDPDLV5CCMMOOVSOMSPD6B', '', {}))

		# Act + Assert:
		self.assertTrue(is_valid_address_string(network_facade, 'TB7GF436SYPM4UQF2YYI563QIETUO5NZR6EREKPI'))

		self.assertFalse(is_valid_address_string(network_facade, 'TB7GF436SYPM4UQF2YYI563QIETUO5NZR6EREKPZ'))

	def test_is_valid_hash_string_returns_true_when_string_is_hash(self):
		self.assertTrue(is_valid_hash_string(4 * '0123456789ABCDEF'))
		self.assertTrue(is_valid_hash_string(32 * '00'))

		self.assertFalse(is_valid_hash_string(31 * '00'))  # too short
		self.assertFalse(is_valid_hash_string(33 * '00'))  # too long
		self.assertFalse(is_valid_hash_string(f'{15 * "00"}0G{16 * "01"}'))  # invalid character

	def test_is_valid_decimal_string_returns_true_when_string_is_decimal(self):
		self.assertTrue(is_valid_decimal_string('9012345678'))
		self.assertTrue(is_valid_decimal_string('12345'))
		self.assertTrue(is_valid_decimal_string('1'))
		self.assertTrue(is_valid_decimal_string('0'))

		self.assertFalse(is_valid_decimal_string('12G45'))  # invalid character
