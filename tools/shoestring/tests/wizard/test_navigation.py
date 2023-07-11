from shoestring.wizard.navigation import ExtendedButton, Navigation

# pylint: disable=invalid-name


def test_can_create_navigation():
	# Act:
	navbar = Navigation('container', 'prev', 'next')

	# Assert:
	assert 'container' == navbar.container
	assert 'prev' == navbar.prev
	assert 'next' == navbar.next


def _create_extended_button():
	button = ExtendedButton('my button text')
	button.handler = lambda: 123
	return button


def test_can_create_extended_button_enabled():
	# Arrange:
	button = _create_extended_button()

	# Act + Assert: button has correct style and can be clicked
	assert 'class:button' == button.conditional_style()
	assert button.handler is not None


def test_can_create_extended_button_disabled():
	# Arrange:
	button = _create_extended_button()
	button.state_filter = lambda: True

	# Act + Assert: button has correct style and cannot be clicked
	assert 'class:button.inactive' == button.conditional_style()
	assert button.handler is None


def test_can_dynamically_change_extended_button_state():
	# Arrange:
	button = _create_extended_button()

	is_enabled = False
	button.state_filter = lambda: not is_enabled

	for _ in range(3):
		# Act: disable
		is_enabled = False

		# Assert:
		assert 'class:button.inactive' == button.conditional_style()
		assert button.handler is None

		# Act: enable
		is_enabled = True

		# Assert:
		assert 'class:button' == button.conditional_style()
		assert button.handler is not None
