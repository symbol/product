from prompt_toolkit.widgets import RadioList

from shoestring.wizard.Screen import ScreenDialog


class NetworkTypeAccessor:
	def __init__(self, radio_list):
		self._radio_list = radio_list

	@property
	def current_value(self):
		return self._radio_list.current_value

	@property
	def tokens(self):
		return [(_('wizard-network-type-token'), self.current_value)]

	def __repr__(self):
		return f'(network_type=\'{self.current_value}\')'


def create(_screens):
	network_types_radio_list = RadioList(
		values=[
			('mainnet', _('wizard-network-type-mainnet')),
			('sai', _('wizard-network-type-testnet')),
		]
	)

	return ScreenDialog(
		screen_id='network-type',
		title=_('wizard-network-type-title'),
		body=network_types_radio_list,

		accessor=NetworkTypeAccessor(network_types_radio_list)
	)
