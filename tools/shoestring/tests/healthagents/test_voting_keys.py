import tempfile
from collections import namedtuple
from pathlib import Path

import pytest
from symbolchain.CryptoTypes import PrivateKey
from symbolchain.symbol.KeyPair import KeyPair
from symbolchain.symbol.VotingKeysGenerator import VotingKeysGenerator

from shoestring.healthagents.voting_keys import should_run, validate
from shoestring.internal.ConfigurationManager import ConfigurationManager
from shoestring.internal.NodeFeatures import NodeFeatures
from shoestring.internal.Preparer import Preparer
from shoestring.internal.ShoestringConfiguration import NodeConfiguration, ServicesConfiguration, ShoestringConfiguration

from ..test.LogTestUtils import LogLevel, assert_all_messages_are_logged, assert_max_log_level
from ..test.MockNodewatchServer import setup_mock_nodewatch_server

# region server fixture


@pytest.fixture
def server(event_loop, aiohttp_client):
	return setup_mock_nodewatch_server(event_loop, aiohttp_client, True)

# endregion


# pylint: disable=invalid-name


# region should_run

def test_should_run_for_voter_role():
	# Act + Assert:
	assert should_run(NodeConfiguration(NodeFeatures.VOTER, *([None] * 6)))

	for features in (NodeFeatures.PEER, NodeFeatures.API, NodeFeatures.HARVESTER):
		assert not should_run(NodeConfiguration(features, *([None] * 6))), str(features)

# endregion


# region validate

def _assert_all_messages_are_logged(expected_messages, caplog):
	assert_all_messages_are_logged([
		'detected last finalized height as 2033136',
		'detected current finalization epoch as 2825'
	] + expected_messages, caplog)


def _prepare_directory(output_directory):
	directories = Preparer.DirectoryLocator(None, Path(output_directory))
	directories.resources.mkdir(parents=True)
	directories.voting_keys.mkdir(parents=True)

	with open(directories.resources / 'config-network.properties', 'wt', encoding='utf8') as outfile:
		outfile.write('\n'.join([
			'[chain]',
			'',
			'votingSetGrouping = 720'
		]))

	return directories


def _write_voting_keys_file(directory, ordinal, start_epoch, end_epoch):
	voting_keys_generator = VotingKeysGenerator(KeyPair(PrivateKey.random()))
	voting_key_buffer = voting_keys_generator.generate(start_epoch, end_epoch)

	output_filepath = directory / f'private_key_tree{ordinal}.dat'
	with open(output_filepath, 'wb') as outfile:
		outfile.write(voting_key_buffer)

	output_filepath.chmod(0o600)


async def _dispatch_validate(directories, server):  # pylint: disable=redefined-outer-name
	# Arrange:
	HealthAgentContext = namedtuple('HealthAgentContext', ['config_manager', 'directories', 'config'])
	context = HealthAgentContext(
		ConfigurationManager(directories.resources),
		directories,
		ShoestringConfiguration('testnet', None, ServicesConfiguration(server.make_url('')), None, None))

	# Act:
	await validate(context)


async def test_validate_fails_when_past_voting_keys_are_present(server, caplog):  # pylint: disable=redefined-outer-name
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory:
		directories = _prepare_directory(output_directory)
		_write_voting_keys_file(directories.voting_keys, 1, 2725, 2824)

		# Act:
		await _dispatch_validate(directories, server)

		# Assert:
		_assert_all_messages_are_logged([
			'expired voting keys discovered for epochs 2725 to 2824',
			'no voting keys are registered for the current epoch 2825'
		], caplog)
		assert_max_log_level(LogLevel.ERROR, caplog)


async def test_validate_warns_when_past_and_current_voting_keys_are_present(server, caplog):  # pylint: disable=redefined-outer-name
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory:
		directories = _prepare_directory(output_directory)
		_write_voting_keys_file(directories.voting_keys, 1, 2725, 2824)
		_write_voting_keys_file(directories.voting_keys, 2, 2825, 2924)

		# Act:
		await _dispatch_validate(directories, server)

		# Assert:
		_assert_all_messages_are_logged([
			'expired voting keys discovered for epochs 2725 to 2824',
			'active voting keys discovered for epochs 2825 to 2924',
			'voting keys are registered from the current epoch 2825 until epoch 2924'
		], caplog)
		assert_max_log_level(LogLevel.WARNING, caplog)


async def test_validate_passes_when_current_voting_keys_are_present(server, caplog):  # pylint: disable=redefined-outer-name
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory:
		directories = _prepare_directory(output_directory)
		_write_voting_keys_file(directories.voting_keys, 1, 2825, 2924)

		# Act:
		await _dispatch_validate(directories, server)

		# Assert:
		_assert_all_messages_are_logged([
			'active voting keys discovered for epochs 2825 to 2924',
			'voting keys are registered from the current epoch 2825 until epoch 2924'
		], caplog)
		assert_max_log_level(LogLevel.INFO, caplog)


async def test_validate_fails_when_future_voting_keys_are_present(server, caplog):  # pylint: disable=redefined-outer-name
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory:
		directories = _prepare_directory(output_directory)
		_write_voting_keys_file(directories.voting_keys, 1, 2925, 3024)

		# Act:
		await _dispatch_validate(directories, server)

		# Assert:
		_assert_all_messages_are_logged([
			'future voting keys discovered for epochs 2925 to 3024',
			'no voting keys are registered for the current epoch 2825'
		], caplog)
		assert_max_log_level(LogLevel.ERROR, caplog)


async def test_validate_passes_when_current_and_future_voting_keys_are_present(server, caplog):  # pylint: disable=redefined-outer-name
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory:
		directories = _prepare_directory(output_directory)
		_write_voting_keys_file(directories.voting_keys, 1, 2825, 2924)
		_write_voting_keys_file(directories.voting_keys, 2, 2925, 3024)

		# Act:
		await _dispatch_validate(directories, server)

		# Assert:
		_assert_all_messages_are_logged([
			'active voting keys discovered for epochs 2825 to 2924',
			'future voting keys discovered for epochs 2925 to 3024',
			'voting keys are registered from the current epoch 2825 until epoch 3024'
		], caplog)
		assert_max_log_level(LogLevel.INFO, caplog)


async def test_validate_fails_when_past_and_future_voting_keys_are_present(server, caplog):  # pylint: disable=redefined-outer-name
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory:
		directories = _prepare_directory(output_directory)
		_write_voting_keys_file(directories.voting_keys, 1, 2725, 2824)
		_write_voting_keys_file(directories.voting_keys, 2, 2925, 3024)

		# Act:
		await _dispatch_validate(directories, server)

		# Assert:
		_assert_all_messages_are_logged([
			'expired voting keys discovered for epochs 2725 to 2824',
			'future voting keys discovered for epochs 2925 to 3024',
			'no voting keys are registered for the current epoch 2825'
		], caplog)
		assert_max_log_level(LogLevel.ERROR, caplog)


async def test_validate_passes_when_current_and_future_voting_keys_are_present_gaps(server, caplog):  # pylint: disable=redefined-outer-name
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory:
		directories = _prepare_directory(output_directory)
		_write_voting_keys_file(directories.voting_keys, 1, 2825, 2924)
		_write_voting_keys_file(directories.voting_keys, 2, 2925, 3024)
		_write_voting_keys_file(directories.voting_keys, 3, 3026, 3124)  # note the gap
		_write_voting_keys_file(directories.voting_keys, 4, 3125, 3224)

		# Act:
		await _dispatch_validate(directories, server)

		# Assert:
		_assert_all_messages_are_logged([
			'active voting keys discovered for epochs 2825 to 2924',
			'future voting keys discovered for epochs 2925 to 3024',
			'future voting keys discovered for epochs 3026 to 3124',
			'future voting keys discovered for epochs 3125 to 3224',
			'voting keys are registered from the current epoch 2825 until epoch 3024'
		], caplog)
		assert_max_log_level(LogLevel.INFO, caplog)

# endregion
