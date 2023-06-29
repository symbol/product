import tempfile
import unittest
from pathlib import Path

from symbolchain.CryptoTypes import PrivateKey
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
		self.assertEqual(False, configurator1.is_imported)
		self.assertEqual(False, configurator2.is_imported)

		self.assertEqual(4, len(set([
			configurator1.remote_key_pair.public_key,
			configurator1.vrf_key_pair.public_key,
			configurator2.remote_key_pair.public_key,
			configurator2.vrf_key_pair.public_key
		])))

	def test_configurator_can_import_key_pairs(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as temp_directory:
			import_filepath = Path(temp_directory) / 'import.properties'
			with open(import_filepath, 'wt', encoding='utf8') as outfile:
				outfile.write('\n'.join([
					'[harvesting]',
					'harvesterSigningPrivateKey = 089C662614A68C49F62F6C0B54F3F66D2D5DB0AFCD62BD69BF7A16312A83B746',
					'harvesterVrfPrivateKey = 87E1184A136E92C62981848680AEA78D0BF098911B658295454B94EDBEE25808'
				]))

			# Act:
			configurator = HarvesterConfigurator(None, import_filepath)

			# Assert:
			self.assertEqual(True, configurator.is_imported)

			self.assertEqual(
				PrivateKey('089C662614A68C49F62F6C0B54F3F66D2D5DB0AFCD62BD69BF7A16312A83B746'),
				configurator.remote_key_pair.private_key)
			self.assertEqual(
				PrivateKey('87E1184A136E92C62981848680AEA78D0BF098911B658295454B94EDBEE25808'),
				configurator.vrf_key_pair.private_key)

	def _assert_can_patch_configuration(self, import_filepath, expected_values_accessor):
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
			configurator = HarvesterConfigurator(config_manager, import_filepath)
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

			self.assertEqual(expected_values_accessor(configurator), updated_values)

	def test_can_patch_configuration_enabled(self):
		self._assert_can_patch_configuration(None, lambda configurator: [
			str(configurator.remote_key_pair.private_key),
			str(configurator.vrf_key_pair.private_key),
			'true',
			'ddd'
		])

	def test_can_patch_configuration_disabled(self):
		self._assert_can_patch_configuration('none', lambda _: [
			'aaa',
			'bbb',
			'false',
			'ddd'
		])

	def test_can_save_harvester_key_files_enabled(self):
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
				self.assertEqual(0o400, (Path(keys_directory) / generated_file).stat().st_mode & 0o777)

	def test_cannot_save_harvester_key_files_disabled(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as keys_directory:
			configurator = HarvesterConfigurator(None, 'none')

			# Act:
			configurator.generate_harvester_key_files(keys_directory)

			# Assert:
			generated_files = sorted([path.name for path in Path(keys_directory).iterdir()])
			self.assertEqual([], generated_files)
