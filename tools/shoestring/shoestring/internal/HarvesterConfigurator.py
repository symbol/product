from pathlib import Path

from symbolchain.CryptoTypes import PrivateKey
from symbolchain.PrivateKeyStorage import PrivateKeyStorage
from symbolchain.symbol.KeyPair import KeyPair
from symbolchain.symbol.Network import Address

from .ConfigurationManager import ConfigurationManager


class HarvesterConfigurator:
	"""Configures a harvester."""

	def __init__(self, config_manager, import_source=None):
		"""Creates a harvester configurator."""

		self.config_manager = config_manager
		self.is_imported = bool(import_source)
		self.is_enabled = 'none' != import_source

		if not self.is_imported:
			self.remote_key_pair = KeyPair(PrivateKey.random())
			self.vrf_key_pair = KeyPair(PrivateKey.random())
		elif self.is_enabled:
			import_source = Path(import_source)
			imported_properties = ConfigurationManager(import_source.parent).lookup(import_source.name, [
				('harvesting', 'harvesterSigningPrivateKey'),
				('harvesting', 'harvesterVrfPrivateKey'),
				('harvesting', 'beneficiaryAddress'),
				('harvesting', 'maxUnlockedAccounts')
			])
			self.remote_key_pair = KeyPair(PrivateKey(imported_properties[0]))
			self.vrf_key_pair = KeyPair(PrivateKey(imported_properties[1]))
			self.beneficiary_address = Address(imported_properties[2]) if imported_properties[2] else None
			self.max_unlocked_accounts = imported_properties[3]

	def patch_configuration(self):
		"""Patches harvesting settings."""

		if self.is_enabled:
			self.config_manager.patch('config-harvesting.properties', [
				('harvesting', 'enableAutoHarvesting', 'true'),
				('harvesting', 'harvesterSigningPrivateKey', self.remote_key_pair.private_key),
				('harvesting', 'harvesterVrfPrivateKey', self.vrf_key_pair.private_key),
				*([('harvesting', 'beneficiaryAddress', str(self.beneficiary_address))] if hasattr(self, 'beneficiary_address') else []),
				*([('harvesting', 'maxUnlockedAccounts', str(self.max_unlocked_accounts))] if hasattr(self, 'max_unlocked_accounts') else [])
			])
		else:
			self.config_manager.patch('config-harvesting.properties', [
				('harvesting', 'enableAutoHarvesting', 'false')
			])

	def generate_harvester_key_files(self, directory):
		"""Generates harvester private key files for use with openssl."""

		if not self.is_enabled:
			return

		storage = PrivateKeyStorage(directory)
		storage.save('remote', self.remote_key_pair.private_key)
		storage.save('vrf', self.vrf_key_pair.private_key)

		for name in ('remote', 'vrf'):
			(Path(directory) / f'{name}.pem').chmod(0o400)
