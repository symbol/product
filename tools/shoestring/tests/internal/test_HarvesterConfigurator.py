import tempfile
import unittest
from pathlib import Path

from symbolchain.PrivateKeyStorage import PrivateKeyStorage
from symbolchain.symbol.KeyPair import KeyPair

from shoestring.internal.ConfigurationManager import ConfigurationManager
from shoestring.internal.HarvesterConfigurator import HarvesterConfigurator


class HarvesterConfiguratorTest(unittest.TestCase):
	def test_configurator_generates_random_key_pairs(self):
		# Act:
		configurator1 = HarvesterConfigurator(None)
		configurator2 = HarvesterConfigurator(None)

		# Assert:
		self.assertEqual(4, len(set([
			configurator1.remote_key_pair.public_key,
			configurator1.vrf_key_pair.public_key,
			configurator2.remote_key_pair.public_key,
			configurator2.vrf_key_pair.public_key
		])))

	def test_can_patch_configuration(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as temp_directory:
			with open(Path(temp_directory) / 'config-harvesting.properties', 'wt', encoding='utf8') as outfile:
				outfile.write('\n'.join([
					'[harvesting]',
					'harvesterSigningPrivateKey = aaa',
					'harvesterVrfPrivateKey = bbb',
					'enableAutoHarvesting = ccc',
					'maxUnlockedAccounts = ddd'
				]))

			# Act:
			config_manager = ConfigurationManager(temp_directory)
			configurator = HarvesterConfigurator(config_manager)
			configurator.patch_configuration()

			# Assert: all values were updated
			updated_values = config_manager.lookup('config-harvesting.properties', [
				('harvesting', key) for key in [
					'harvesterSigningPrivateKey',
					'harvesterVrfPrivateKey',
					'enableAutoHarvesting',
					'maxUnlockedAccounts'
				]
			])

			self.assertEqual([
				str(configurator.remote_key_pair.public_key),
				str(configurator.vrf_key_pair.public_key),
				'true',
				'ddd'
			], updated_values)

	def test_can_save_harvester_key_files(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as keys_directory:
			configurator = HarvesterConfigurator(None)

			# Act:
			configurator.generate_harvester_key_files(keys_directory)

			# Assert:
			generated_files = sorted([path.name for path in Path(keys_directory).iterdir()])
			self.assertEqual(['remote.pem', 'vrf.pem'], generated_files)

			# - check file contents
			storage = PrivateKeyStorage(keys_directory)
			self.assertEqual(configurator.remote_key_pair.public_key, KeyPair(storage.load('remote')).public_key)
			self.assertEqual(configurator.vrf_key_pair.public_key, KeyPair(storage.load('vrf')).public_key)

			# - check file permissions
			for generated_file in generated_files:
				self.assertEqual(0o400, (Path(keys_directory) / generated_file).stat().st_mode & 0o700)
