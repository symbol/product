from shoestring.wizard.ShoestringOperation import ShoestringOperation, build_shoestring_command, requires_ca_key_path

# pylint: disable=invalid-name


# region requires_ca_key_path

def test_requires_ca_key_path_returns_true_for_operations_requiring_ca_key_path():
	assert requires_ca_key_path(ShoestringOperation.SETUP)
	assert not requires_ca_key_path(ShoestringOperation.UPGRADE)
	assert not requires_ca_key_path(ShoestringOperation.RESET_DATA)
	assert requires_ca_key_path(ShoestringOperation.RENEW_CERTIFICATES)
	assert not requires_ca_key_path(ShoestringOperation.RENEW_VOTING_KEYS)

# endregion


# region build_shoestring_command

def _assert_can_build_shoestring_command_setup(has_custom_node_metadata, expected_additional_args):
	# Act:
	args = build_shoestring_command(ShoestringOperation.SETUP, 'symbol', 'shoestring', 'cert/ca.key.pem', 'sai', has_custom_node_metadata)

	# Assert:
	assert [
		'setup',
		'--config', 'shoestring/shoestring.ini',
		'--directory', 'symbol',
		'--ca-key-path', 'cert/ca.key.pem',
		'--overrides', 'shoestring/overrides.ini',
		'--package', 'sai',
		'--security', 'insecure'
	] + expected_additional_args == args


def test_can_build_shoestring_command_setup():
	_assert_can_build_shoestring_command_setup(False, [])


def test_can_build_shoestring_command_setup_with_custom_node_metadata():
	_assert_can_build_shoestring_command_setup(True, ['--metadata', 'shoestring/node_metadata.json'])


def test_can_build_shoestring_command_upgrade():
	# Act:
	args = build_shoestring_command(ShoestringOperation.UPGRADE, 'symbol', 'shoestring', 'cert/ca.key.pem', 'sai')

	# Assert:
	assert [
		'upgrade',
		'--config', 'shoestring/shoestring.ini',
		'--directory', 'symbol',
		'--overrides', 'shoestring/overrides.ini',
		'--package', 'sai'
	] == args


def test_can_build_shoestring_command_reset_data():
	# Act:
	args = build_shoestring_command(ShoestringOperation.RESET_DATA, 'symbol', 'shoestring', 'cert/ca.key.pem', 'sai')

	# Assert:
	assert [
		'reset-data',
		'--config', 'shoestring/shoestring.ini',
		'--directory', 'symbol'
	] == args


def test_can_build_shoestring_command_renew_certificates():
	# Act:
	args = build_shoestring_command(ShoestringOperation.RENEW_CERTIFICATES, 'symbol', 'shoestring', 'cert/ca.key.pem', 'sai')

	# Assert:
	assert [
		'renew-certificates',
		'--config', 'shoestring/shoestring.ini',
		'--directory', 'symbol',
		'--ca-key-path', 'cert/ca.key.pem'
	] == args


def test_can_build_shoestring_command_renew_voting_keys():
	# Act:
	args = build_shoestring_command(ShoestringOperation.RENEW_VOTING_KEYS, 'symbol', 'shoestring', 'cert/ca.key.pem', 'sai')

	# Assert:
	assert [
		'renew-voting-keys',
		'--config', 'shoestring/shoestring.ini',
		'--directory', 'symbol',
	] == args

# endregion
