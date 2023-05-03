import csv
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from symbolchain.Bip32 import Bip32
from symbolchain.CryptoTypes import PrivateKey, PublicKey
from symbolchain.facade.NemFacade import NemFacade
from symbolchain.facade.SymbolFacade import SymbolFacade

from vanity.__main__ import main


class MainTest(unittest.TestCase):
	@staticmethod
	def _execute(blockchain, patterns):
		with TemporaryDirectory() as temp_directory:
			tempfile_name = Path(temp_directory) / 'out.txt'
			main([
				'--blockchain', blockchain,
				'--network', 'mainnet',
				'--patterns', patterns,
				'--format', 'csv',
				'--out', str(tempfile_name)
			])

			with open(tempfile_name, 'rt', encoding='utf8') as infile:
				csv_reader = csv.DictReader(infile, ['address', 'public key', 'private key', 'mnemonic'])
				next(csv_reader)  # skip header
				return list(row for row in csv_reader)

	def _test_can_generate_addresses(self, blockchain, facade_class):
		# Act:
		address_descriptors = self._execute(blockchain, 'AXE,CAT,BOT')

		# Assert:
		address_prefixes = []
		facade = facade_class('mainnet')
		for descriptor in address_descriptors:
			bip32_root_node = Bip32(facade.BIP32_CURVE_NAME).from_mnemonic(descriptor['mnemonic'], '')
			for i in range(10):
				bip32_path = facade.bip32_path(i)
				key_pair = facade.bip32_node_to_key_pair(bip32_root_node.derive_path(bip32_path))

				if PublicKey(descriptor['public key']) != key_pair.public_key:
					continue

				self.assertEqual(key_pair.public_key, PublicKey(descriptor['public key']))
				self.assertEqual(key_pair.private_key, PrivateKey(descriptor['private key']))
				self.assertEqual(facade.network.public_key_to_address(key_pair.public_key), facade.Address(descriptor['address']))

				address_prefixes.append(descriptor['address'][1:5])

		self.assertEqual(3, len(address_prefixes))
		for target in ['AXE', 'CAT', 'BOT']:
			self.assertTrue(any(prefix.startswith(target) or prefix.endswith(target) for prefix in address_prefixes), target)

	def test_can_generate_nem_addresses(self):
		self._test_can_generate_addresses('nem', NemFacade)

	def test_can_generate_symbol_addresses(self):
		self._test_can_generate_addresses('symbol', SymbolFacade)
