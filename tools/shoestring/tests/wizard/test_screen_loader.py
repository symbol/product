
from shoestring.wizard.screen_loader import load_screens, lookup_screens_list_for_operation
from shoestring.wizard.ScreenContainer import ScreenContainer
from shoestring.wizard.ShoestringOperation import ShoestringOperation

ALL_SCREEN_IDS = [
	'welcome', 'root-check',
	'obligatory', 'network-type', 'node-type',
	'harvesting',
	'voting',
	'node-settings',
	'certificates',
	'end-screen'
]


# pylint: disable=invalid-name


def test_can_load_screens():
	# Arrange:
	screens = ScreenContainer(None)

	# Act:
	load_screens(screens)

	# Assert:
	assert ALL_SCREEN_IDS == [screen.screen_id for screen in screens.ordered]
	assert ['Welcome', 'Basic settings', 'Harvesting', 'Voting', 'Node settings', 'Certificates', '🎉'] == screens.ordered_group_names


def _assert_operation_screens(operation, expected_screen_list):
	# Arrange:
	screens = ScreenContainer(None)
	load_screens(screens)

	# Act:
	screen_list = lookup_screens_list_for_operation(screens, operation)

	# Assert:
	assert expected_screen_list == screen_list


def test_can_lookup_screens_list_for_operation_setup():
	_assert_operation_screens(ShoestringOperation.SETUP, ALL_SCREEN_IDS)


def test_can_lookup_screens_list_for_operation_upgrade():
	_assert_operation_screens(ShoestringOperation.UPGRADE, ['welcome', 'obligatory', 'network-type', 'end-screen'])


def test_can_lookup_screens_list_for_operation_reset_data():
	_assert_operation_screens(ShoestringOperation.RESET_DATA, ['welcome', 'obligatory', 'end-screen'])


def test_can_lookup_screens_list_for_operation_renew_certificates():
	_assert_operation_screens(ShoestringOperation.RENEW_CERTIFICATES, ['welcome', 'obligatory', 'end-screen'])


def test_can_lookup_screens_list_for_operation_renew_voting_keys():
	_assert_operation_screens(ShoestringOperation.RENEW_VOTING_KEYS, ['welcome', 'obligatory', 'end-screen'])
