from prompt_toolkit.widgets import RadioList

from shoestring.wizard.Screen import ScreenDialog


class NodeTypeAccessor:
	def __init__(self, radio_list):
		self._radio_list = radio_list

	@property
	def current_value(self):
		return self._radio_list.current_value

	@property
	def tokens(self):
		return [('node type', self.current_value)]

	def __repr__(self):
		return f'(node_type=\'{self.current_value}\')'


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

		accessor=NodeTypeAccessor(node_type_radio)
	)
