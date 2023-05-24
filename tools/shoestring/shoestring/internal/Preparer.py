import os
import shutil
import tempfile
from collections import namedtuple
from pathlib import Path

from symbolchain.symbol.Network import NetworkTimestamp

from .CertificateFactory import CertificateFactory
from .ConfigurationManager import ConfigurationManager
from .FileTemplater import apply_template
from .HarvesterConfigurator import HarvesterConfigurator
from .LinkTransactionBuilder import LinkTransactionBuilder
from .NodeFeatures import NodeFeatures
from .OpensslExecutor import OpensslExecutor
from .VoterConfigurator import VoterConfigurator

VotingKeyDescriptor = namedtuple('VotingKeyDescriptor', ['public_key', 'start_epoch', 'end_epoch'])

PEER_EXTENSIONS = [
	'extensions-recovery',
	'extensions-server',
	'finalization',
	'inflation',
	'logging-recovery',
	'logging-server',
	'network',
	'node',
	'task',
	'timesync',
	'user'
]
API_EXTENSIONS = ['database', 'extensions-broker', 'logging-broker', 'messaging', 'pt']
HARVESTER_EXTENSIONS = ['harvesting']


class Preparer:
	"""Prepares a Symbol directory for execution."""

	# pylint: disable=too-many-instance-attributes

	class DirectoryLocator:
		"""Provides easy access to output locations."""

		def __init__(self, temp_directory, output_directory):
			"""Creates a directory locator."""

			self.temp_directory = temp_directory
			self.output_directory = output_directory

		@property
		def temp(self):
			"""Temp directory (contents will automatically be deleted)."""

			return self.temp_directory

		@property
		def seed(self):
			"""Block seed directory."""

			return self.output_directory / 'seed'

		@property
		def startup(self):
			"""Startup scripts directory."""

			return self.output_directory / 'startup'

		@property
		def mongo(self):
			"""Mongo scripts directory."""

			return self.output_directory / 'mongo'

		@property
		def dbdata(self):
			"""Db data."""

			return self.output_directory / 'dbdata'

		@property
		def resources(self):
			"""Resources directory."""

			return self.output_directory / 'resources'

		@property
		def keys(self):
			"""Keys directory."""
			return self.output_directory / 'keys'

		@property
		def certificates(self):
			"""Certificates directory."""

			return self.output_directory / 'keys' / 'cert'

		@property
		def voting_keys(self):
			"""Voting keys directory."""

			return self.output_directory / 'keys' / 'voting'

	def __init__(self, directory, config, logger=None):
		"""Creates a preparer for preparing a Symbol node with the specified features ."""

		self.directory = Path(directory)
		self.config = config
		self.log = logger

		self.node_features = self.config.node.features
		self.temp_directory = None
		self.new_voting_key_file_epoch_range = None

		self.config_manager = ConfigurationManager(self.directories.resources)
		self.harvester_configurator = HarvesterConfigurator(self.config_manager)
		self.voter_configurator = VoterConfigurator(self.config_manager)

	def __enter__(self):
		self.temp_directory = tempfile.TemporaryDirectory()
		return self

	def __exit__(self, *args):
		self.temp_directory.__exit__(*args)

	@property
	def directories(self):
		"""Gets a locator providing easy access to output locations."""

		return self.DirectoryLocator(Path(self.temp_directory.name) if self.temp_directory else None, self.directory)

	def create_subdirectories(self):
		"""Creates all subdirectories."""

		directories = [self.directory / 'data', self.directory / 'logs', self.directories.certificates, self.directories.resources]
		if NodeFeatures.API in self.node_features:
			directories.append(self.directories.dbdata)

		if NodeFeatures.VOTER in self.node_features:
			directories.append(self.directories.voting_keys)

		for directory in directories:
			directory.mkdir(mode=0o700, parents=True, exist_ok=False)

	def _copy_file(self, source_path, destination_path):
		if self.log:
			self.log.info(f'copying FILE {source_path} into {destination_path}')

		shutil.copy(source_path, destination_path)

	def _copy_tree(self, source_path, destination_path):
		if self.log:
			self.log.info(f'copying TREE {source_path} to {destination_path}')

		shutil.copytree(source_path, destination_path)

	def _copy_properties_files(self, extensions):
		for extension in extensions:
			filename = f'config-{extension}.properties'
			destination_path = self.directories.resources / filename
			self._copy_file(self.directories.temp / 'resources' / filename, destination_path)
			destination_path.chmod(0o600)

	def prepare_resources(self):
		"""Copies proper property files from temp directory to resources directory."""

		self._copy_properties_files(PEER_EXTENSIONS)

		if NodeFeatures.API in self.node_features:
			self._copy_properties_files(API_EXTENSIONS)

		if NodeFeatures.HARVESTER in self.node_features:
			self._copy_properties_files(HARVESTER_EXTENSIONS)

	def prepare_seed(self):
		"""Copies seed directory."""

		self._copy_tree(self.directories.temp / 'seed', self.directories.seed)

	def configure_resources(self, user_patches=None):
		"""Configures resources based on enabled features."""

		if NodeFeatures.API in self.node_features:
			patches = {
				'extensions-server': [
					('extensions', 'extension.filespooling', 'true'),
					('extensions', 'extension.partialtransaction', 'true'),
				],
				'extensions-recovery': [
					('extensions', 'extension.addressextraction', 'true'),
					('extensions', 'extension.mongo', 'true'),
					('extensions', 'extension.zeromq', 'true'),
				],
				'node': [
					('node', 'enableAutoSyncCleanup', 'false'),
					('node', 'trustedHosts', '127.0.0.1'),
					('node', 'localNetworks', '127.0.0.1,172.2'),
					('localnode', 'roles', 'Peer,Api'),
				]
			}

			for extension, replacements in patches.items():
				self.config_manager.patch(f'config-{extension}.properties', replacements)

		if NodeFeatures.HARVESTER in self.node_features:
			self.harvester_configurator.patch_configuration()

		if NodeFeatures.VOTER in self.node_features:
			self.voter_configurator.patch_configuration()

		if user_patches:
			for extension, replacements in user_patches.items():
				self.config_manager.patch(f'config-{extension}.properties', replacements)

		# make all resources read only
		for file in self.directories.resources.iterdir():
			file.chmod(0o400)

	def configure_mongo(self):
		"""Copies mongo directory."""

		if NodeFeatures.API not in self.node_features:
			return

		self._copy_tree(self.directories.temp / 'mongo', self.directories.mongo)

	def configure_keys(self, last_finalized_height=1, grace_period_epochs=1):
		"""Configures key pairs based on enabled features."""

		if NodeFeatures.HARVESTER in self.node_features:
			self.harvester_configurator.generate_harvester_key_files(self.directories.keys)

		if NodeFeatures.VOTER in self.node_features:
			self.new_voting_key_file_epoch_range = self.voter_configurator.generate_voting_key_file(
				self.directories.voting_keys,
				last_finalized_height,
				grace_period_epochs)

	def generate_certificates(self, ca_key_path, ca_cn, node_cn, require_ca=True):
		"""Generates and packages all certificates."""

		ca_key_path = Path(ca_key_path).absolute()
		if not ca_key_path.exists() and require_ca:
			raise RuntimeError(f'CA key is required but does not exist at path {ca_key_path}')

		openssl_executor = OpensslExecutor(os.environ.get('OPENSSL_EXECUTABLE', 'openssl'))
		with CertificateFactory(openssl_executor, ca_key_path, self.config.node.ca_password) as factory:
			if not ca_key_path.exists():
				factory.generate_random_ca_private_key()
				factory.export_ca()

			factory.extract_ca_public_key()
			factory.generate_ca_certificate(ca_cn)
			factory.generate_random_node_private_key()
			factory.generate_node_certificate(node_cn)
			factory.create_node_certificate_chain()

			factory.package(self.directories.certificates)

	def configure_docker(self, user_entry):
		"""Prepares docker-compose file."""

		if NodeFeatures.API in self.node_features:
			#
			# TODO: where should those (startup + docker templates) be copied from?
			# we can copy from within repo, but will shoestring be a separate installable (pypi) package?
			#
			self._copy_tree('startup', self.directories.startup)
		else:
			self.directories.startup.mkdir(exist_ok=True)
			self._copy_file('startup/startServer.sh', self.directories.startup)

		compose_template_filename_postfix = 'dual' if NodeFeatures.API in self.node_features else 'peer'
		compose_template_filename = f'templates/docker-compose-{compose_template_filename_postfix}.yaml'
		apply_template(compose_template_filename, {
			'catapult_client_image': 'symbolplatform/symbol-server:gcc-1.0.3.6',
			'catapult_rest_image': 'symbolplatform/symbol-rest:2.4.3',
			'user': user_entry
		}, self.directory / 'docker-compose.yaml')

	def prepare_linking_transaction(self, account_public_key, existing_links, timestamp):
		"""Creates an aggregate transaction containing account key link and unlink transactions """

		transaction_builder = LinkTransactionBuilder(account_public_key, self.config.network)

		if existing_links.linked_public_key:
			transaction_builder.unlink_account_public_key(existing_links.linked_public_key)

		if existing_links.vrf_public_key:
			transaction_builder.unlink_vrf_public_key(existing_links.vrf_public_key)

		if existing_links.voting_public_keys:
			transaction_builder.unlink_voting_public_key(
				existing_links.voting_public_keys[0].public_key,
				existing_links.voting_public_keys[0].start_epoch,
				existing_links.voting_public_keys[0].end_epoch)

		if NodeFeatures.HARVESTER in self.node_features:
			transaction_builder.link_account_public_key(self.harvester_configurator.remote_key_pair.public_key)
			transaction_builder.link_vrf_public_key(self.harvester_configurator.vrf_key_pair.public_key)

		if NodeFeatures.VOTER in self.node_features and self.new_voting_key_file_epoch_range:
			transaction_builder.link_voting_public_key(
				self.voter_configurator.voting_key_pair.public_key,
				*self.new_voting_key_file_epoch_range)

		aggregate_transaction, transaction_hash = transaction_builder.build(NetworkTimestamp(timestamp).add_hours(2), 150)
		if self.log:
			self.log.info(f'created aggregate transaction with hash {transaction_hash}')

		return aggregate_transaction
