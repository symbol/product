from prompt_toolkit.filters import Condition
from prompt_toolkit.layout.containers import ConditionalContainer, HSplit, VSplit
from prompt_toolkit.widgets import Box, CheckboxList, Label, TextArea

from shoestring.wizard.Screen import ScreenDialog


class HarvestingSettings:
	def __init__(self, flag, generate_keys_flag, signing_key, vrf_key, delegate_flag):  # pylint: disable=too-many-arguments
		self._flag = flag
		self._generate_keys_flag = generate_keys_flag
		self._signing_key = signing_key
		self._vrf_key = vrf_key
		self._delegate_flag = delegate_flag

	@property
	def active(self):
		return bool(self._flag.current_values)

	@property
	def generate_keys(self):
		return bool(self._generate_keys_flag.current_values)

	@property
	def harvester_signing_private_key(self):
		return self._signing_key.text

	@property
	def harvester_vrf_private_key(self):
		return self._vrf_key.text

	@property
	def enable_delegated_harvesters_auto_detection(self):  # pylint: disable=invalid-name
		return bool(self._delegate_flag.current_values)

	def __repr__(self):
		return (
			f'(active={self.active}, '
			f'generate={self.generate_keys}, '
			f'signing_key=\'{self.harvester_signing_private_key}\', '
			f'vrf_key=\'{self.harvester_vrf_private_key}\', '
			f'delegate={self.enable_delegated_harvesters_auto_detection})'
		)


def create(_screens):
	harvesting_flag = CheckboxList(values=[
		('harvesting-bool', 'would you like to enable harvesting?')
	])

	harvesting_generate_flag = CheckboxList(values=[
		('harvesting-generate-keys-bool', 'generate new random keys and transaction')
	], default_values=['harvesting-generate-keys-bool'])

	harvesting_signing_key = TextArea(multiline=False)
	harvesting_vrf_key = TextArea(multiline=False)

	harvesting_delegate_flag = CheckboxList(values=[
		('harvesting-delegate-bool', 'enable delegated harvesters auto detection?')
	])

	settings = HarvestingSettings(
		harvesting_flag,
		harvesting_generate_flag,
		harvesting_signing_key,
		harvesting_vrf_key,
		harvesting_delegate_flag
	)

	return ScreenDialog(
		screen_id='harvesting',
		title=_('wizard-node-harvester-title'),
		body=HSplit([
			harvesting_flag,

			# display more elements here when checked...
			ConditionalContainer(
				HSplit([
					harvesting_generate_flag,
					ConditionalContainer(
						Box(
							VSplit([
								HSplit([
									Label('harvester signing key:'),
									Label('harvester vrf key')
								], width=30),
								HSplit([
									harvesting_signing_key,
									harvesting_vrf_key,
								]),
							]),
							padding=1
						),
						filter=Condition(lambda: not harvesting_generate_flag.current_values)
					),
					harvesting_delegate_flag,
				]),
				filter=Condition(lambda: harvesting_flag.current_values)
			)
		]),

		accessor=settings
	)
