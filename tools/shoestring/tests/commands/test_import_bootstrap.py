import tempfile
from pathlib import Path

import pytest

from shoestring.__main__ import main
from shoestring.internal.ConfigurationManager import ConfigurationManager
from shoestring.internal.NodeFeatures import NodeFeatures

from ..test.ConfigurationTestUtils import prepare_shoestring_configuration


async def _run_test(is_harvester, is_voter, is_node_key, expected_imports_harvester, expected_imports_voter, expected_imports_node_key):
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory:
		config_filepath = prepare_shoestring_configuration(output_directory, NodeFeatures.PEER)

		with tempfile.TemporaryDirectory() as bootstrap_directory:
			bootstrap_node_path = Path(bootstrap_directory) / 'nodes/node'
			bootstrap_node_path.mkdir(parents=True)

			if is_harvester:
				bootstrap_resources_path = bootstrap_node_path / 'server-config/resources'
				bootstrap_resources_path.mkdir(parents=True)
				with open(bootstrap_resources_path / 'config-harvesting.properties', 'wt', encoding='utf8') as outfile:
					outfile.write('lorem ipsum')

			if is_voter:
				bootstrap_voting_keys_path = bootstrap_node_path / 'votingkeys'
				bootstrap_voting_keys_path.mkdir(parents=True)

			if is_node_key:
				bootstrap_node_key_path = bootstrap_node_path / 'cert/node.key.pem'
				bootstrap_node_key_path.mkdir(parents=True)

			# Act:
			await main([
				'import-bootstrap',
				'--config', str(config_filepath),
				'--bootstrap', str(bootstrap_directory),
				*(['--node-key'] if is_node_key else [])
			])

			# Assert:
			imports = ConfigurationManager(output_directory).lookup(config_filepath.name, [
				('imports', 'harvester'),
				('imports', 'voter'),
				('imports', 'node_key')
			])

			assert [
				expected_imports_harvester.format(bootstrap_root=bootstrap_directory),
				expected_imports_voter.format(bootstrap_root=bootstrap_directory),
				expected_imports_node_key.format(bootstrap_root=bootstrap_directory)
			] == imports


# pylint: disable=invalid-name

# region success

async def test_can_import_with_neither_harvester_nor_voter_nor_node_key():
	await _run_test(False, False, False,'', '', '')


async def test_can_import_with_harvester_but_not_voter_or_node_key():
	await _run_test(True, False, False,'{bootstrap_root}/nodes/node/server-config/resources/config-harvesting.properties', '', '')


async def test_can_import_with_voter_but_not_harvester_or_node_key():
	await _run_test(False, True, False, '', '{bootstrap_root}/nodes/node/votingkeys', '')

async def test_can_import_with_node_key_but_not_harvester_or_voter():
	await _run_test(False, False, True, '', '', '{bootstrap_root}/nodes/node/cert/node.key.pem')

async def test_can_import_with_harvester_and_voter_but_not_node_key():
	await _run_test(
		True,
		True,
		False,
		'{bootstrap_root}/nodes/node/server-config/resources/config-harvesting.properties',
		'{bootstrap_root}/nodes/node/votingkeys',
		'')

async def test_can_import_with_harvester_and_node_key_but_not_voter():
	await _run_test(
		True,
		False,
		True,
		'{bootstrap_root}/nodes/node/server-config/resources/config-harvesting.properties',
		'',
		'{bootstrap_root}/nodes/node/cert/node.key.pem')

async def test_can_import_with_both_harvester_and_voter_and_node_key():
	await _run_test(
		True,
		True,
		True,
		'{bootstrap_root}/nodes/node/server-config/resources/config-harvesting.properties',
		'{bootstrap_root}/nodes/node/votingkeys',
		'{bootstrap_root}/nodes/node/cert/node.key.pem')

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
			bootstrap_node_path = Path(bootstrap_directory) / 'nodes/node'
			bootstrap_node_path.mkdir(parents=True)

			# Act:
			with pytest.raises(SystemExit) as ex_info:
				await main([
					'import-bootstrap',
					'--config', str(config_filepath),
					'--bootstrap', str(bootstrap_directory),
					'--node-key'
				])

			# Assert:
			assert 1 == ex_info.value.code
# endregion
