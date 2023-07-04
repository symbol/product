from prompt_toolkit.layout.containers import HSplit
from prompt_toolkit.widgets import CheckboxList

from shoestring.wizard.Screen import ScreenDialog
from shoestring.wizard.styles import to_enabled_string


class VotingSettings:
	def __init__(self, flag):
		self._flag = flag

	@property
	def active(self):
		return bool(self._flag.current_values)

	@property
	def tokens(self):
		return [(_('wizard-voting-token-active'), to_enabled_string(self.active))]

	def __repr__(self):
		return f'(active={self.active})'


def create(_screens):
	node_voter_flag = CheckboxList(values=[
		('node-voter-bool', _('wizard-voting-active'))
	])

	return ScreenDialog(
		screen_id='voting',
		title=_('wizard-voting-title'),
		body=HSplit([
			node_voter_flag
		]),

		accessor=VotingSettings(node_voter_flag)
	)
