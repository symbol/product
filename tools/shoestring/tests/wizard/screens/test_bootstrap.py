import tempfile
from pathlib import Path

from shoestring.wizard.ScreenContainer import ScreenContainer
from shoestring.wizard.screens.bootstrap import create
from shoestring.wizard.screens.harvesting import create as create_harvesting
from shoestring.wizard.screens.node_settings import create as create_node_settings
from shoestring.wizard.screens.voting import create as create_voting

# pylint: disable=invalid-name


def test_can_create_screen():
	# Act:
	screen = create(None)

	# Assert: check id
	assert 'bootstrap' == screen.screen_id

	# - check defaults
	assert not screen.accessor.active
	assert screen.accessor.include_node_key
	assert '' == screen.accessor.bootstrap_path

	# - defaults are valid
	assert screen.is_valid()


async def test_can_enable_bootstrap_import():
	# Arrange:
	screen = create(None)

	# Act:
	screen.accessor._flag.current_values = [()]  # pylint: disable=protected-access

	# Assert: check entered values
	assert screen.accessor.active
	assert screen.accessor.include_node_key
	assert '' == screen.accessor.bootstrap_path

	# - Bootstrap path is invalid.
	assert not screen.is_valid()


async def test_can_enter_valid_input_bootstrap_path():
	# Arrange:
	with tempfile.TemporaryDirectory() as bootstrap_path:
		(Path(bootstrap_path) / 'nodes/node').mkdir(parents=True)
		screen = create(None)

		# Act:
		screen.accessor._flag.current_values = [()]  # pylint: disable=protected-access
		screen.accessor._bootstrap_path.input.text = bootstrap_path  # pylint: disable=protected-access
		screen.accessor._bootstrap_path.input.buffer.validate()  # pylint: disable=protected-access

		# Assert: check entered values
		assert screen.accessor.active
		assert screen.accessor.include_node_key
		assert bootstrap_path == screen.accessor.bootstrap_path

		# - inputs are valid
		assert screen.is_valid()


async def test_can_disable_include_node_key():
	# Arrange:
	screen = create(None)

	# Act:
	screen.accessor._flag.current_values = [()]  # pylint: disable=protected-access
	screen.accessor._include_node_key_flag.current_values = []  # pylint: disable=protected-access

	# Assert: check entered values
	assert screen.accessor.active
	assert not screen.accessor.include_node_key
	assert '' == screen.accessor.bootstrap_path

	# - empty path is not valid
	assert not screen.is_valid()


async def test_fails_validation_when_entered_bootstrap_path_is_invalid():
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory:
		invalid_bootstrap_path = Path(output_directory) / 'invalid_path'
		invalid_bootstrap_path.mkdir(parents=True)
		invalid_input_path = str(invalid_bootstrap_path)
		screen = create(None)

		# Act:
		screen.accessor._flag.current_values = [()]  # pylint: disable=protected-access
		screen.accessor._bootstrap_path.input.text = invalid_input_path  # pylint: disable=protected-access
		screen.accessor._bootstrap_path.input.buffer.validate()  # pylint: disable=protected-access

		# Assert: check entered values
		assert screen.accessor.active
		assert screen.accessor.include_node_key
		assert invalid_input_path == screen.accessor.bootstrap_path

		# - path is not valid
		assert not screen.is_valid()


async def test_can_disable_harvesting_and_voting_screen():
	# Arrange:
	screens = ScreenContainer(None)
	screens.add('bootstrap', create(screens))
	screens.add('harvesting', create_harvesting(screens))
	screens.add('voting', create_voting(screens))

	# Act:
	screen = screens.get_screen('bootstrap')
	screen.accessor._flag.current_values = [()]  # pylint: disable=protected-access

	# Assert: check entered values
	assert screen.accessor.active
	assert not screens.get_screen('harvesting').should_show()
	assert not screens.get_screen('voting').should_show()


async def test_can_update_node_settings_screen():
	# Arrange:
	with tempfile.TemporaryDirectory() as bootstrap_path:
		bootstrap_resources_path = Path(bootstrap_path) / 'nodes/node/server-config/resources'
		bootstrap_resources_path.mkdir(parents=True)

		with open(bootstrap_resources_path / 'config-node.properties', 'wt', encoding='utf8') as outfile:
			outfile.write('\n'.join([
				'[localnode]',
				'host = test.xyz',
				'friendlyName = test'
			]))

		screens = ScreenContainer(None)
		screens.add('bootstrap', create(screens))
		screens.add('node-settings', create_node_settings(screens))

		# Act:
		screen = screens.get_screen('bootstrap')
		screen.accessor._flag.current_values = [()]  # pylint: disable=protected-access
		screen.accessor._bootstrap_path.input.text = bootstrap_path  # pylint: disable=protected-access
		screen.accessor._bootstrap_path.input.buffer.validate()  # pylint: disable=protected-access

		# Assert: check entered values
		node_settings = screens.get('node-settings')
		assert 'test.xyz' == node_settings.domain_name
		assert 'test' == node_settings.friendly_name


async def test_can_generate_diagnostic_accessor_representation_bootstrap_disabled():
	# Arrange:
	screen = create(None)
	screen.accessor._flag.current_values = []  # pylint: disable=protected-access
	screen.accessor._include_node_key_flag.current_values = [()]  # pylint: disable=protected-access
	screen.accessor._bootstrap_path.input.text = ''  # pylint: disable=protected-access
	screen.accessor._bootstrap_path.input.buffer.validate()  # pylint: disable=protected-access

	# Assert: check entered values
	assert (
		'(active=False, include_node_key=True, bootstrap_path=\'\')'
	) == repr(screen.accessor)
	assert [
		('bootstrap import', 'disabled')
	] == screen.accessor.tokens


async def test_can_generate_diagnostic_accessor_representation_bootstrap_enabled_include_node_key_enabled():
	# Arrange:
	with tempfile.TemporaryDirectory() as bootstrap_path:
		(Path(bootstrap_path) / 'nodes/node').mkdir(parents=True)

		screen = create(None)
		screen.accessor._flag.current_values = [()]  # pylint: disable=protected-access
		screen.accessor._include_node_key_flag.current_values = [()]  # pylint: disable=protected-access
		screen.accessor._bootstrap_path.input.text = bootstrap_path  # pylint: disable=protected-access
		screen.accessor._bootstrap_path.input.buffer.validate()  # pylint: disable=protected-access

		# Assert: check entered values
		assert (
			f'(active=True, include_node_key=True, bootstrap_path=\'{bootstrap_path}\')'
		) == repr(screen.accessor)
		assert [
			('bootstrap import', 'enabled'),
			('include node key', 'enabled'),
			('target directory', bootstrap_path)
		] == screen.accessor.tokens


async def test_can_generate_diagnostic_accessor_representation_bootstrap_enabled_include_node_key_disabled():
	# Arrange:
	with tempfile.TemporaryDirectory() as bootstrap_path:
		(Path(bootstrap_path) / 'nodes/node').mkdir(parents=True)

		screen = create(None)
		screen.accessor._flag.current_values = [()]  # pylint: disable=protected-access
		screen.accessor._include_node_key_flag.current_values = []  # pylint: disable=protected-access
		screen.accessor._bootstrap_path.input.text = bootstrap_path  # pylint: disable=protected-access
		screen.accessor._bootstrap_path.input.buffer.validate()  # pylint: disable=protected-access

		# Assert: check entered values
		assert (
			f'(active=True, include_node_key=False, bootstrap_path=\'{bootstrap_path}\')'
		) == repr(screen.accessor)
		assert [
			('bootstrap import', 'enabled'),
			('include node key', 'disabled'),
			('target directory', bootstrap_path)
		] == screen.accessor.tokens
