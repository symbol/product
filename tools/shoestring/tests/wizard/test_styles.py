from shoestring.wizard.styles import to_enabled_string

# pylint: disable=invalid-name


def test_can_format_boolean_as_enabled_string():
	assert 'enabled' == to_enabled_string(True)
	assert 'disabled' == to_enabled_string(False)
