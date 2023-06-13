from prompt_toolkit.layout.containers import HSplit
from prompt_toolkit.widgets import CheckboxList

from shoestring.wizard.Screen import ScreenDialog


class VotingSettings:
	def __init__(self, flag):
		self._flag = flag

	@property
	def active(self):
		return bool(self._flag.current_values)


def create(_screens):
	node_voter_flag = CheckboxList(values=[
		('node-voter-bool', 'would you like to enable voting?')
	])

	return ScreenDialog(
		screen_id='voting',
		title=_('wizard-node-voter-title'),
		body=HSplit([
			node_voter_flag,

			# ConditionalContainer(
			# 	VSplit([
			# 		HSplit([
			# 			Label('dummy')
			# 		], width=30),
			# 		HSplit([
			# 			TextArea(multiline=False),
			# 		]),
			# 	]),
			# 	filter=Condition(lambda: node_voter_flag.current_values)
			# )
		]),

		accessor=VotingSettings(node_voter_flag)
	)
