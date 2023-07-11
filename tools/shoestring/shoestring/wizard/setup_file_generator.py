import logging
from collections import namedtuple

from shoestring.commands.init import run_main as run_init
from shoestring.internal.ConfigurationManager import ConfigurationManager
from shoestring.internal.NodeFeatures import NodeFeatures

InitArgs = namedtuple('InitArgs', ['package', 'config'])


class DisableLogger:
	def __enter__(self):
		logging.disable(logging.CRITICAL)

	def __exit__(self, exit_type, exit_value, exit_traceback):
		logging.disable(logging.NOTSET)


def _to_bool_string(flag):
	return 'true' if flag else 'false'


def try_prepare_node_metadata_file(screens, output_filename):
	"""Prepares a node metadata file based on screens, if specified."""

	node_type = screens.get('node-type').current_value
	node_settings = screens.get('node-settings')

	if 'dual' != node_type or not node_settings.metadata_info:
		return False

	with open(output_filename, 'wt', encoding='utf8') as outfile:
		outfile.write(node_settings.metadata_info)

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


async def prepare_shoestring_files(screens, directory):
	"""Prepares shoestring configuration files based on screens."""

	network_type = screens.get('network-type').current_value
	node_type = screens.get('node-type').current_value
	certificates = screens.get('certificates')
	harvesting = screens.get('harvesting')
	voting = screens.get('voting')
	node_settings = screens.get('node-settings')

	# TODO: modify rest settings
	# node_settings.metadata_info ?

	config_filepath = directory / 'shoestring.ini'
	with DisableLogger():
		await run_init(InitArgs(network_type, config_filepath))

	node_features = NodeFeatures.PEER
	if 'dual' == node_type:
		node_features = node_features | NodeFeatures.API

	if harvesting.active:
		node_features = node_features | NodeFeatures.HARVESTER

	if voting.active:
		node_features = node_features | NodeFeatures.VOTER

	replacements = [
		('node', 'apiHttps', _to_bool_string(node_settings.api_https)),
		('node', 'caCommonName', certificates.ca_common_name),
		('node', 'nodeCommonName', certificates.node_common_name),
		('node', 'features', ','.join(node_feature[len('NodeFeatures.'):] for node_feature in str(node_features).split(',')))
	]

	if harvesting.active:
		config_harvesting_filepath = None
		if not harvesting.auto_harvest:
			config_harvesting_filepath = 'none'
		elif not harvesting.generate_keys:
			# create a .properties file with harvesting keys
			config_harvesting_filepath = directory / 'config-harvesting.properties'
			with open(config_harvesting_filepath, 'wt', encoding='utf8') as outfile:
				outfile.write('\n'.join([
					'[harvesting]',
					f'harvesterSigningPrivateKey = {harvesting.harvester_signing_private_key}',
					f'harvesterVrfPrivateKey = {harvesting.harvester_vrf_private_key}'
				]))

		if config_harvesting_filepath:
			replacements.append(('imports', 'harvester', str(config_harvesting_filepath)))

	ConfigurationManager(config_filepath.parent).patch(config_filepath.name, replacements)
