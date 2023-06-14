import tempfile
from pathlib import Path

from shoestring.__main__ import main
from shoestring.internal.NodeFeatures import NodeFeatures

from ..test.ConfigurationTestUtils import prepare_shoestring_configuration


def _create_directories_with_placeholders(directory, subdirectory_names):
	for name in subdirectory_names:
		subdirectory = Path(directory) / name
		subdirectory.mkdir()

		with open(subdirectory / 'placeholder.dat', 'wb') as _:
			pass


# pylint: disable=invalid-name


# region basic

async def _assert_reset_data(node_features, expected_recreated_subdirectories):
	# Arrange:
	subdirectory_names = ('data', 'logs', 'dbdata', 'keys', 'unknown')
	with tempfile.TemporaryDirectory() as output_directory:
		config_filepath = prepare_shoestring_configuration(output_directory, node_features)

		# - create some directories each with a placeholder file
		_create_directories_with_placeholders(output_directory, subdirectory_names)

		# Act:
		await main([
			'reset-data',
			'--config', str(config_filepath),
			'--directory', output_directory
		])

		# Assert: all folders should be present and folders not recreated should still have placeholder files
		expected_files = [*subdirectory_names, 'sai.shoestring.ini']
		for name in subdirectory_names:
			if name not in expected_recreated_subdirectories:
				expected_files.append(f'{name}/placeholder.dat')

		files = sorted(str(path.relative_to(output_directory)) for path in Path(output_directory).glob('**/*'))
		assert sorted(expected_files) == files

		# - recreated folders should have correct permissions
		for name in expected_recreated_subdirectories:
			assert 0o700 == (Path(output_directory) / name).stat().st_mode & 0o777


async def test_can_reset_data_peer_node():
	await _assert_reset_data(NodeFeatures.PEER, ['data', 'logs'])


async def test_can_reset_data_api_node():
	await _assert_reset_data(NodeFeatures.API, ['data', 'logs', 'dbdata'])


async def test_can_reset_data_voter_node_without_voter_state():
	await _assert_reset_data(NodeFeatures.VOTER, ['data', 'logs'])


# endregion


# region harvester state

DEFAULT_SUBDIRECTORIES_FOR_STATE_TESTS = ['data', 'logs', 'dbdata', 'keys', 'unknown']
DEFAULT_EXPECTED_DATA_FILES_FOR_STATE_TESTS = [
	'dbdata',
	'dbdata/placeholder.dat',
	'keys',
	'keys/placeholder.dat',
	'logs',
	'sai.shoestring.ini',
	'unknown',
	'unknown/placeholder.dat'
]


def _assert_data_files_and_contents(output_directory, expected_data_files, expected_file_contents):
	# all folders should be present and folders not recreated should still have placeholder files
	files = sorted(str(path.relative_to(output_directory)) for path in Path(output_directory).glob('**/*'))
	assert expected_data_files + DEFAULT_EXPECTED_DATA_FILES_FOR_STATE_TESTS == files

	# check file contents
	for key, value in expected_file_contents.items():
		with open(Path(output_directory) / key, 'rt', encoding='utf8') as infile:
			assert value == infile.read()


async def _assert_reset_data_with_harvester_state(additional_command_args, expected_data_files, expected_file_contents):
	# Arrange:
	subdirectory_names = DEFAULT_SUBDIRECTORIES_FOR_STATE_TESTS
	with tempfile.TemporaryDirectory() as output_directory:
		config_filepath = prepare_shoestring_configuration(output_directory, NodeFeatures.HARVESTER)

		# - create some directories each with a placeholder file
		_create_directories_with_placeholders(output_directory, subdirectory_names)

		# - prepare harvesters.dat
		with open(Path(output_directory) / 'data' / 'harvesters.dat', 'wt', encoding='utf8') as outfile:
			outfile.write('sed ut perspiciatis unde omnis')

		# Act:
		await main([
			'reset-data',
			'--config', str(config_filepath),
			'--directory', output_directory
		] + additional_command_args)

		# Assert: check files and contents
		_assert_data_files_and_contents(output_directory, expected_data_files, expected_file_contents)


async def test_can_reset_data_harvester_node_with_purge_harvesters_flag():
	await _assert_reset_data_with_harvester_state(['--purge-harvesters'], ['data'], {})


async def test_can_reset_data_harvester_node_without_purge_harvesters_flag():
	await _assert_reset_data_with_harvester_state([], ['data', 'data/harvesters.dat'], {
		'data/harvesters.dat': 'sed ut perspiciatis unde omnis'
	})

# endregion


# region voter state

async def _assert_reset_data_with_voter_state(votes_backup_epochs, expected_data_files, expected_file_contents):
	# Arrange:
	subdirectory_names = [*DEFAULT_SUBDIRECTORIES_FOR_STATE_TESTS, 'data/votes_backup']
	with tempfile.TemporaryDirectory() as output_directory:
		config_filepath = prepare_shoestring_configuration(output_directory, NodeFeatures.VOTER)

		# - create some directories each with a placeholder file
		_create_directories_with_placeholders(output_directory, subdirectory_names)

		# - prepare voting_status.dat
		with open(Path(output_directory) / 'data' / 'voting_status.dat', 'wt', encoding='utf8') as outfile:
			outfile.write('lorem ipsum dolor sit amet')

		# - prepare votes_backup
		for epoch in votes_backup_epochs:
			epoch_directory = Path(output_directory) / 'data' / 'votes_backup' / str(epoch)
			epoch_directory.mkdir()

			with open(epoch_directory / 'foo.txt', 'wt', encoding='utf8') as outfile:
				outfile.write(f'nulla viverra aliquet justo sed maximus {epoch}')

		# Act:
		await main([
			'reset-data',
			'--config', str(config_filepath),
			'--directory', output_directory
		])

		# Assert: check files and contents
		_assert_data_files_and_contents(output_directory, expected_data_files, expected_file_contents)


async def test_can_reset_data_voter_node_with_voting_status_but_not_votes_backup():
	await _assert_reset_data_with_voter_state([], [
		'data',
		'data/voting_status.dat'
	], {
		'data/voting_status.dat': 'lorem ipsum dolor sit amet'
	})


async def test_can_reset_data_voter_node_with_voting_status_and_votes_backup():
	await _assert_reset_data_with_voter_state([1000, 1025, 1026], [
		'data',
		'data/votes_backup',
		'data/votes_backup/1026',
		'data/votes_backup/1026/foo.txt',
		'data/voting_status.dat'
	], {
		'data/votes_backup/1026/foo.txt': 'nulla viverra aliquet justo sed maximus 1026',
		'data/voting_status.dat': 'lorem ipsum dolor sit amet'
	})

# endregion
