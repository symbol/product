from prompt_toolkit.widgets import RadioList

from shoestring.wizard.Screen import ScreenDialog


def create(_screens):
	network_types_radio_list = RadioList(
		values=[
			('mainnet', _('wizard-network-type-mainnet')),
			('sai', _('wizard-network-type-testnet')),
		]
	)

	return ScreenDialog(
		screen_id='network-type',
		title='Choose network type',
		body=network_types_radio_list,

		accessor=network_types_radio_list
	)
