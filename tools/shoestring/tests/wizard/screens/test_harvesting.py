from shoestring.wizard.screens.harvesting import create

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
	assert screen.accessor.generate_keys
	assert '' == screen.accessor.harvester_signing_private_key
	assert '' == screen.accessor.harvester_vrf_private_key
	assert not screen.accessor.enable_delegated_harvesters_auto_detection

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
	assert screen.accessor.generate_keys
	assert '' == screen.accessor.harvester_signing_private_key
	assert '' == screen.accessor.harvester_vrf_private_key
	assert screen.accessor.enable_delegated_harvesters_auto_detection

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
	assert not screen.accessor.generate_keys
	assert TEST_PRIVATE_KEY_1 == screen.accessor.harvester_signing_private_key
	assert TEST_PRIVATE_KEY_2 == screen.accessor.harvester_vrf_private_key
	assert not screen.accessor.enable_delegated_harvesters_auto_detection

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


async def test_can_generate_diagnostic_accessor_representation():
	# Arrange:
	screen = create(None)
	screen.accessor._flag.current_values = [()]  # pylint: disable=protected-access
	screen.accessor._generate_keys_flag.current_values = []  # pylint: disable=protected-access
	screen.accessor._signing_key.input.text = TEST_PRIVATE_KEY_1  # pylint: disable=protected-access
	screen.accessor._vrf_key.input.text = TEST_PRIVATE_KEY_2  # pylint: disable=protected-access
	screen.accessor._delegate_flag.current_values = [()]  # pylint: disable=protected-access

	# Assert: check entered values
	assert (
		f'(active=True, generate=False, signing_key=\'{TEST_PRIVATE_KEY_1}\','
		f' vrf_key=\'{TEST_PRIVATE_KEY_2}\', delegate=True)' == repr(screen.accessor)
	)
