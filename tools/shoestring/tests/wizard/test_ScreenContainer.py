from collections import namedtuple

from shoestring.wizard.ScreenContainer import ScreenContainer

ChildScreen = namedtuple('ChildScreen', ['screen_id', 'accessor', 'should_show'], defaults=[None, None, lambda: True])


# pylint: disable=invalid-name


def _add_default_five_screens(screens):
	screens.add('start', ChildScreen('start_screen', 1))
	screens.add('middle', ChildScreen('mid_screen', 2))
	screens.add('middle', ChildScreen('mid_screen_confirmation', 3))
	screens.add('hidden', ChildScreen('unnavigable', 3.5, lambda: False))  # should always be hidden because show_screen is false
	screens.add('end', ChildScreen('end_screen', 4))
	screens.add('end', ChildScreen('confirmation', 5))


def test_can_add_screen_groups():
	# Arrange:
	screens = ScreenContainer(None)

	# Act:
	screens.add('start', ChildScreen('start_screen', 1))
	screens.add('middle', ChildScreen('mid_screen', 2))
	screens.add('end', ChildScreen('end_screen', 3))

	# Assert:
	assert 1 == screens.get('start_screen')
	assert 2 == screens.get('mid_screen')
	assert 3 == screens.get('end_screen')


def test_can_get_ordered_screen_group_names():
	# Arrange:
	screens = ScreenContainer(None)
	_add_default_five_screens(screens)

	# Act + Assert:
	assert ['start', 'middle', 'hidden', 'end'] == screens.ordered_group_names


def test_can_get_ordered_screen_group_names_with_custom_allow_list():
	# Arrange:
	screens = ScreenContainer(None)
	screens.set_list(['start_screen', 'end_screen'])
	_add_default_five_screens(screens)

	# Act + Assert:
	assert ['start', 'end'] == screens.ordered_group_names


def test_can_access_current_screen():
	# Arrange:
	screens = ScreenContainer(None)
	_add_default_five_screens(screens)

	# Act + Assert:
	assert ChildScreen('start_screen', 1) == screens.current
	assert not screens.has_previous


def test_cannot_move_to_previous_when_current_is_first_screen():
	# Arrange:
	screens = ScreenContainer(None)
	_add_default_five_screens(screens)

	# Act:
	screens.previous()

	# Assert: previous has no effect
	assert ChildScreen('start_screen', 1) == screens.current
	assert not screens.has_previous


def test_can_move_through_screens_via_prev():
	# Arrange:
	screens = ScreenContainer(None)
	_add_default_five_screens(screens)

	for _ in range(4):
		screens.next()

	# Act:
	screen_ids = []
	for _ in range(4):
		screens.previous()
		screen_ids.append(screens.current.screen_id)

	# Assert:
	assert ['end_screen', 'mid_screen_confirmation', 'mid_screen', 'start_screen'] == screen_ids


def test_can_move_through_screens_via_prev_with_custom_allow_list():
	# Arrange:
	screens = ScreenContainer(None)
	screens.set_list(['', 'mid_screen', 'end_screen'])
	_add_default_five_screens(screens)

	for _ in range(2):
		screens.next()

	# Act:
	screen_ids = []
	for _ in range(2):
		screens.previous()
		screen_ids.append(screens.current.screen_id)

	# Assert:
	assert ['mid_screen', 'start_screen'] == screen_ids


def test_can_move_to_next_screen():
	# Arrange:
	screens = ScreenContainer(None)
	_add_default_five_screens(screens)

	# Act:
	screens.next()

	# Assert:
	assert ChildScreen('mid_screen', 2) == screens.current
	assert screens.has_previous


def test_can_move_through_screens_via_next():
	# Arrange:
	screens = ScreenContainer(None)
	_add_default_five_screens(screens)

	# Act:
	screen_ids = []
	for _ in range(4):
		screens.next()
		screen_ids.append(screens.current.screen_id)

	# Assert:
	assert ['mid_screen', 'mid_screen_confirmation', 'end_screen', 'confirmation'] == screen_ids


def test_can_move_through_screens_via_next_with_custom_allow_list():
	# Arrange:
	screens = ScreenContainer(None)
	screens.set_list(['start_screen', 'mid_screen', 'end_screen'])
	_add_default_five_screens(screens)

	# Act:
	screen_ids = []
	for _ in range(2):
		screens.next()
		screen_ids.append(screens.current.screen_id)

	# Assert:
	assert ['mid_screen', 'end_screen'] == screen_ids


def test_cannot_move_to_next_when_current_is_last_screen():
	# Arrange:
	screens = ScreenContainer(None)
	_add_default_five_screens(screens)

	# - move to last screen
	for _ in range(4):
		screens.next()

	# Sanity:
	assert ChildScreen('confirmation', 5) == screens.current

	# Act:
	screens.next()

	# Assert:
	assert ChildScreen('confirmation', 5) == screens.current
