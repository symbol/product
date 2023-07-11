from shoestring.wizard.styles import initialize, to_enabled_string

# pylint: disable=invalid-name


def test_can_format_boolean_as_enabled_string():
	assert 'enabled' == to_enabled_string(True)
	assert 'disabled' == to_enabled_string(False)


def test_have_proper_styles():
	# Act:
	styles = initialize()

	# Assert
	expected = [
		{'titlebar'},
		{'navigation'},
		{'button'},
		{'button.focused', 'button'},
		{'button', 'button.inactive'},
		{'button.focused', 'button', 'button.focused.inactive'},
		{'button.arrow'},
		{'tab-list'},
		{'tab'},
		{'tab-selected'},
		{'tab-checked'},
		{'scrollbar.arrow'},
		{'scrollbar.background'},
		{'scrollbar.background', 'scrollbar.start'},
		{'scrollbar.end', 'scrollbar.button'},
		{'scrollbar.button'},
		{'error'},
		{'shadow'},
	]
	assert expected == [t[0] for t in styles.class_names_and_attrs]
