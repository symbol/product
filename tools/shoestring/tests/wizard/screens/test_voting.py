from shoestring.wizard.screens.voting import create

# pylint: disable=invalid-name


def test_can_create_screen():
	# Act:
	screen = create(None)

	# Assert: check id
	assert 'voting' == screen.screen_id

	# - check defaults
	assert not screen.accessor.active


def test_can_generate_diagnostic_accessor_representation():
	# Arrange:
	screen = create(None)

	# Act + Assert:
	assert '(active=False)' == repr(screen.accessor)
	assert [
		('voter role', 'disabled')
	] == screen.accessor.tokens
