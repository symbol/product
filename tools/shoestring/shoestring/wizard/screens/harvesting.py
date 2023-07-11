from prompt_toolkit.filters import Condition
from prompt_toolkit.layout.containers import ConditionalContainer, HSplit, VSplit
from prompt_toolkit.widgets import Box, CheckboxList
from symbolchain.facade.SymbolFacade import SymbolFacade

from shoestring.wizard.Screen import ScreenDialog
from shoestring.wizard.styles import to_enabled_string
from shoestring.wizard.ValidatingTextBox import ValidatingTextBox, is_hex_private_key_string, is_integer


def facade(screens):
	# TODO: not sure if this makes sense
	network = 'mainnet' if 'mainnet' == screens.get('network-type').current_value else 'testnet'
	return SymbolFacade(network)


class HarvestingSettings:
	# pylint: disable=too-many-instance-attributes

	def __init__(
		self,
		flag,
		auto_harvest_flag,
		generate_keys_flag,
		signing_key,
		vrf_key,
		delegate_flag,
		max_unlocked_accounts,
		min_fee_multiplier,
		beneficiary_address
	):  # pylint: disable=too-many-arguments
		self._flag = flag
		self._auto_harvest_flag = auto_harvest_flag
		self._generate_keys_flag = generate_keys_flag
		self._signing_key = signing_key
		self._vrf_key = vrf_key
		self._delegate_flag = delegate_flag
		self._max_unlocked_accounts = max_unlocked_accounts
		self._min_fee_multiplier = min_fee_multiplier
		self._beneficiary_address = beneficiary_address

	@property
	def active(self):
		return bool(self._flag.current_values)

	@property
	def auto_harvest(self):
		return bool(self._auto_harvest_flag.current_values)

	@property
	def generate_keys(self):
		return bool(self._generate_keys_flag.current_values)

	@property
	def harvester_signing_private_key(self):
		return self._signing_key.input.text

	@property
	def harvester_vrf_private_key(self):
		return self._vrf_key.input.text

	@property
	def enable_delegated_harvesters_auto_detection(self):  # pylint: disable=invalid-name
		return bool(self._delegate_flag.current_values)

	@property
	def max_unlocked_accounts(self):
		return int(self._max_unlocked_accounts.input.text)

	@property
	def min_fee_multiplier(self):
		return int(self._min_fee_multiplier.input.text)

	@property
	def beneficiary_address(self):
		return self._beneficiary_address.input.text

	@property
	def tokens(self):
		tokens = [(_('wizard-harvesting-token-active'), to_enabled_string(self.active))]
		if self.active:
			tokens.extend([
				(_('wizard-harvesting-token-auto-harvest'), to_enabled_string(self.auto_harvest)),
				(_('wizard-harvesting-token-generate-keys'), to_enabled_string(self.generate_keys)),
				(_('wizard-harvesting-token-delegate'), to_enabled_string(self.enable_delegated_harvesters_auto_detection)),
				(_('wizard-harvesting-token-max-unlocked-accounts'), self.max_unlocked_accounts),
				(_('wizard-harvesting-token-min-fee-multiplier'), self.min_fee_multiplier),
				(_('wizard-harvesting-token-beneficiary-address'), self.beneficiary_address)
			])

		return tokens

	def __repr__(self):
		return (
			f'(active={self.active}, '
			f'auto_harvest={self.auto_harvest}, '
			f'generate={self.generate_keys}, '
			f'signing_key=\'{self.harvester_signing_private_key}\', '
			f'vrf_key=\'{self.harvester_vrf_private_key}\', '
			f'delegate={self.enable_delegated_harvesters_auto_detection}, '
			f'max_unlocked_accounts={self.max_unlocked_accounts}, '
			f'min_fee_multiplier={self.min_fee_multiplier}, '
			f'beneficiary_address={self.beneficiary_address})'
		)


def create(screens):
	harvesting_flag = CheckboxList(values=[
		('harvesting-bool', _('wizard-harvesting-active'))
	])

	harvesting_auto_harvest_flag = CheckboxList(values=[
		('harvesting-auto-harvest-bool', _('wizard-harvesting-auto-harvest'))
	], default_values=['harvesting-auto-harvest-bool'])

	harvesting_generate_flag = CheckboxList(values=[
		('harvesting-generate-keys-bool', _('wizard-harvesting-generate-keys'))
	], default_values=['harvesting-generate-keys-bool'])

	harvesting_signing_key = ValidatingTextBox(
		_('wizard-harvesting-signing-key-label'),
		is_hex_private_key_string,
		_('wizard-harvesting-signing-key-error-text'))
	harvesting_vrf_key = ValidatingTextBox(
		_('wizard-harvesting-vrf-key-label'),
		is_hex_private_key_string,
		_('wizard-harvesting-vrf-key-error-text'))

	harvesting_delegate_flag = CheckboxList(values=[
		('harvesting-delegate-bool', _('wizard-harvesting-delegate'))
	])

	max_unlocked_accounts = ValidatingTextBox(
		_('wizard-harvesting-max-unlocked-accounts-label'),
		is_integer,
		_('wizard-harvesting-max-unlocked-accounts-error-text'),
		default_value='5')

	min_fee_multiplier = ValidatingTextBox(
		_('wizard-harvesting-min-fee-multiplier-label'),
		is_integer,
		_('wizard-harvesting-min-fee-multiplier-error-text'),
		default_value='100')

	beneficiary_address = ValidatingTextBox(
		_('wizard-harvesting-beneficiary-address-label'),
		lambda value: not value or facade(screens).network.is_valid_address_string(value),
		_('wizard-harvesting-beneficiary-address-error-text'))

	settings = HarvestingSettings(
		harvesting_flag,
		harvesting_auto_harvest_flag,
		harvesting_generate_flag,
		harvesting_signing_key,
		harvesting_vrf_key,
		harvesting_delegate_flag,
		max_unlocked_accounts,
		min_fee_multiplier,
		beneficiary_address
	)

	def is_valid():
		if not (max_unlocked_accounts.is_valid and min_fee_multiplier.is_valid and beneficiary_address.is_valid):
			return False

		return harvesting_generate_flag.current_values or (harvesting_signing_key.is_valid and harvesting_vrf_key.is_valid)

	return ScreenDialog(
		screen_id='harvesting',
		title=_('wizard-harvesting-title'),
		body=HSplit([
			harvesting_flag,

			# display more elements here when checked...
			ConditionalContainer(
				HSplit([
					harvesting_auto_harvest_flag,
					harvesting_generate_flag,
					ConditionalContainer(
						Box(
							VSplit([
								HSplit([
									harvesting_signing_key.label,
									harvesting_vrf_key.label
								], width=30),
								HSplit([
									harvesting_signing_key.input,
									harvesting_vrf_key.input,
								]),
							]),
							padding=1
						),
						filter=Condition(lambda: not harvesting_generate_flag.current_values)
					),
					harvesting_delegate_flag,

					VSplit([
						HSplit([
							max_unlocked_accounts.label,
							min_fee_multiplier.label,
							beneficiary_address.label
						], width=30),
						HSplit([
							max_unlocked_accounts.input,
							min_fee_multiplier.input,
							beneficiary_address.input
						])
					])

				]),
				filter=Condition(lambda: harvesting_flag.current_values)
			)
		]),

		accessor=settings,
		is_valid=is_valid
	)
