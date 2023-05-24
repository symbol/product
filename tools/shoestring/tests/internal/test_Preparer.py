import os
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile

import yaml
from symbolchain.BufferReader import BufferReader
from symbolchain.CryptoTypes import PrivateKey
from symbolchain.sc import LinkAction, TransactionType
from symbolchain.symbol.KeyPair import KeyPair
from symbollightapi.connector.SymbolConnector import LinkedPublicKeys, VotingPublicKey

from shoestring.internal.NodeFeatures import NodeFeatures
from shoestring.internal.OpensslExecutor import OpensslExecutor
from shoestring.internal.Preparer import API_EXTENSIONS, HARVESTER_EXTENSIONS, PEER_EXTENSIONS, Preparer
from shoestring.internal.ShoestringConfiguration import NodeConfiguration, ShoestringConfiguration

from ..test.TestPackager import prepare_mainnet_package
from ..test.TransactionTestUtils import AggregateDescriptor, LinkDescriptor, assert_aggregate_complete_transaction, assert_link_transaction


class PreparerTest(unittest.TestCase):
	# pylint: disable=too-many-public-methods

	# region utils

	@staticmethod
	def _create_configuration(node_features, api_https=True):
		return ShoestringConfiguration('testnet', None, None, NodeConfiguration(node_features, None, None, None, api_https))

	# endregion

	# region basic

	def test_working_directory_is_automatically_created_and_destroyed(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as output_directory:
			# Act:
			with Preparer(output_directory, self._create_configuration(NodeFeatures.PEER)) as preparer:
				# Assert: temp directory was created
				self.assertIsNotNone(preparer)
				self.assertTrue(preparer.directories.temp.exists())

			# -  temp directory was destroyed
			self.assertFalse(preparer.directories.temp.exists())

	def test_can_locate_directories_before_creating_temp_directory(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as output_directory:
			# Act:
			preparer = Preparer(output_directory, self._create_configuration(NodeFeatures.PEER))

			# Assert:
			self.assertEqual(None, preparer.directories.temp)
			self.assertEqual(Path(output_directory) / 'seed', preparer.directories.seed)
			self.assertEqual(Path(output_directory) / 'startup', preparer.directories.startup)
			self.assertEqual(Path(output_directory) / 'mongo', preparer.directories.mongo)
			self.assertEqual(Path(output_directory) / 'dbdata', preparer.directories.dbdata)
			self.assertEqual(Path(output_directory) / 'rest-cache', preparer.directories.rest_cache)
			self.assertEqual(Path(output_directory) / 'https-proxy', preparer.directories.https_proxy)
			self.assertEqual(Path(output_directory) / 'resources', preparer.directories.resources)
			self.assertEqual(Path(output_directory) / 'keys', preparer.directories.keys)
			self.assertEqual(Path(output_directory) / 'keys' / 'cert', preparer.directories.certificates)
			self.assertEqual(Path(output_directory) / 'keys' / 'voting', preparer.directories.voting_keys)

	def test_can_locate_directories_after_creating_temp_directory(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as output_directory:
			# Act:
			with Preparer(output_directory, self._create_configuration(NodeFeatures.PEER)) as preparer:

				# Assert:
				self.assertEqual(Path(preparer.temp_directory.name), preparer.directories.temp)
				self.assertEqual(Path(output_directory) / 'seed', preparer.directories.seed)
				self.assertEqual(Path(output_directory) / 'startup', preparer.directories.startup)
				self.assertEqual(Path(output_directory) / 'mongo', preparer.directories.mongo)
				self.assertEqual(Path(output_directory) / 'dbdata', preparer.directories.dbdata)
				self.assertEqual(Path(output_directory) / 'rest-cache', preparer.directories.rest_cache)
				self.assertEqual(Path(output_directory) / 'https-proxy', preparer.directories.https_proxy)
				self.assertEqual(Path(output_directory) / 'resources', preparer.directories.resources)
				self.assertEqual(Path(output_directory) / 'keys', preparer.directories.keys)
				self.assertEqual(Path(output_directory) / 'keys' / 'cert', preparer.directories.certificates)
				self.assertEqual(Path(output_directory) / 'keys' / 'voting', preparer.directories.voting_keys)

	# endregion

	# region create_subdirectories

	def _assert_can_create_subdirectories_configuration(self, configuration, expected_directories):
		# Arrange:
		with tempfile.TemporaryDirectory() as output_directory:
			with Preparer(output_directory, configuration) as preparer:
				# Act:
				preparer.create_subdirectories()

				# Assert:
				created_directories = sorted(str(path)[len(output_directory):] for path in Path(output_directory).glob('**/*'))
				self.assertEqual(expected_directories, created_directories)

	def _assert_can_create_subdirectories(self, node_features, expected_directories):
		configuration = self._create_configuration(node_features)
		self._assert_can_create_subdirectories_configuration(configuration, expected_directories)

	def test_can_create_subdirectories_peer_node(self):
		self._assert_can_create_subdirectories(NodeFeatures.PEER, ['/data', '/keys', '/keys/cert', '/logs', '/resources'])

	def test_can_create_subdirectories_api_node(self):
		self._assert_can_create_subdirectories(
			NodeFeatures.API,
			['/data', '/dbdata', '/https-proxy', '/keys', '/keys/cert', '/logs', '/resources', '/rest-cache'])

	def test_can_create_subdirectories_api_node_without_https(self):
		configuration = self._create_configuration(NodeFeatures.API, api_https=False)
		self._assert_can_create_subdirectories_configuration(
			configuration,
			['/data', '/dbdata', '/keys', '/keys/cert', '/logs', '/resources', '/rest-cache'])

	def test_can_create_subdirectories_harvester_node(self):
		self._assert_can_create_subdirectories(NodeFeatures.HARVESTER, ['/data', '/keys', '/keys/cert', '/logs', '/resources'])

	def test_can_create_subdirectories_voter_node(self):
		self._assert_can_create_subdirectories(NodeFeatures.VOTER, ['/data', '/keys', '/keys/cert', '/keys/voting', '/logs', '/resources'])

	def test_can_create_subdirectories_full_node(self):
		self._assert_can_create_subdirectories(
			NodeFeatures.API | NodeFeatures.HARVESTER | NodeFeatures.VOTER,
			['/data', '/dbdata', '/https-proxy', '/keys', '/keys/cert', '/keys/voting', '/logs', '/resources', '/rest-cache'])

	# endregion

	# region prepare_resources

	@staticmethod
	def _initialize_temp_directory_with_package_files(preparer):
		zip_name = prepare_mainnet_package(preparer.directories.temp)
		preparer.create_subdirectories()
		with ZipFile(zip_name) as package:
			package.extractall(preparer.directories.temp)

	def _assert_can_prepare_resources(self, node_features, expected_extensions):
		# Arrange:
		with tempfile.TemporaryDirectory() as output_directory_name:
			output_directory = Path(output_directory_name)
			with Preparer(output_directory, self._create_configuration(node_features)) as preparer:
				self._initialize_temp_directory_with_package_files(preparer)

				# Act:
				preparer.prepare_resources()

			# Assert: all relevant properties have been prepared
			resources_files = sorted([path.name for path in preparer.directories.resources.iterdir()])
			self.assertEqual(sorted([f'config-{name}.properties' for name in expected_extensions]), resources_files)

			# - all files have correct permissions:
			for path in preparer.directories.resources.iterdir():
				self.assertEqual(0o600, path.stat().st_mode & 0o700)

	def test_can_extract_resources_peer_node(self):
		self._assert_can_prepare_resources(NodeFeatures.PEER, PEER_EXTENSIONS)

	def test_can_extract_resources_api_node(self):
		self._assert_can_prepare_resources(NodeFeatures.API, PEER_EXTENSIONS + API_EXTENSIONS)

	def test_can_extract_resources_harvester_node(self):
		self._assert_can_prepare_resources(NodeFeatures.HARVESTER, PEER_EXTENSIONS + HARVESTER_EXTENSIONS)

	def test_can_extract_resources_voter_node(self):
		self._assert_can_prepare_resources(NodeFeatures.VOTER, PEER_EXTENSIONS)

	def test_can_extract_resources_full_node(self):
		self._assert_can_prepare_resources(
			NodeFeatures.API | NodeFeatures.HARVESTER | NodeFeatures.VOTER,
			PEER_EXTENSIONS + API_EXTENSIONS + HARVESTER_EXTENSIONS)

	# endregion

	# region configure_resources

	def _assert_can_configure_resources(self, node_features, expected_values, patch_custom=True):
		# Arrange:
		with tempfile.TemporaryDirectory() as output_directory:
			with Preparer(output_directory, self._create_configuration(node_features)) as preparer:
				self._initialize_temp_directory_with_package_files(preparer)
				preparer.prepare_resources()

				# Act:
				preparer.configure_resources({
					'node': [
						('localnode', 'host', 'friendly-node.symbol.cloud'),
						('localnode', 'friendlyName', 'hello friends')
					]
				} if patch_custom else None)

				# Assert:
				extensions_server_values = preparer.config_manager.lookup('config-extensions-server.properties', [
					('extensions', 'extension.filespooling'),
					('extensions', 'extension.partialtransaction'),
				])
				self.assertEqual(expected_values['extensions-server'], extensions_server_values)

				extensions_recovery_values = preparer.config_manager.lookup('config-extensions-recovery.properties', [
					('extensions', 'extension.addressextraction'),
					('extensions', 'extension.mongo'),
					('extensions', 'extension.zeromq')
				])
				self.assertEqual(expected_values['extensions-recovery'], extensions_recovery_values)

				node_values = preparer.config_manager.lookup('config-node.properties', [
					('node', 'enableAutoSyncCleanup'),
					('node', 'trustedHosts'),
					('node', 'localNetworks'),
					('localnode', 'roles'),
					# user patched properties
					('localnode', 'host'),
					('localnode', 'friendlyName'),
				])
				self.assertEqual(expected_values['node'], node_values)

				finalization_values = preparer.config_manager.lookup('config-finalization.properties', [
					('finalization', 'enableVoting'),
					('finalization', 'unfinalizedBlocksDuration')
				])
				self.assertEqual(expected_values['finalization'], finalization_values)

				self.assertEqual(
					'harvesting' in expected_values,
					(preparer.directories.resources / 'config-harvesting.properties').exists())
				if 'harvesting' in expected_values:
					harvesting_values = preparer.config_manager.lookup('config-harvesting.properties', [
						('harvesting', 'enableAutoHarvesting'),
						('harvesting', 'harvesterSigningPrivateKey'),
						('harvesting', 'harvesterVrfPrivateKey')
					])
					self.assertEqual([
						'true',
						str(preparer.harvester_configurator.remote_key_pair.public_key),
						str(preparer.harvester_configurator.vrf_key_pair.public_key)
					], harvesting_values)

				# - all files are readonly
				for path in preparer.directories.resources.iterdir():
					self.assertEqual(0o400, path.stat().st_mode & 0o777)

	def test_can_configure_resources_without_custom_patches(self):
		self._assert_can_configure_resources(NodeFeatures.PEER, {
			'extensions-server': ['false', 'false'],
			'extensions-recovery': ['false', 'false', 'false'],
			'node': ['true', '127.0.0.1', '127.0.0.1', 'Peer', 'myServerHostnameOrPublicIp', 'myServerFriendlyName'],
			'finalization': ['false', '10m']
		}, False)

	def test_can_configure_resources_peer_node(self):
		self._assert_can_configure_resources(NodeFeatures.PEER, {
			'extensions-server': ['false', 'false'],
			'extensions-recovery': ['false', 'false', 'false'],
			'node': ['true', '127.0.0.1', '127.0.0.1', 'Peer', 'friendly-node.symbol.cloud', 'hello friends'],
			'finalization': ['false', '10m']
		})

	def test_can_configure_resources_api_node(self):
		self._assert_can_configure_resources(NodeFeatures.API, {
			'extensions-server': ['true', 'true'],
			'extensions-recovery': ['true', 'true', 'true'],
			'node': ['false', '127.0.0.1', '127.0.0.1,172.2', 'Peer,Api', 'friendly-node.symbol.cloud', 'hello friends'],
			'finalization': ['false', '10m']
		})

	def test_can_configure_resources_harvester_node(self):
		self._assert_can_configure_resources(NodeFeatures.HARVESTER, {
			'extensions-server': ['false', 'false'],
			'extensions-recovery': ['false', 'false', 'false'],
			'node': ['true', '127.0.0.1', '127.0.0.1', 'Peer', 'friendly-node.symbol.cloud', 'hello friends'],
			'finalization': ['false', '10m'],
			'harvesting': True
		})

	def test_can_configure_resources_voter_node(self):
		self._assert_can_configure_resources(NodeFeatures.VOTER, {
			'extensions-server': ['false', 'false'],
			'extensions-recovery': ['false', 'false', 'false'],
			'node': ['true', '127.0.0.1', '127.0.0.1', 'Peer,Voting', 'friendly-node.symbol.cloud', 'hello friends'],
			'finalization': ['true', '0m']
		})

	def test_can_configure_resources_full_node(self):
		self._assert_can_configure_resources(NodeFeatures.API | NodeFeatures.HARVESTER | NodeFeatures.VOTER, {
			'extensions-server': ['true', 'true'],
			'extensions-recovery': ['true', 'true', 'true'],
			'node': [
				'false', '127.0.0.1', '127.0.0.1,172.2', 'Peer,Api,Voting', 'friendly-node.symbol.cloud', 'hello friends'
			],
			'finalization': ['true', '0m'],
			'harvesting': True
		})

	# endregion

	# region configure_mongo

	def _assert_can_configure_mongo(self, node_features, expected_mongo_files):
		# Arrange:
		with tempfile.TemporaryDirectory() as output_directory:
			with Preparer(output_directory, self._create_configuration(node_features)) as preparer:
				source_directory = preparer.directories.temp / 'mongo'
				source_directory.mkdir()
				with open(source_directory / 'foo.txt', 'wt', encoding='utf8') as outfile:
					outfile.write('abc')

				# Act:
				preparer.configure_mongo()

				# Assert:
				if expected_mongo_files:
					self.assertTrue(preparer.directories.mongo.exists())

					mongo_files = sorted(str(path)[len(output_directory) + 6:] for path in Path(output_directory).glob('mongo/*'))
					self.assertEqual(expected_mongo_files, mongo_files)
				else:
					self.assertFalse(preparer.directories.mongo.exists())

	def test_can_configure_mongo_peer_node(self):
		self._assert_can_configure_mongo(NodeFeatures.PEER, None)

	def test_can_configure_mongo_api_node(self):
		self._assert_can_configure_mongo(NodeFeatures.API, ['/foo.txt'])

	# endregion

	# region configure_keys

	@staticmethod
	def _read_voting_key_file_header(voting_key_tree_file):
		with open(voting_key_tree_file, 'rb') as infile:
			reader = BufferReader(infile.read(16))
			start_epoch = reader.read_int(8)
			end_epoch = reader.read_int(8)
			return (start_epoch, end_epoch)

	def _can_configure_keys(self, node_features, expected_keys_files, expected_voting_keys_file=None):
		# Arrange:
		with tempfile.TemporaryDirectory() as output_directory:
			with Preparer(output_directory, self._create_configuration(node_features)) as preparer:
				self._initialize_temp_directory_with_package_files(preparer)
				preparer.prepare_resources()

				# Act:
				preparer.configure_keys(1500, 4)

				# Assert: expected keys files are generated
				keys_files = sorted([path.name for path in preparer.directories.keys.iterdir() if path.name.endswith('.pem')])
				self.assertEqual(expected_keys_files, keys_files)

				# - keys are readonly
				for key_file in keys_files:
					self.assertEqual(0o400, (preparer.directories.keys / key_file).stat().st_mode & 0o700)

				# - if present, voting key file is correct
				self.assertEqual(bool(expected_voting_keys_file), preparer.directories.voting_keys.exists())
				if expected_voting_keys_file:
					voting_keys_file_path = preparer.directories.voting_keys / expected_voting_keys_file[0]
					(start_epoch, end_epoch) = self._read_voting_key_file_header(voting_keys_file_path)
					self.assertEqual(expected_voting_keys_file[1], start_epoch)
					self.assertEqual(expected_voting_keys_file[2], end_epoch)

					# - file is read write
					self.assertEqual(0o600, voting_keys_file_path.stat().st_mode & 0o700)

	def test_can_configure_keys_peer_node(self):
		self._can_configure_keys(NodeFeatures.PEER, [])

	def test_can_configure_keys_api_node(self):
		self._can_configure_keys(NodeFeatures.API, [])

	def test_can_configure_keys_harvester_node(self):
		self._can_configure_keys(NodeFeatures.HARVESTER, ['remote.pem', 'vrf.pem'])

	def test_can_configure_keys_voter_node(self):
		self._can_configure_keys(NodeFeatures.VOTER, [], ('private_key_tree1.dat', 3 + 1 + 4, 3 + 1 + 4 + 359))

	def test_can_configure_keys_full_node(self):
		self._can_configure_keys(
			NodeFeatures.API | NodeFeatures.HARVESTER | NodeFeatures.VOTER,
			['remote.pem', 'vrf.pem'],
			('private_key_tree1.dat', 3 + 1 + 4, 3 + 1 + 4 + 359))

	# endregion

	# region generate_certificates

	@staticmethod
	def _create_ca_private_key(directory):
		OpensslExecutor(os.environ.get('OPENSSL_EXECUTABLE', 'openssl')).dispatch([
			'genpkey',
			'-out', Path(directory) / 'ca.key.pem',
			'-outform', 'PEM',
			'-algorithm', 'ed25519'
		])

	def _assert_all_files_read_only(self, directory, expected_files):
		# check files
		actual_files = sorted(list(path.name for path in Path(directory).iterdir()))
		self.assertEqual(expected_files, actual_files)

		# - check permissions
		for path in Path(directory).iterdir():
			self.assertEqual(0o400, path.stat().st_mode & 0o777)

	def test_cannot_generate_certificates_when_required_ca_key_is_not_present(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as output_directory:
			with Preparer(output_directory, self._create_configuration(NodeFeatures.PEER)) as preparer:
				with tempfile.TemporaryDirectory() as ca_directory:
					Path(ca_directory).mkdir(exist_ok=True)

					preparer.create_subdirectories()

					# Act + Assert:
					with self.assertRaises(RuntimeError):
						preparer.generate_certificates(Path(ca_directory) / 'ca.key.pem', 'CA CN', 'NODE CN')

	def test_can_generate_certificates_when_required_ca_key_is_present(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as output_directory:
			with Preparer(output_directory, self._create_configuration(NodeFeatures.PEER)) as preparer:
				with tempfile.TemporaryDirectory() as ca_directory:
					Path(ca_directory).mkdir(exist_ok=True)
					self._create_ca_private_key(ca_directory)

					preparer.create_subdirectories()

					# Act:
					preparer.generate_certificates(Path(ca_directory) / 'ca.key.pem', 'CA CN', 'NODE CN')

					# Assert: check package files
					self._assert_all_files_read_only(preparer.directories.certificates, [
						'ca.crt.pem', 'ca.pubkey.pem', 'node.crt.pem', 'node.full.crt.pem', 'node.key.pem'
					])

	def test_can_generate_certificates_when_optional_ca_key_is_not_present(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as output_directory:
			with Preparer(output_directory, self._create_configuration(NodeFeatures.PEER)) as preparer:
				with tempfile.TemporaryDirectory() as ca_directory:
					Path(ca_directory).mkdir(exist_ok=True)

					preparer.create_subdirectories()

					# Act:
					preparer.generate_certificates(Path(ca_directory) / 'ca.key.pem', 'CA CN', 'NODE CN', False)

					# Assert: check package files
					self._assert_all_files_read_only(preparer.directories.certificates, [
						'ca.crt.pem', 'ca.pubkey.pem', 'node.crt.pem', 'node.full.crt.pem', 'node.key.pem'
					])

					# - check CA files
					self._assert_all_files_read_only(ca_directory, ['ca.key.pem'])

	# endregion

	# region configure_docker

	def _assert_can_configure_docker(self, node_features, expected_startup_files, expected_service_names):
		# Arrange:
		with tempfile.TemporaryDirectory() as output_directory:
			with Preparer(output_directory, self._create_configuration(node_features)) as preparer:
				# Act:
				preparer.configure_docker({
					'catapult_client_image': 'symbolplatform/symbol-server:gcc-a.b.c.d',
					'catapult_rest_image': 'symbolplatform/symbol-rest:a.b.c',
					'user': '2222:3333'
				})

				# Assert: check startup files
				startup_files = sorted(str(path)[len(output_directory) + 8:] for path in Path(output_directory).glob('startup/*'))
				self.assertEqual(expected_startup_files, startup_files)

				# - check compose file
				expected_image_map = {
					'db': 'mongo:5.0.15',
					'initiate': 'mongo:5.0.15',
					'client': 'symbolplatform/symbol-server:gcc-a.b.c.d',
					'broker': 'symbolplatform/symbol-server:gcc-a.b.c.d',
					'rest-api': 'symbolplatform/symbol-rest:a.b.c'
				}

				service_names = []
				with open(Path(output_directory) / 'docker-compose.yaml', 'rt', encoding='utf8') as infile:
					configuration = yaml.safe_load(infile)
					for service_name in configuration['services']:
						service = configuration['services'][service_name]
						self.assertEqual('2222:3333', service['user'])
						self.assertEqual(expected_image_map[service_name], service['image'])

						service_names.append(service_name)

				self.assertEqual(expected_service_names, service_names)

	def test_can_configure_docker_peer_node(self):
		self._assert_can_configure_docker(NodeFeatures.PEER, ['/startServer.sh'], ['client'])

	def test_can_configure_docker_api_node(self):
		self._assert_can_configure_docker(NodeFeatures.API, [
			'/delayrestapi.sh', '/mongors.sh', '/rest.json', '/startBroker.sh', '/startServer.sh', '/wait.sh'
		], [
			'db', 'initiate', 'client', 'broker', 'rest-api'
		])

	# endregion

	# region prepare_linking_transaction

	@staticmethod
	def _random_public_key():
		return KeyPair(PrivateKey.random()).public_key

	def _assert_can_prepare_linking_transaction(self, existing_links, expected_link_descriptor):
		# Arrange:
		account_public_key = self._random_public_key()

		with tempfile.TemporaryDirectory() as output_directory:
			with Preparer(output_directory, self._create_configuration(NodeFeatures.PEER)) as preparer:
				# Act:
				transaction = preparer.prepare_linking_transaction(account_public_key, existing_links, 2222)

				# Assert:
				expected_size = 168 + 88 + (8 if expected_link_descriptor.epoch_range else 0)
				expected_aggregate_descriptor = AggregateDescriptor(expected_size, 150, 2222 + 2 * 60 * 60 * 1000, account_public_key)
				assert_aggregate_complete_transaction(self, transaction, expected_aggregate_descriptor)
				self.assertEqual(1, len(transaction.transactions))
				assert_link_transaction(self, transaction.transactions[0], expected_link_descriptor)

	def test_prepare_linking_transaction_can_create_aggregate_with_account_key_unlink(self):
		# Arrange:
		existing_links = LinkedPublicKeys()
		existing_links.linked_public_key = self._random_public_key()

		# Act + Assert:
		self._assert_can_prepare_linking_transaction(
			existing_links,
			LinkDescriptor(TransactionType.ACCOUNT_KEY_LINK, existing_links.linked_public_key, LinkAction.UNLINK, None))

	def test_prepare_linking_transaction_can_create_aggregate_with_vrf_key_unlink(self):
		# Arrange:
		existing_links = LinkedPublicKeys()
		existing_links.vrf_public_key = self._random_public_key()

		# Act + Assert:
		self._assert_can_prepare_linking_transaction(
			existing_links,
			LinkDescriptor(TransactionType.VRF_KEY_LINK, existing_links.vrf_public_key, LinkAction.UNLINK, None))

	def test_prepare_linking_transaction_can_create_aggregate_with_voting_key_unlink(self):
		# Arrange:
		existing_links = LinkedPublicKeys()
		existing_links.voting_public_keys = [
			VotingPublicKey(1111, 2222, self._random_public_key()),
			VotingPublicKey(3333, 4444, self._random_public_key()),
		]

		# Act + Assert:
		first_voting_public_key = existing_links.voting_public_keys[0].public_key
		self._assert_can_prepare_linking_transaction(
			existing_links,
			LinkDescriptor(TransactionType.VOTING_KEY_LINK, first_voting_public_key, LinkAction.UNLINK, (1111, 2222)))

	def test_prepare_linking_transaction_can_create_aggregate_with_harvester_link(self):
		# Arrange:
		account_public_key = self._random_public_key()

		with tempfile.TemporaryDirectory() as output_directory:
			with Preparer(output_directory, self._create_configuration(NodeFeatures.HARVESTER)) as preparer:
				preparer.create_subdirectories()
				preparer.configure_keys(1500, 4)

				# Act:
				transaction = preparer.prepare_linking_transaction(account_public_key, LinkedPublicKeys(), 2222)

				# Assert:
				expected_size = 168 + 2 * 88
				expected_aggregate_descriptor = AggregateDescriptor(expected_size, 150, 2222 + 2 * 60 * 60 * 1000, account_public_key)
				assert_aggregate_complete_transaction(self, transaction, expected_aggregate_descriptor)
				self.assertEqual(2, len(transaction.transactions))

				new_remote_public_key = preparer.harvester_configurator.remote_key_pair.public_key
				new_vrf_public_key = preparer.harvester_configurator.vrf_key_pair.public_key
				assert_link_transaction(
					self,
					transaction.transactions[0],
					LinkDescriptor(TransactionType.ACCOUNT_KEY_LINK, new_remote_public_key, LinkAction.LINK, None))
				assert_link_transaction(
					self,
					transaction.transactions[1],
					LinkDescriptor(TransactionType.VRF_KEY_LINK, new_vrf_public_key, LinkAction.LINK, None))

	def test_prepare_linking_transaction_can_create_aggregate_with_voter_link(self):
		# Arrange:
		account_public_key = self._random_public_key()

		with tempfile.TemporaryDirectory() as output_directory:
			with Preparer(output_directory, self._create_configuration(NodeFeatures.VOTER)) as preparer:
				self._initialize_temp_directory_with_package_files(preparer)
				preparer.prepare_resources()
				preparer.configure_keys(1500, 4)

				# Act:
				transaction = preparer.prepare_linking_transaction(account_public_key, LinkedPublicKeys(), 2222)

				# Assert:
				expected_size = 168 + 88 + 8
				expected_aggregate_descriptor = AggregateDescriptor(expected_size, 150, 2222 + 2 * 60 * 60 * 1000, account_public_key)
				assert_aggregate_complete_transaction(self, transaction, expected_aggregate_descriptor)
				self.assertEqual(1, len(transaction.transactions))

				new_voting_public_key = preparer.voter_configurator.voting_key_pair.public_key
				assert_link_transaction(
					self,
					transaction.transactions[0],
					LinkDescriptor(TransactionType.VOTING_KEY_LINK, new_voting_public_key, LinkAction.LINK, (8, 8 + 359)))

	def test_prepare_linking_transaction_can_create_aggregate_with_all_links_and_unlinks(self):
		# Arrange:
		account_public_key = self._random_public_key()

		existing_links = LinkedPublicKeys()
		existing_links.linked_public_key = self._random_public_key()
		existing_links.vrf_public_key = self._random_public_key()
		existing_links.voting_public_keys = [
			VotingPublicKey(1111, 2222, self._random_public_key()),
			VotingPublicKey(3333, 4444, self._random_public_key()),
		]

		with tempfile.TemporaryDirectory() as output_directory:
			with Preparer(output_directory, self._create_configuration(NodeFeatures.HARVESTER | NodeFeatures.VOTER)) as preparer:
				self._initialize_temp_directory_with_package_files(preparer)
				preparer.prepare_resources()
				preparer.configure_keys(1500, 4)

				# Act:
				transaction = preparer.prepare_linking_transaction(account_public_key, existing_links, 2222)

				# Assert:
				expected_size = 168 + 6 * 88 + 2 * 8
				expected_aggregate_descriptor = AggregateDescriptor(expected_size, 150, 2222 + 2 * 60 * 60 * 1000, account_public_key)
				assert_aggregate_complete_transaction(self, transaction, expected_aggregate_descriptor)
				self.assertEqual(6, len(transaction.transactions))

				# - check unlinks
				assert_link_transaction(
					self,
					transaction.transactions[0],
					LinkDescriptor(TransactionType.ACCOUNT_KEY_LINK, existing_links.linked_public_key, LinkAction.UNLINK, None))
				assert_link_transaction(
					self,
					transaction.transactions[1],
					LinkDescriptor(TransactionType.VRF_KEY_LINK, existing_links.vrf_public_key, LinkAction.UNLINK, None))

				first_existing_voting_public_key = existing_links.voting_public_keys[0].public_key
				assert_link_transaction(
					self,
					transaction.transactions[2],
					LinkDescriptor(TransactionType.VOTING_KEY_LINK, first_existing_voting_public_key, LinkAction.UNLINK, (1111, 2222)))

				# - check links
				new_remote_public_key = preparer.harvester_configurator.remote_key_pair.public_key
				new_vrf_public_key = preparer.harvester_configurator.vrf_key_pair.public_key
				new_voting_public_key = preparer.voter_configurator.voting_key_pair.public_key
				assert_link_transaction(
					self,
					transaction.transactions[3],
					LinkDescriptor(TransactionType.ACCOUNT_KEY_LINK, new_remote_public_key, LinkAction.LINK, None))
				assert_link_transaction(
					self,
					transaction.transactions[4],
					LinkDescriptor(TransactionType.VRF_KEY_LINK, new_vrf_public_key, LinkAction.LINK, None))
				assert_link_transaction(
					self,
					transaction.transactions[5],
					LinkDescriptor(TransactionType.VOTING_KEY_LINK, new_voting_public_key, LinkAction.LINK, (8, 8 + 359)))

	# endregion
