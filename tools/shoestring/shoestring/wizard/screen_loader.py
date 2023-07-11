import importlib
from collections import namedtuple

from shoestring.wizard.ShoestringOperation import ShoestringOperation

ScreenGroup = namedtuple('ScreenGroup', ['group_name', 'screen_names'])


def load_screens(screens):
	"""Loads all wizard screens."""

	screen_setup = [
		ScreenGroup(_('wizard-screen-group-welcome'), ['welcome', 'root_check']),
		ScreenGroup(_('wizard-screen-group-obligatory'), ['obligatory', 'network_type', 'node_type']),

		ScreenGroup(_('wizard-screen-group-harvesting'), ['harvesting']),
		ScreenGroup(_('wizard-screen-group-voting'), ['voting']),

		ScreenGroup(_('wizard-screen-group-node-settings'), ['node_settings']),
		ScreenGroup(_('wizard-screen-group-certificates'), ['certificates']),

		ScreenGroup(_('wizard-screen-group-end-screen'), ['end_screen'])
	]

	for group in screen_setup:
		for name in group.screen_names:
			module = importlib.import_module(f'shoestring.wizard.screens.{name.replace("-", "_")}')
			screen = module.create(screens)
			screens.add(group.group_name, screen)


def lookup_screens_list_for_operation(screens, operation):
	"""Looks up the required screens for the specified operation."""

	operation_screens = {
		ShoestringOperation.UPGRADE: ['welcome', 'obligatory', 'network-type', 'end-screen'],
		ShoestringOperation.RESET_DATA: ['welcome', 'obligatory', 'end-screen'],
		ShoestringOperation.RENEW_CERTIFICATES: ['welcome', 'obligatory', 'end-screen'],
		ShoestringOperation.RENEW_VOTING_KEYS: ['welcome', 'obligatory', 'end-screen']
	}

	default_screens = [screen.screen_id for screen in screens.ordered]
	return operation_screens.get(operation, default_screens)
