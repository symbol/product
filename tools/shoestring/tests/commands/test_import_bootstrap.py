import tempfile
from collections import namedtuple
from pathlib import Path

import pytest

from shoestring.__main__ import main
from shoestring.internal.ConfigurationManager import ConfigurationManager
from shoestring.internal.NodeFeatures import NodeFeatures
from shoestring.internal.ShoestringConfiguration import ImportsConfiguration

from ..test.ConfigurationTestUtils import prepare_shoestring_configuration

EnabledImports = namedtuple('ImportsExpected', ['is_harvester', 'is_voter', 'is_node_key'])


def build_expected_imports(enabled_imports):
	return ImportsConfiguration(
		'{bootstrap_root}/nodes/node/server-config/resources/config-harvesting.properties' if enabled_imports.is_harvester else '',
		'{bootstrap_root}/nodes/node/votingkeys' if enabled_imports.is_voter else '',
		'{bootstrap_root}/nodes/node/cert/node.key.pem' if enabled_imports.is_node_key else ''
	)


async def _run_test(enabled_imports, expected_imports):
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory:
		config_filepath = prepare_shoestring_configuration(output_directory, NodeFeatures.PEER)

		with tempfile.TemporaryDirectory() as bootstrap_directory:
			bootstrap_node_path = Path(bootstrap_directory) / 'nodes/node'
			bootstrap_node_path.mkdir(parents=True)

			if enabled_imports.is_harvester:
				bootstrap_resources_path = bootstrap_node_path / 'server-config/resources'
				bootstrap_resources_path.mkdir(parents=True)
				with open(bootstrap_resources_path / 'config-harvesting.properties', 'wt', encoding='utf8') as outfile:
					outfile.write('lorem ipsum')

			if enabled_imports.is_voter:
				bootstrap_voting_keys_path = bootstrap_node_path / 'votingkeys'
				bootstrap_voting_keys_path.mkdir(parents=True)

			if enabled_imports.is_node_key:
				bootstrap_node_key_path = bootstrap_node_path / 'cert/node.key.pem'
				bootstrap_node_key_path.mkdir(parents=True)

			# Act:
			await main([
				'import-bootstrap',
				'--config', str(config_filepath),
				'--bootstrap', str(bootstrap_directory),
				*(['--include-node-key'] if enabled_imports.is_node_key else [])
			])

			# Assert:
			imports = ConfigurationManager(output_directory).lookup(config_filepath.name, [
				('imports', 'harvester'),
				('imports', 'voter'),
				('imports', 'node_key')
			])

			assert [
				expected_imports.harvester.format(bootstrap_root=bootstrap_directory),
				expected_imports.voter.format(bootstrap_root=bootstrap_directory),
				expected_imports.node_key.format(bootstrap_root=bootstrap_directory)
			] == imports


# pylint: disable=invalid-name

# region success

async def test_can_import_with_neither_harvester_nor_voter_nor_node_key():
	actual_imports = EnabledImports(False, False, False)
	expected_imports = build_expected_imports(actual_imports)
	await _run_test(actual_imports, expected_imports)


async def test_can_import_with_harvester_but_not_voter_or_node_key():
	actual_imports = EnabledImports(True, False, False)
	expected_imports = build_expected_imports(actual_imports)
	await _run_test(actual_imports, expected_imports)


async def test_can_import_with_voter_but_not_harvester_or_node_key():
	actual_imports = EnabledImports(False, True, False)
	expected_imports = build_expected_imports(actual_imports)
	await _run_test(actual_imports, expected_imports)


async def test_can_import_with_node_key_but_not_harvester_nor_voter():
	actual_imports = EnabledImports(False, False, True)
	expected_imports = build_expected_imports(actual_imports)
	await _run_test(actual_imports, expected_imports)


async def test_can_import_with_harvester_and_voter_but_not_node_key():
	actual_imports = EnabledImports(True, True, False)
	expected_imports = build_expected_imports(actual_imports)
	await _run_test(actual_imports, expected_imports)


async def test_can_import_with_harvester_and_node_key_but_not_voter():
	actual_imports = EnabledImports(True, False, True)
	expected_imports = build_expected_imports(actual_imports)
	await _run_test(actual_imports, expected_imports)


async def test_can_import_with_both_harvester_and_voter_and_node_key():
	actual_imports = EnabledImports(True, True, True)
	expected_imports = build_expected_imports(actual_imports)
	await _run_test(actual_imports, expected_imports)

# endregion


# region failure

async def test_cannot_import_when_bootstrap_directory_invalid():
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory:
		config_filepath = prepare_shoestring_configuration(output_directory, NodeFeatures.PEER)

		with tempfile.TemporaryDirectory() as bootstrap_directory:
			# Act + Assert:
			with pytest.raises(SystemExit) as ex_info:
				await main([
					'import-bootstrap',
					'--config', str(config_filepath),
					'--bootstrap', str(bootstrap_directory)
				])

			assert 1 == ex_info.value.code


async def test_cannot_import_when_node_key_does_not_exist():
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory:
		config_filepath = prepare_shoestring_configuration(output_directory, NodeFeatures.PEER)

		with tempfile.TemporaryDirectory() as bootstrap_directory:
			# create bootstrap node path so import-bootstrap command will not fail.
			bootstrap_node_path = Path(bootstrap_directory) / 'nodes/node'
			bootstrap_node_path.mkdir(parents=True)

			# Act + Assert:
			with pytest.raises(SystemExit) as ex_info:
				await main([
					'import-bootstrap',
					'--config', str(config_filepath),
					'--bootstrap', str(bootstrap_directory),
					'--include-node-key'
				])

			# Assert:
			assert 1 == ex_info.value.code

# endregion
