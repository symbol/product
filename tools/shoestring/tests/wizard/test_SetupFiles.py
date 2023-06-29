import tempfile
from collections import namedtuple
from pathlib import Path

from shoestring.internal.ConfigurationManager import ConfigurationManager
from shoestring.internal.NodeFeatures import NodeFeatures
from shoestring.internal.ShoestringConfiguration import parse_shoestring_configuration
from shoestring.wizard.SetupFiles import prepare_overrides_file, prepare_shoestring_files

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
NodeSettingsScreen = namedtuple('NodeSettingsScreen', ['domain_name', 'friendly_name', 'api_https'])
SingleValueScreen = namedtuple('SingleValueScreen', ['current_value'])
VotingScreen = namedtuple('Voting', ['active'])


# pylint: disable=invalid-name


# region prepare_overrides_file

def _assert_can_prepare_overrides_file_when_harvesting_enabled(expected_auto_detection_value):
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory:
		overrides_filepath = Path(output_directory) / 'overrides.ini'

		# Act:
		prepare_overrides_file({
			'harvesting': HarvestingScreen(True, False, False, 'true' == expected_auto_detection_value, None, None, 7, 111, 'abc'),
			'node-settings': NodeSettingsScreen('san.symbol.ninja', 'Symbol San', None)
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
			'node-settings': NodeSettingsScreen('san.symbol.ninja', 'Symbol San', None)
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
				'node-settings': NodeSettingsScreen('san.symbol.ninja', 'Symbol San', kwargs.get('api_https', False))
			}, Path(output_directory))

			# Assert:
			config = parse_shoestring_configuration(Path(output_directory) / 'shoestring.ini')
			assert kwargs.get('expected_api_https', False) == config.node.api_https
			assert 'my ca common name' == config.node.ca_common_name
			assert 'my node common name' == config.node.node_common_name
			assert expected_node_features == config.node.features

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

# endregion
