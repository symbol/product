from prompt_toolkit.widgets import RadioList

from shoestring.wizard.Screen import ScreenDialog


def create(_screens):
	node_type_radio = RadioList(
		values=[
			('dual', _('wizard-node-type-dual')),
			('peer', _('wizard-node-type-peer'))
		],
		default='peer'
	)

	return ScreenDialog(
		screen_id='node-type',
		title='Choose node type',
		body=node_type_radio,

		accessor=node_type_radio
	)
