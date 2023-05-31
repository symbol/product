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
		def rest_cache(self):
			"""REST cache directory."""

			return self.output_directory / 'rest-cache'

		@property
		def https_proxy(self):
			"""Https proxy directory."""

			return self.output_directory / 'https-proxy'

		@property
		def userconfig(self):
			"""User configuration directory."""

			return self.output_directory / 'userconfig'

		@property
		def resources(self):
			"""Resources directory."""

			return self.output_directory / 'userconfig' / 'resources'

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

		directories = [
			self.directory / 'data',
			self.directory / 'logs',
			self.directories.keys,
			self.directories.certificates,
			self.directories.userconfig,
			self.directories.resources
		]
		if NodeFeatures.API in self.config.node.features:
			directories.append(self.directories.dbdata)
			directories.append(self.directories.rest_cache)
			if self.config.node.api_https:
				directories.append(self.directories.https_proxy)

		if NodeFeatures.VOTER in self.config.node.features:
			directories.append(self.directories.voting_keys)

		for directory in directories:
			directory.mkdir(mode=0o700, exist_ok=False)

	@staticmethod
	def _make_files_readonly(directory):
		for filepath in directory.iterdir():
			if filepath.is_dir():
				filepath.chmod(0o700)
				Preparer._make_files_readonly(filepath)
			elif filepath.is_file():
				filepath.chmod(0o400)

	def _copy_file(self, source_path, destination_path):
		if self.log:
			self.log.info(f'copying FILE {source_path} into {destination_path}')

		shutil.copy(source_path, destination_path)

	def _copy_tree_readonly(self, source_path, destination_path):
		if self.log:
			self.log.info(f'copying TREE {source_path} to {destination_path}')

		shutil.copytree(source_path, destination_path, copy_function=shutil.copy)
		self._make_files_readonly(destination_path)
		destination_path.touch()
		destination_path.chmod(0o700)

	def prepare_seed(self):
		"""Copies seed directory."""

		self._copy_tree_readonly(self.directories.temp / 'seed', self.directories.seed)

	def _copy_properties_files(self, extensions):
		for extension in extensions:
			filename = f'config-{extension}.properties'
			destination_path = self.directories.resources / filename
			self._copy_file(self.directories.temp / 'resources' / filename, destination_path)
			destination_path.chmod(0o600)

	def prepare_resources(self):
		"""Copies proper property files from temp directory to resources directory."""

		self._copy_properties_files(PEER_EXTENSIONS)

		if NodeFeatures.API in self.config.node.features:
			self._copy_properties_files(API_EXTENSIONS)

		if NodeFeatures.HARVESTER in self.config.node.features:
			self._copy_properties_files(HARVESTER_EXTENSIONS)

	def _patch_resources(self, patches):
		for extension, replacements in patches.items():
			self.config_manager.patch(f'config-{extension}.properties', replacements)

	def configure_resources(self, user_patches=None):
		"""Configures resources based on enabled features."""

		if NodeFeatures.API in self.config.node.features:
			self._patch_resources({
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
					('node', 'localNetworks', '127.0.0.1,172.20'),
					('localnode', 'roles', 'Peer,Api'),
				]
			})

		if NodeFeatures.HARVESTER in self.config.node.features:
			self.harvester_configurator.patch_configuration()
		else:
			self._patch_resources({
				'extensions-server': [
					('extensions', 'extension.harvesting', 'false')
				]
			})

		if NodeFeatures.VOTER in self.config.node.features:
			self.voter_configurator.patch_configuration()

		if user_patches:
			self._patch_resources(user_patches)

		# make all resources read only
		self._make_files_readonly(self.directories.resources)

	def configure_rest(self):
		"""Copies mongo and rest files."""

		if NodeFeatures.API not in self.config.node.features:
			return

		self._copy_tree_readonly(self.directories.temp / 'mongo', self.directories.mongo)
		self._make_files_readonly(self.directories.mongo)

		self._copy_file(self.directories.temp / 'rest' / 'rest.json', self.directories.userconfig)
		self._make_files_readonly(self.directories.userconfig)

	def configure_https(self):
		"""Configures https proxy."""

		if not self.config.node.api_https:
			return

		self._copy_file('templates/nginx.conf.erb', self.directories.https_proxy)
		(self.directories.https_proxy / 'nginx.conf.erb').chmod(0o400)

	def configure_keys(self, current_finalization_epoch=1, grace_period_epochs=1):
		"""Configures key pairs based on enabled features."""

		if NodeFeatures.HARVESTER in self.config.node.features:
			self.harvester_configurator.generate_harvester_key_files(self.directories.keys)

		if NodeFeatures.VOTER in self.config.node.features:
			self.new_voting_key_file_epoch_range = self.voter_configurator.generate_voting_key_file(
				self.directories.voting_keys,
				current_finalization_epoch,
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

	def configure_docker(self, template_mapping):
		"""Prepares docker-compose file."""

		if NodeFeatures.API in self.config.node.features:
			#
			# TODO: where should those (startup + docker templates) be copied from?
			# we can copy from within repo, but will shoestring be a separate installable (pypi) package?
			#
			self._copy_tree_readonly('startup', self.directories.startup)

		compose_template_filename_postfix = 'dual' if NodeFeatures.API in self.config.node.features else 'peer'
		compose_template_filename = f'templates/docker-compose-{compose_template_filename_postfix}.yaml'
		compose_output_filepath = self.directory / 'docker-compose.yaml'
		apply_template(compose_template_filename, template_mapping, compose_output_filepath)
		compose_output_filepath.chmod(0o400)

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

		if NodeFeatures.HARVESTER in self.config.node.features:
			transaction_builder.link_account_public_key(self.harvester_configurator.remote_key_pair.public_key)
			transaction_builder.link_vrf_public_key(self.harvester_configurator.vrf_key_pair.public_key)

		if NodeFeatures.VOTER in self.config.node.features and self.new_voting_key_file_epoch_range:
			transaction_builder.link_voting_public_key(
				self.voter_configurator.voting_key_pair.public_key,
				*self.new_voting_key_file_epoch_range)

		aggregate_transaction, transaction_hash = transaction_builder.build(NetworkTimestamp(timestamp).add_hours(2), 150)
		if self.log:
			self.log.info(f'created aggregate transaction with hash {transaction_hash}')

		return aggregate_transaction
