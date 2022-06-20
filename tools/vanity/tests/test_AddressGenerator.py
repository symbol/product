import unittest

from symbolchain.Bip32 import Bip32
from symbolchain.facade.NemFacade import NemFacade
from symbolchain.facade.SymbolFacade import SymbolFacade

from vanity.AddressGenerator import AddressGenerator
from vanity.MultiAddressMatcher import MultiAddressMatcher


class AddressGeneratorTest(unittest.TestCase):
	@staticmethod
	def _derive_public_key_at(facade, mnemonic, account_index):
		coin_id = 1 if 'testnet' == facade.network.name else facade.BIP32_COIN_ID
		bip32_root_node = Bip32(facade.BIP32_CURVE_NAME).from_mnemonic(mnemonic, '')
		# pylint:disable=duplicate-value
		return facade.KeyPair(bip32_root_node.derive_path({44, coin_id, account_index, 0, 0}).private_key).public_key

	def assert_derivable(self, facade, mnemonic, key_pair, max_wallet_accounts):
		self.assertTrue(any(
			key_pair.public_key == self._derive_public_key_at(facade, mnemonic, account_index)
			for account_index in range(0, max_wallet_accounts)
		))

	def _test_can_generate_single_address(self, facade, address_start_char):
		# Arrange:
		matches = []
		generator = AddressGenerator(facade, 5, lambda mnemonic, key_pair: matches.append((mnemonic, key_pair)))

		matcher = MultiAddressMatcher(facade.network, 100)
		matcher.add_search_pattern('AXE')

		# Act:
		generator.match_all(matcher)

		# Assert:
		self.assertEqual(1, len(matches))

		address_string = str(facade.network.public_key_to_address(matches[0][1].public_key))
		self.assertTrue(address_string.startswith(address_start_char))
		self.assertTrue('AXE' in address_string)

		self.assert_derivable(facade, matches[0][0], matches[0][1], 5)

	def test_can_generate_symbol_mainnet_address(self):
		self._test_can_generate_single_address(SymbolFacade('mainnet'), 'N')

	def test_can_generate_symbol_testnet_address(self):
		self._test_can_generate_single_address(SymbolFacade('testnet'), 'T')

	def test_can_generate_nem_mainnet_address(self):
		self._test_can_generate_single_address(NemFacade('mainnet'), 'N')

	def test_can_generate_nem_testnet_address(self):
		self._test_can_generate_single_address(NemFacade('testnet'), 'T')

	def test_can_generate_multiple_addresses(self):
		# Arrange:
		facade = SymbolFacade('testnet')

		matches = []
		generator = AddressGenerator(facade, 5, lambda mnemonic, key_pair: matches.append((mnemonic, key_pair)))

		matcher = MultiAddressMatcher(facade.network, 100)
		matcher.add_search_pattern('AXE')
		matcher.add_search_pattern('CAT')
		matcher.add_search_pattern('BOT')

		# Act:
		generator.match_all(matcher)

		# Assert:
		self.assertEqual(3, len(matches))

		counts = {'AXE': 0, 'CAT': 0, 'BOT': 0}
		for mnemonic, key_pair in matches:
			address_string = str(facade.network.public_key_to_address(key_pair.public_key))
			self.assertTrue(address_string.startswith('T'))
			for key in counts:
				counts[key] += 1 if key in address_string else 0

			self.assert_derivable(facade, mnemonic, key_pair, 5)

		for _, count in counts.items():
			self.assertGreaterEqual(1, count)
