from collections import namedtuple

from shoestring.wizard.screens.node_settings import create

SingleValueScreen = namedtuple('SingleValueScreen', ['current_value'])


# pylint: disable=invalid-name


def test_can_create_screen():
	# Act:
	screen = create({'node-type': SingleValueScreen('dual')})

	# Assert: check id
	assert 'node-settings' == screen.screen_id

	# - check defaults
	assert not screen.accessor.api_https
	assert '' == screen.accessor.domain_name
	assert '' == screen.accessor.friendly_name
	assert '' == screen.accessor.metadata_info


async def test_can_generate_diagnostic_accessor_representation():
	# Arrange:
	screen = create({'node-type': SingleValueScreen('dual')})
	screen.accessor._https_flag.current_values = [()]  # pylint: disable=protected-access
	screen.accessor._domain_name.text = 'symbol.fyi'  # pylint: disable=protected-access
	screen.accessor._friendly_name.text = 'explorer node'  # pylint: disable=protected-access
	screen.accessor._metadata_info.text = 'some json blob'  # pylint: disable=protected-access

	# Act + Assert:
	assert (
		'(https=True, domain_name=\'symbol.fyi\', friendly_name=\'explorer node\', '
		'metadata_info=\'some json blob\')' == repr(screen.accessor)
	)
