import logging
import shutil
from collections import namedtuple
from pathlib import Path

from shoestring.commands.import_bootstrap import run_main as run_import_bootstrap
from shoestring.commands.init import run_main as run_init
from shoestring.internal.ConfigurationManager import ConfigurationManager, load_shoestring_patches_from_file
from shoestring.internal.NodeFeatures import NodeFeatures

InitArgs = namedtuple('InitArgs', ['package', 'config'])
ImportBootstrapArgs = namedtuple('ImportBootstrapArgs', ['config', 'bootstrap', 'include_node_key'])


class DisableLogger:
	def __enter__(self):
		logging.disable(logging.CRITICAL)

	def __exit__(self, exit_type, exit_value, exit_traceback):
		logging.disable(logging.NOTSET)


def _to_bool_string(flag):
	return 'true' if flag else 'false'


def try_prepare_rest_overrides_file(screens, output_filename):
	"""Prepares a REST overrides file based on screens, if specified."""

	node_type = screens.get('node-type').current_value
	node_settings = screens.get('node-settings')

	if 'dual' != node_type or not node_settings.metadata_info:
		return False

	with open(output_filename, 'wt', encoding='utf8') as outfile:
		outfile.write(f'{{"nodeMetadata":{node_settings.metadata_info}}}')

	return True


def prepare_overrides_file(screens, output_filename):
	"""Prepares an overrides file based on screens."""

	harvesting = screens.get('harvesting')
	node_settings = screens.get('node-settings')

	with open(output_filename, 'wt', encoding='utf8') as outfile:
		if harvesting.active:
			enable_auto_detection = _to_bool_string(harvesting.enable_delegated_harvesters_auto_detection)
			outfile.write('\n'.join([
				'[user.account]',
				f'enableDelegatedHarvestersAutoDetection = {enable_auto_detection}',
				'',
				'[harvesting.harvesting]',
				f'maxUnlockedAccounts = {harvesting.max_unlocked_accounts}',
				f'beneficiaryAddress = {harvesting.beneficiary_address}',
				'',
				'[node.node]',
				f'minFeeMultiplier = {harvesting.min_fee_multiplier}',
				'',
				''
			]))

		outfile.write('\n'.join([
			'[node.localnode]',
			f'host = {node_settings.domain_name}',
			f'friendlyName = {node_settings.friendly_name}',
		]))


async def prepare_shoestring_config(network_type, config_filepath):
	"""Run shoestring init command."""

	with DisableLogger():
		await run_init(InitArgs(network_type, config_filepath))


async def prepare_shoestring_files(screens, temp_directory, shoestring_directory):  # pylint: disable=too-many-locals
	"""Prepares shoestring configuration files based on screens."""

	network_type = screens.get('network-type').current_value
	node_type = screens.get('node-type').current_value
	certificates = screens.get('certificates')
	harvesting = screens.get('harvesting')
	voting = screens.get('voting')
	node_settings = screens.get('node-settings')
	bootstrap_import = screens.get('bootstrap')

	config_filepath = shoestring_directory / 'shoestring.ini'
	await prepare_shoestring_config(network_type, config_filepath)
	node_features = NodeFeatures.PEER
	if bootstrap_import.active:
		await patch_bootstrap_shoestring_config(bootstrap_import.path, config_filepath, bootstrap_import.include_node_key)

		def is_feature_enabled(extension, config_property):
			bootstrap_configuration_manager = ConfigurationManager(Path(bootstrap_import.path) / 'nodes/node/server-config/resources')
			return 'true' == bootstrap_configuration_manager.lookup(f'config-{extension}.properties', [config_property])[0]

		if is_feature_enabled('harvesting', ('harvesting', 'enableAutoHarvesting')):
			node_features |= NodeFeatures.HARVESTER

		if is_feature_enabled('finalization', ('finalization', 'enableVoting')):
			node_features |= NodeFeatures.VOTER

	if node_type in ['dual', 'light']:
		node_features = node_features | NodeFeatures.API

	if harvesting.active:
		node_features = node_features | NodeFeatures.HARVESTER

	if voting.active:
		node_features = node_features | NodeFeatures.VOTER

	replacements = [
		('node', 'apiHttps', _to_bool_string(node_settings.api_https)),
		('node', 'caCommonName', certificates.ca_common_name),
		('node', 'nodeCommonName', certificates.node_common_name),
		('node', 'features', node_features.to_formatted_string()),
		('node', 'lightApi', 'light' == node_type)
	]

	if harvesting.active and not bootstrap_import.active:
		config_harvesting_filepath = None
		if not harvesting.auto_harvest:
			config_harvesting_filepath = 'none'
		elif not harvesting.generate_keys:
			# create a .properties file with harvesting keys
			config_harvesting_filepath = temp_directory / 'config-harvesting.properties'
			with open(config_harvesting_filepath, 'wt', encoding='utf8') as outfile:
				outfile.write('\n'.join([
					'[harvesting]',
					f'harvesterSigningPrivateKey = {harvesting.harvester_signing_private_key}',
					f'harvesterVrfPrivateKey = {harvesting.harvester_vrf_private_key}'
				]))

		if config_harvesting_filepath:
			replacements.append(('imports', 'harvester', str(config_harvesting_filepath)))

	ConfigurationManager(config_filepath.parent).patch(config_filepath.name, replacements)


def patch_shoestring_config(shoestring_filepath, package_config_filepath):
	"""Patches shoestring configuration files."""

	config_patches = load_shoestring_patches_from_file(shoestring_filepath, ['transaction', 'imports', 'node'])
	new_config_manager = ConfigurationManager(package_config_filepath.parent)
	new_config_manager.patch(package_config_filepath.name, config_patches)
	shutil.copy(package_config_filepath, shoestring_filepath)


async def patch_bootstrap_shoestring_config(bootstrap_target_path, config_filepath, include_node_key=False):
	"""Run shoestring import bootstrap command."""

	with DisableLogger():
		await run_import_bootstrap(ImportBootstrapArgs(config_filepath, bootstrap_target_path, include_node_key))
