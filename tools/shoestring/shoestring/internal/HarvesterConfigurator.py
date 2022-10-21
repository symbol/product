from pathlib import Path

from symbolchain.CryptoTypes import PrivateKey
from symbolchain.PrivateKeyStorage import PrivateKeyStorage
from symbolchain.symbol.KeyPair import KeyPair


class HarvesterConfigurator:
	"""Configures a harvester."""

	def __init__(self, config_manager):
		"""Creates a harvester configurator."""

		self.config_manager = config_manager
		self.remote_key_pair = KeyPair(PrivateKey.random())
		self.vrf_key_pair = KeyPair(PrivateKey.random())

	def patch_configuration(self):
		"""Patches harvesting settings."""

		self.config_manager.patch('config-harvesting.properties', [
			('harvesting', 'enableAutoHarvesting', 'true'),
			('harvesting', 'harvesterSigningPrivateKey', self.remote_key_pair.public_key),
			('harvesting', 'harvesterVrfPrivateKey', self.vrf_key_pair.public_key)
		])

	def generate_harvester_key_files(self, directory):
		"""Generates harvester private key files for use with openssl."""

		storage = PrivateKeyStorage(directory)
		storage.save('remote', self.remote_key_pair.private_key)
		storage.save('vrf', self.vrf_key_pair.private_key)

		for name in ('remote', 'vrf'):
			(Path(directory) / f'{name}.pem').chmod(0o400)
