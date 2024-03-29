from collections import namedtuple

from shoestring.wizard.screens.harvesting import create

SingleValueScreen = namedtuple('SingleValueScreen', ['current_value'])

TEST_PRIVATE_KEY_1 = 'C379733959D5CE7A06A3D80035B716E671678824630C7B97927BF0945504F319'
TEST_PRIVATE_KEY_2 = '8D3CCE310AA48479B5E0A853D71BA2BAB9D00D376A24BC00CA0AD69B235723E7'


# pylint: disable=invalid-name

def test_can_create_screen():
	# Act:
	screen = create(None)

	# Assert: check id
	assert 'harvesting' == screen.screen_id

	# - check defaults
	assert not screen.accessor.active
	assert screen.accessor.auto_harvest
	assert screen.accessor.generate_keys
	assert '' == screen.accessor.harvester_signing_private_key
	assert '' == screen.accessor.harvester_vrf_private_key
	assert not screen.accessor.enable_delegated_harvesters_auto_detection
	assert 5 == screen.accessor.max_unlocked_accounts
	assert 100 == screen.accessor.min_fee_multiplier
	assert '' == screen.accessor.beneficiary_address

	# - defaults are valid
	assert screen.is_valid()


async def test_can_enter_valid_input_generated_keys():
	# Arrange:
	screen = create(None)

	# Act:
	screen.accessor._flag.current_values = [()]  # pylint: disable=protected-access
	screen.accessor._delegate_flag.current_values = [()]  # pylint: disable=protected-access

	# Assert: check entered values
	assert screen.accessor.active
	assert screen.accessor.auto_harvest
	assert screen.accessor.generate_keys
	assert '' == screen.accessor.harvester_signing_private_key
	assert '' == screen.accessor.harvester_vrf_private_key
	assert screen.accessor.enable_delegated_harvesters_auto_detection
	assert 5 == screen.accessor.max_unlocked_accounts
	assert 100 == screen.accessor.min_fee_multiplier
	assert '' == screen.accessor.beneficiary_address

	# - inputs are valid
	assert screen.is_valid()


async def test_can_enter_valid_input_entered_keys():
	# Arrange:
	screen = create(None)

	# Act:
	screen.accessor._flag.current_values = [()]  # pylint: disable=protected-access
	screen.accessor._generate_keys_flag.current_values = []  # pylint: disable=protected-access
	screen.accessor._signing_key.input.text = TEST_PRIVATE_KEY_1  # pylint: disable=protected-access
	screen.accessor._vrf_key.input.text = TEST_PRIVATE_KEY_2  # pylint: disable=protected-access
	screen.accessor._signing_key.input.buffer.validate()  # pylint: disable=protected-access
	screen.accessor._vrf_key.input.buffer.validate()  # pylint: disable=protected-access

	# Assert: check entered values
	assert screen.accessor.active
	assert screen.accessor.auto_harvest
	assert not screen.accessor.generate_keys
	assert TEST_PRIVATE_KEY_1 == screen.accessor.harvester_signing_private_key
	assert TEST_PRIVATE_KEY_2 == screen.accessor.harvester_vrf_private_key
	assert not screen.accessor.enable_delegated_harvesters_auto_detection
	assert 5 == screen.accessor.max_unlocked_accounts
	assert 100 == screen.accessor.min_fee_multiplier
	assert '' == screen.accessor.beneficiary_address

	# - inputs are valid
	assert screen.is_valid()


async def test_fails_validation_when_entered_signing_key_is_invalid():
	# Arrange:
	screen = create(None)

	# Act:
	screen.accessor._flag.current_values = [()]  # pylint: disable=protected-access
	screen.accessor._generate_keys_flag.current_values = []  # pylint: disable=protected-access
	screen.accessor._signing_key.input.text = TEST_PRIVATE_KEY_1[1:]  # pylint: disable=protected-access
	screen.accessor._vrf_key.input.text = TEST_PRIVATE_KEY_2  # pylint: disable=protected-access
	screen.accessor._signing_key.input.buffer.validate()  # pylint: disable=protected-access
	screen.accessor._vrf_key.input.buffer.validate()  # pylint: disable=protected-access

	# Assert: inputs are not valid
	assert not screen.is_valid()


async def test_fails_validation_when_entered_vrf_key_is_invalid():
	# Arrange:
	screen = create(None)

	# Act:
	screen.accessor._flag.current_values = [()]  # pylint: disable=protected-access
	screen.accessor._generate_keys_flag.current_values = []  # pylint: disable=protected-access
	screen.accessor._signing_key.input.text = TEST_PRIVATE_KEY_1  # pylint: disable=protected-access
	screen.accessor._vrf_key.input.text = TEST_PRIVATE_KEY_2[1:]  # pylint: disable=protected-access
	screen.accessor._signing_key.input.buffer.validate()  # pylint: disable=protected-access
	screen.accessor._vrf_key.input.buffer.validate()  # pylint: disable=protected-access

	# Assert: inputs are not valid
	assert not screen.is_valid()


async def test_fails_validation_when_entered_max_unlocked_accounts_is_invalid():
	# Arrange:
	screen = create(None)
	screen.accessor._flag.current_values = [()]  # pylint: disable=protected-access
	screen.accessor._delegate_flag.current_values = [()]  # pylint: disable=protected-access
	screen.accessor._max_unlocked_accounts.input.text = 'ABC'  # pylint: disable=protected-access
	screen.accessor._max_unlocked_accounts.input.buffer.validate()  # pylint: disable=protected-access

	# Asssert: inputs are not valid
	assert not screen.is_valid()


async def test_fails_validation_when_entered_min_fee_multiplier_is_invalid():
	# Arrange:
	screen = create(None)
	screen.accessor._flag.current_values = [()]  # pylint: disable=protected-access
	screen.accessor._delegate_flag.current_values = [()]  # pylint: disable=protected-access
	screen.accessor._min_fee_multiplier.input.text = 'ABC'  # pylint: disable=protected-access
	screen.accessor._min_fee_multiplier.input.buffer.validate()  # pylint: disable=protected-access

	# Asssert: inputs are not valid
	assert not screen.is_valid()


async def test_fails_validation_when_entered_beneficiary_address_is_invalid():
	# Arrange:
	screen = create({'network-type': SingleValueScreen('sai')})
	screen.accessor._flag.current_values = [()]  # pylint: disable=protected-access
	screen.accessor._delegate_flag.current_values = [()]  # pylint: disable=protected-access
	screen.accessor._beneficiary_address.input.text = 'ABC'  # pylint: disable=protected-access
	screen.accessor._beneficiary_address.input.buffer.validate()  # pylint: disable=protected-access

	# Asssert: inputs are not valid
	assert not screen.is_valid()


async def test_can_generate_diagnostic_accessor_representation_harvester_disabled():
	# Arrange:
	screen = create({'network-type': SingleValueScreen('sai')})
	screen.accessor._flag.current_values = []  # pylint: disable=protected-access
	screen.accessor._auto_harvest_flag.current_values = [()]  # pylint: disable=protected-access
	screen.accessor._generate_keys_flag.current_values = []  # pylint: disable=protected-access
	screen.accessor._signing_key.input.text = TEST_PRIVATE_KEY_1  # pylint: disable=protected-access
	screen.accessor._vrf_key.input.text = TEST_PRIVATE_KEY_2  # pylint: disable=protected-access
	screen.accessor._delegate_flag.current_values = [()]  # pylint: disable=protected-access
	screen.accessor._max_unlocked_accounts.input.text = '7'  # pylint: disable=protected-access
	screen.accessor._min_fee_multiplier.input.text = '123'  # pylint: disable=protected-access
	screen.accessor._beneficiary_address.input.text = 'ABC'  # pylint: disable=protected-access

	# Assert: check entered values
	assert (
		'(active=False, auto_harvest=True, generate=False, '
		f'signing_key=\'{TEST_PRIVATE_KEY_1}\', vrf_key=\'{TEST_PRIVATE_KEY_2}\', '
		'delegate=True, max_unlocked_accounts=7, min_fee_multiplier=123, beneficiary_address=ABC)'
	) == repr(screen.accessor)
	assert [
		('harvester role', 'disabled')
	] == screen.accessor.tokens


async def test_can_generate_diagnostic_accessor_representation_harvester_enabled_imported_keys():
	# Arrange:
	screen = create({'network-type': SingleValueScreen('sai')})
	screen.accessor._flag.current_values = [()]  # pylint: disable=protected-access
	screen.accessor._auto_harvest_flag.current_values = [()]  # pylint: disable=protected-access
	screen.accessor._generate_keys_flag.current_values = []  # pylint: disable=protected-access
	screen.accessor._signing_key.input.text = TEST_PRIVATE_KEY_1  # pylint: disable=protected-access
	screen.accessor._vrf_key.input.text = TEST_PRIVATE_KEY_2  # pylint: disable=protected-access
	screen.accessor._delegate_flag.current_values = [()]  # pylint: disable=protected-access
	screen.accessor._max_unlocked_accounts.input.text = '7'  # pylint: disable=protected-access
	screen.accessor._min_fee_multiplier.input.text = '123'  # pylint: disable=protected-access
	screen.accessor._beneficiary_address.input.text = 'ABC'  # pylint: disable=protected-access

	# Assert: check entered values
	assert (
		'(active=True, auto_harvest=True, generate=False, '
		f'signing_key=\'{TEST_PRIVATE_KEY_1}\', vrf_key=\'{TEST_PRIVATE_KEY_2}\', '
		'delegate=True, max_unlocked_accounts=7, min_fee_multiplier=123, beneficiary_address=ABC)'
	) == repr(screen.accessor)
	assert [
		('harvester role', 'enabled'),
		('* auto harvest?', 'enabled'),
		('* generate keys?', 'disabled'),
		('* auto detect delegates?', 'enabled'),
		('* max unlocked accounts', 7),
		('* min fee multiplier', 123),
		('* beneficiary address', 'ABC')
	] == screen.accessor.tokens


async def test_can_generate_diagnostic_accessor_representation_harvester_enabled_generated_keys():
	# Arrange:
	screen = create({'network-type': SingleValueScreen('sai')})
	screen.accessor._flag.current_values = [()]  # pylint: disable=protected-access
	screen.accessor._auto_harvest_flag.current_values = []  # pylint: disable=protected-access
	screen.accessor._generate_keys_flag.current_values = [()]  # pylint: disable=protected-access
	screen.accessor._delegate_flag.current_values = []  # pylint: disable=protected-access
	screen.accessor._max_unlocked_accounts.input.text = '6'  # pylint: disable=protected-access
	screen.accessor._min_fee_multiplier.input.text = '123'  # pylint: disable=protected-access
	screen.accessor._beneficiary_address.input.text = 'DEF'  # pylint: disable=protected-access

	# Assert: check entered values
	assert (
		'(active=True, auto_harvest=False, generate=True, '
		'signing_key=\'\', vrf_key=\'\', '
		'delegate=False, max_unlocked_accounts=6, min_fee_multiplier=123, beneficiary_address=DEF)'
	) == repr(screen.accessor)
	assert [
		('harvester role', 'enabled'),
		('* auto harvest?', 'disabled'),
		('* generate keys?', 'enabled'),
		('* auto detect delegates?', 'disabled'),
		('* max unlocked accounts', 6),
		('* min fee multiplier', 123),
		('* beneficiary address', 'DEF')
	] == screen.accessor.tokens
