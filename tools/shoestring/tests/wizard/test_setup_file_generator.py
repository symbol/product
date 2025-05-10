import tempfile
from collections import namedtuple
from pathlib import Path

from shoestring.internal.ConfigurationManager import ConfigurationManager, load_shoestring_patches_from_file
from shoestring.internal.NodeFeatures import NodeFeatures
from shoestring.internal.ShoestringConfiguration import parse_shoestring_configuration
from shoestring.wizard.setup_file_generator import (
	patch_shoestring_config,
	prepare_overrides_file,
	prepare_shoestring_files,
	try_prepare_rest_overrides_file
)

from ..test.TestPackager import prepare_testnet_package

CertificatesScreen = namedtuple('CertificatesScreen', ['ca_common_name', 'node_common_name'])
HarvestingScreen = namedtuple('HarvestingScreen', [
	'active',
	'auto_harvest',
	'generate_keys',
	'enable_delegated_harvesters_auto_detection',
	'harvester_signing_private_key',
	'harvester_vrf_private_key',
	'max_unlocked_accounts',
	'min_fee_multiplier',
	'beneficiary_address'
])
NodeSettingsScreen = namedtuple('NodeSettingsScreen', ['domain_name', 'friendly_name', 'api_https', 'metadata_info'])
SingleValueScreen = namedtuple('SingleValueScreen', ['current_value'])
VotingScreen = namedtuple('VotingScreen', ['active'])
BootstrapScreen = namedtuple('BootstrapScreen', ['active', 'include_node_key', 'path'])


# pylint: disable=invalid-name


# region try_prepare_rest_overrides_file

def _assert_can_prepare_rest_overrides_file(node_type, node_metadata, should_create):
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory:
		rest_overrides_filepath = Path(output_directory) / 'metadata.json'

		# Act:
		try_prepare_rest_overrides_file({
			'node-type': SingleValueScreen(node_type),
			'node-settings': NodeSettingsScreen(None, None, None, node_metadata)
		}, rest_overrides_filepath)

		# Assert:
		assert should_create == rest_overrides_filepath.exists()

		if should_create:
			with open(rest_overrides_filepath, 'rt', encoding='utf8') as infile:
				metadata_contents = infile.read()
				assert '{"nodeMetadata":{"animal": "wolf"}}' == metadata_contents


def test_can_prepare_rest_overrides_file_when_dual_mode_and_metadata_specified():
	_assert_can_prepare_rest_overrides_file('dual', '{"animal": "wolf"}', True)


def test_cannot_prepare_rest_overrides_file_when_peer_mode_and_metadata_specified():
	_assert_can_prepare_rest_overrides_file('peer', '{"animal": "wolf"}', False)


def test_cannot_prepare_rest_overrides_file_when_dual_mode_and_no_metadata_specified():
	_assert_can_prepare_rest_overrides_file('dual', '', False)


def test_cannot_prepare_rest_overrides_file_when_light_mode():
	_assert_can_prepare_rest_overrides_file('light', '', False)

# endregion


# region prepare_overrides_file

def _assert_can_prepare_overrides_file_when_harvesting_enabled(expected_auto_detection_value):
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory:
		overrides_filepath = Path(output_directory) / 'overrides.ini'

		# Act:
		prepare_overrides_file({
			'harvesting': HarvestingScreen(True, False, False, 'true' == expected_auto_detection_value, None, None, 7, 111, 'abc'),
			'node-settings': NodeSettingsScreen('san.symbol.ninja', 'Symbol San', None, None)
		}, overrides_filepath)

		# Assert:
		with open(overrides_filepath, 'rt', encoding='utf8') as infile:
			overrides_contents = infile.read()
			assert '\n'.join([
				'[user.account]',
				f'enableDelegatedHarvestersAutoDetection = {expected_auto_detection_value}',
				'',
				'[harvesting.harvesting]',
				'maxUnlockedAccounts = 7',
				'beneficiaryAddress = abc',
				'',
				'[node.node]',
				'minFeeMultiplier = 111',
				'',
				'[node.localnode]',
				'host = san.symbol.ninja',
				'friendlyName = Symbol San'
			]) == overrides_contents


def test_can_prepare_overrides_file_when_harvesting_enabled_with_auto_detection():
	_assert_can_prepare_overrides_file_when_harvesting_enabled('true')


def test_can_prepare_overrides_file_when_harvesting_enabled_without_auto_detection():
	_assert_can_prepare_overrides_file_when_harvesting_enabled('false')


def test_can_prepare_overrides_file_when_harvesting_disabled():
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory:
		overrides_filepath = Path(output_directory) / 'overrides.ini'

		# Act:
		prepare_overrides_file({
			'harvesting': HarvestingScreen(False, False, False, True, None, None, None, None, None),
			'node-settings': NodeSettingsScreen('san.symbol.ninja', 'Symbol San', None, None)
		}, overrides_filepath)

		# Assert:
		with open(overrides_filepath, 'rt', encoding='utf8') as infile:
			overrides_contents = infile.read()
			assert '\n'.join([
				'[node.localnode]',
				'host = san.symbol.ninja',
				'friendlyName = Symbol San'
			]) == overrides_contents

# endregion


# region prepare_shoestring_files

def _lookup_harvester_private_keys(properties_filepath):
	return ConfigurationManager(properties_filepath.parent).lookup(properties_filepath.name, [
		('harvesting', 'harvesterSigningPrivateKey'),
		('harvesting', 'harvesterVrfPrivateKey')
	])


async def _assert_can_prepare_shoestring_files(expected_node_features, node_type, **kwargs):
	# Arrange:
	with tempfile.TemporaryDirectory() as package_directory:
		prepare_testnet_package(package_directory, 'resources.zip')

		with tempfile.TemporaryDirectory() as output_directory:
			harvesting_properties_filepath = Path(output_directory) / 'config-harvesting.properties'
			is_harvester_imported = 'harvester_signing_private_key' in kwargs
			is_auto_harvest_enabled = kwargs.get('is_auto_harvest_enabled', True)

			# Act:
			await prepare_shoestring_files({
				'network-type': SingleValueScreen(f'file://{Path(package_directory) / "resources.zip"}'),
				'node-type': SingleValueScreen(node_type),
				'certificates': CertificatesScreen('my ca common name', 'my node common name'),
				'harvesting': HarvestingScreen(
					kwargs.get('is_harvesting_active', False),
					is_auto_harvest_enabled,
					'harvester_signing_private_key' not in kwargs,
					True,
					kwargs.get('harvester_signing_private_key', None),
					kwargs.get('harvester_vrf_private_key', None),
					None,
					None,
					None),
				'voting': VotingScreen(kwargs.get('is_voting_active', False)),
				'node-settings': NodeSettingsScreen('san.symbol.ninja', 'Symbol San', kwargs.get('api_https', False), None),
				'bootstrap': BootstrapScreen(False, None, False),
			}, Path(output_directory), Path(output_directory))

			# Assert:
			config = parse_shoestring_configuration(Path(output_directory) / 'shoestring.ini')
			assert kwargs.get('expected_api_https', False) == config.node.api_https
			assert 'my ca common name' == config.node.ca_common_name
			assert 'my node common name' == config.node.node_common_name
			assert expected_node_features == config.node.features
			assert ('dual' == node_type) == config.node.full_api

			if not is_harvester_imported or not is_auto_harvest_enabled:
				assert ('' if is_auto_harvest_enabled else 'none') == config.imports.harvester

				assert not harvesting_properties_filepath.exists()
				return

			assert str(harvesting_properties_filepath) == config.imports.harvester

			assert harvesting_properties_filepath.exists()

			private_keys = _lookup_harvester_private_keys(harvesting_properties_filepath)
			assert 2 == len(private_keys)
			assert kwargs.get('harvester_signing_private_key') == private_keys[0]
			assert kwargs.get('harvester_vrf_private_key') == private_keys[1]


async def test_can_prepare_shoestring_files_peer():
	await _assert_can_prepare_shoestring_files(NodeFeatures.PEER, 'peer')


async def test_can_prepare_shoestring_files_api_with_https():
	await _assert_can_prepare_shoestring_files(NodeFeatures.API, 'dual', api_https=True, expected_api_https=True)


async def test_can_prepare_shoestring_files_api_without_https():
	await _assert_can_prepare_shoestring_files(NodeFeatures.API, 'dual')


async def test_can_prepare_shoestring_files_light_api_with_https():
	await _assert_can_prepare_shoestring_files(NodeFeatures.API, 'light', api_https=True, expected_api_https=True)


async def test_can_prepare_shoestring_files_light_api_without_https():
	await _assert_can_prepare_shoestring_files(NodeFeatures.API, 'light')


async def test_can_prepare_shoestring_files_harvester_new():
	await _assert_can_prepare_shoestring_files(NodeFeatures.HARVESTER, 'peer', is_harvesting_active=True)


async def test_can_prepare_shoestring_files_harvester_imported():
	await _assert_can_prepare_shoestring_files(NodeFeatures.HARVESTER, 'peer', **{
		'is_harvesting_active': True,
		'harvester_signing_private_key': '605CAA1C6D03133FCE6C1D2482EDDB9C928F4A05BE1CA501A277AEA16C30628E',
		'harvester_vrf_private_key': '09160DF296FE41F6215F59768B7C1B17D2B6D09335670CC6494B348C7B3A1427',
	})


async def test_can_prepare_shoestring_files_harvester_auto_harvest_disabled():
	await _assert_can_prepare_shoestring_files(NodeFeatures.HARVESTER, 'peer', is_harvesting_active=True, is_auto_harvest_enabled=False)


async def test_can_prepare_shoestring_files_voter():
	await _assert_can_prepare_shoestring_files(NodeFeatures.VOTER, 'peer', is_voting_active=True)


async def test_can_prepare_shoestring_files_full():
	await _assert_can_prepare_shoestring_files(NodeFeatures.API | NodeFeatures.HARVESTER | NodeFeatures.VOTER, 'dual', **{
		'is_harvesting_active': True,
		'is_voting_active': True
	})


async def test_can_prepare_shoestring_files_light():
	await _assert_can_prepare_shoestring_files(NodeFeatures.API | NodeFeatures.HARVESTER | NodeFeatures.VOTER, 'light', **{
		'is_harvesting_active': True,
		'is_voting_active': True
	})

# endregion


# region patch_shoestring_config

def write_text_file(filepath, text):
	with open(filepath, 'wt', encoding='utf8') as outfile:
		outfile.write(text)


async def _assert_can_patch_shoestring_file(new_content, expected_patches):
	# Arrange:
	with tempfile.TemporaryDirectory() as temp_directory:
		shoestring_path = Path(temp_directory)
		shoestring_filepath = shoestring_path / 'shoe.ini'
		write_text_file(shoestring_filepath, '\n'.join([
			'[network]',
			'ubuntuCore = 22.04',
			'',
			'[images]',
			'rest = symbolplatform/symbol-rest:2.4.0',
			'',
			'[transaction]',
			'fee = 20',
			'',
			'[imports]',
			'nodeKey = 1233455222222222',
			'',
			'[node]',
			'caCommonName = CA test',
			'nodeCommonName = test 127.0.0.1'
		]))
		new_shoestring_filepath = shoestring_path / 'shoe_new.ini'
		write_text_file(new_shoestring_filepath, new_content)

		# Act:
		patch_shoestring_config(shoestring_filepath, new_shoestring_filepath)

		# Assert:
		patches = load_shoestring_patches_from_file(shoestring_filepath)

		# patches is a superset of expected_patches
		for expected_patch in expected_patches:
			assert expected_patch in patches


async def test_can_patch_shoestring_file():
	await _assert_can_patch_shoestring_file('\n'.join([
		'[network]',
		'ubuntuCore = 22.04',
		'',
		'[images]',
		'rest = symbolplatform/symbol-rest:2.4.0',
		'',
		'[imports]',
		'nodeKey ='
		'',
		'[node]',
		'caCommonName =',
		'nodeCommonName ='
	]),
		[
			('imports', 'nodeKey', '1233455222222222'),
			('node', 'caCommonName', 'CA test'),
			('node', 'nodeCommonName', 'test 127.0.0.1')
	])


async def test_can_patch_shoestring_file_overwrite():
	await _assert_can_patch_shoestring_file('\n'.join([
		'[network]',
		'ubuntuCore = 22.04',
		'',
		'[images]',
		'rest = symbolplatform/symbol-rest:2.4.0',
		'',
		'[imports]',
		'nodeKey = 1111111111111'
		'',
		'[node]',
		'caCommonName = test',
		'nodeCommonName = 127.0.0.1'
	]),
		[
			('imports', 'nodeKey', '1233455222222222'),
			('node', 'caCommonName', 'CA test'),
			('node', 'nodeCommonName', 'test 127.0.0.1')
	])


async def test_can_patch_shoestring_file_remove_old_property():
	await _assert_can_patch_shoestring_file('\n'.join([
		'[network]',
		'ubuntuCore = 22.04',
		'',
		'[images]',
		'rest = symbolplatform/symbol-rest:2.4.0',
		'',
		'[imports]',
		'nodeKey = 1111111111111'
		'',
		'[node]',
		'caCommonName = test',
	]),
		[
			('imports', 'nodeKey', '1233455222222222'),
			('node', 'caCommonName', 'CA test')
	])


async def test_can_patch_shoestring_file_new_property():
	await _assert_can_patch_shoestring_file('\n'.join([
		'[network]',
		'ubuntuCore = 22.04',
		'',
		'[images]',
		'rest = symbolplatform/symbol-rest:2.4.0',
		'',
		'[imports]',
		'nodeKey = 1111111111111'
		'',
		'[node]',
		'caCommonName = test',
		'nodeCommonName = 127.0.0.1',
		'newProperty = added'
	]),
		[
		('imports', 'nodeKey', '1233455222222222'),
		('node', 'caCommonName', 'CA test'),
		('node', 'nodeCommonName', 'test 127.0.0.1'),
		('node', 'newProperty', 'added'),
	])

# endregion
