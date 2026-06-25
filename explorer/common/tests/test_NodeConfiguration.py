import pytest
from common.symbol.NodeConfiguration import SymbolNodeConfiguration, SymbolNodeConfigurationError


def _base_config(**overrides):
	config = {
		'SYMBOL_NODE_URL': 'http://localhost:3000',
		'SYMBOL_NODE_ALLOWED_HOSTS': 'localhost:3000',
		'SYMBOL_NODE_ALLOW_PRIVATE': 'false',
		'SYMBOL_NODE_ALLOW_LOOPBACK': 'true'
	}
	config.update(overrides)
	return config


def _assert_rejects_node_url(node_url, expected_message):
	with pytest.raises(SymbolNodeConfigurationError, match=expected_message):
		SymbolNodeConfiguration.from_app_config(_base_config(SYMBOL_NODE_URL=node_url))


def _assert_rejects_allowed_hosts(allowed_hosts):
	with pytest.raises(
		SymbolNodeConfigurationError,
		match='SYMBOL_NODE_ALLOWED_HOSTS entries must be exact host:port values'
	):
		SymbolNodeConfiguration.from_app_config(_base_config(SYMBOL_NODE_ALLOWED_HOSTS=allowed_hosts))


def test_rejects_missing_node_url():
	with pytest.raises(SymbolNodeConfigurationError, match='Symbol node URL is not configured'):
		SymbolNodeConfiguration.from_app_config({})


def test_app_config_normalizes_node():
	node_config = SymbolNodeConfiguration.from_app_config(_base_config(SYMBOL_NODE_REQUEST_TIMEOUT_SECONDS='15'))

	assert 'http' == node_config.scheme
	assert 'localhost' == node_config.host
	assert 3000 == node_config.port
	assert 'http://localhost:3000' == node_config.base_url
	assert frozenset({'localhost:3000'}) == node_config.allowed_hosts
	assert node_config.allow_loopback
	assert not node_config.allow_private
	assert 15 == node_config.timeout_seconds


def test_from_url_allows_origin():
	node_config = SymbolNodeConfiguration.from_url(
		'http://localhost:3000',
		allow_private=True,
		allow_loopback=True,
		timeout_seconds=15
	)

	assert 'http' == node_config.scheme
	assert 'localhost' == node_config.host
	assert 3000 == node_config.port
	assert 'http://localhost:3000' == node_config.base_url
	assert frozenset({'localhost:3000'}) == node_config.allowed_hosts
	assert node_config.allow_private
	assert node_config.allow_loopback
	assert 15 == node_config.timeout_seconds


def test_to_dict_hides_allowed_hosts():
	node_config = SymbolNodeConfiguration.from_app_config(_base_config(
		SYMBOL_NODE_ALLOW_PRIVATE=True,
		SYMBOL_NODE_ALLOW_LOOPBACK=True
	))

	assert {
		'baseUrl': 'http://localhost:3000',
		'allowPrivate': True,
		'allowLoopback': True,
		'timeoutSeconds': 10
	} == node_config.to_dict()


def test_rejects_missing_allowed_hosts():
	with pytest.raises(SymbolNodeConfigurationError, match='SYMBOL_NODE_ALLOWED_HOSTS is required'):
		SymbolNodeConfiguration.from_app_config(_base_config(SYMBOL_NODE_ALLOWED_HOSTS=None))


def test_rejects_empty_allowed_hosts():
	with pytest.raises(SymbolNodeConfigurationError, match='SYMBOL_NODE_ALLOWED_HOSTS is required'):
		SymbolNodeConfiguration.from_app_config(_base_config(SYMBOL_NODE_ALLOWED_HOSTS=', ,'))


def test_rejects_unlisted_host():
	with pytest.raises(SymbolNodeConfigurationError, match='Configured Symbol node host is not in SYMBOL_NODE_ALLOWED_HOSTS'):
		SymbolNodeConfiguration.from_app_config(_base_config(SYMBOL_NODE_ALLOWED_HOSTS='example.com:3000'))


def test_skips_empty_allowed_hosts():
	node_config = SymbolNodeConfiguration.from_app_config(_base_config(SYMBOL_NODE_ALLOWED_HOSTS='localhost:3000,'))

	assert frozenset({'localhost:3000'}) == node_config.allowed_hosts


@pytest.mark.parametrize('allowed_hosts', [
	'localhost',
	'http://localhost:3000',
	'localhost:*',
	'localhost:abc',
	'localhost:3000/path'
])
def test_rejects_bad_allowed_hosts(allowed_hosts):
	_assert_rejects_allowed_hosts(allowed_hosts)


@pytest.mark.parametrize(('node_url', 'expected_message'), [
	('http://localhost', 'Symbol node URL must include an explicit port'),
	('https://localhost', 'Symbol node URL must include an explicit port'),
	('ftp://localhost:3000', 'Symbol node URL scheme must be http or https'),
	('http://user@localhost:3000', 'Symbol node URL must not include userinfo'),
	('http://localhost:3000/path', 'Symbol node URL must not include a path prefix'),
	('http://localhost:3000?x=1', 'Symbol node URL must not include query or fragment'),
	('http://localhost:3000#fragment', 'Symbol node URL must not include query or fragment'),
	('http:///missing-host', 'Symbol node URL must include a host'),
	('http://localhost:abc', 'Symbol node URL port must be numeric')
])
def test_rejects_invalid_node_urls(node_url, expected_message):
	_assert_rejects_node_url(node_url, expected_message)


def test_rejects_metadata_url():
	with pytest.raises(SymbolNodeConfigurationError, match='Metadata service Symbol node host is not allowed'):
		SymbolNodeConfiguration.from_url('http://169.254.169.254:3000')


def test_rejects_metadata_config():
	with pytest.raises(SymbolNodeConfigurationError, match='Metadata service Symbol node host is not allowed'):
		SymbolNodeConfiguration.from_app_config(_base_config(
			SYMBOL_NODE_URL='http://169.254.169.254:3000',
			SYMBOL_NODE_ALLOWED_HOSTS='169.254.169.254:3000'
		))


@pytest.mark.parametrize(('private_config_value', 'loopback_config_value', 'expected_private', 'expected_loopback'), [
	(True, 'false', True, False),
	('true', 'false', True, False),
	('false', 'true', False, True),
])
def test_accepts_boolean_config_values(private_config_value, loopback_config_value, expected_private, expected_loopback):
	node_config = SymbolNodeConfiguration.from_app_config(_base_config(
		SYMBOL_NODE_ALLOW_PRIVATE=private_config_value,
		SYMBOL_NODE_ALLOW_LOOPBACK=loopback_config_value
	))

	assert expected_private == node_config.allow_private
	assert expected_loopback == node_config.allow_loopback


def test_rejects_bad_boolean_config():
	with pytest.raises(SymbolNodeConfigurationError, match='Boolean config values must be either true or false'):
		SymbolNodeConfiguration.from_app_config(_base_config(SYMBOL_NODE_ALLOW_PRIVATE='yes'))


@pytest.mark.parametrize('config_value', [
	'0',
	'-1',
	'invalid'
])
def test_rejects_bad_positive_int(config_value):
	with pytest.raises(SymbolNodeConfigurationError, match='SYMBOL_NODE_REQUEST_TIMEOUT_SECONDS must be a positive integer'):
		SymbolNodeConfiguration.from_app_config(_base_config(SYMBOL_NODE_REQUEST_TIMEOUT_SECONDS=config_value))


def test_allows_matching_request_target():
	node_config = SymbolNodeConfiguration.from_app_config(_base_config(
		SYMBOL_NODE_URL='http://127.0.0.1:3000',
		SYMBOL_NODE_ALLOWED_HOSTS='127.0.0.1:3000'
	))

	assert 'http://127.0.0.1:3000' == node_config.assert_request_allowed('http://127.0.0.1:3000')


def test_rejects_different_target():
	node_config = SymbolNodeConfiguration.from_app_config(_base_config())

	with pytest.raises(SymbolNodeConfigurationError, match='Symbol node request target does not match configured base URL'):
		node_config.assert_request_allowed('http://localhost:3001')


def test_rejects_unallowed_target():
	node_config = SymbolNodeConfiguration(
		scheme='http',
		host='localhost',
		port=3000,
		base_url='http://localhost:3000',
		allowed_hosts=frozenset()
	)

	with pytest.raises(SymbolNodeConfigurationError, match='Symbol node request target is not allowed'):
		node_config.assert_request_allowed('http://localhost:3000')


def test_rejects_metadata_request_target():
	node_config = SymbolNodeConfiguration(
		scheme='http',
		host='metadata.google.internal',
		port=3000,
		base_url='http://metadata.google.internal:3000',
		allowed_hosts=frozenset({'metadata.google.internal:3000'})
	)

	with pytest.raises(SymbolNodeConfigurationError, match='Metadata service Symbol node host is not allowed'):
		node_config.assert_request_allowed('http://metadata.google.internal:3000')


def test_rejects_loopback_without_flag():
	node_config = SymbolNodeConfiguration.from_url('http://127.0.0.1:3000')

	with pytest.raises(
		SymbolNodeConfigurationError,
		match='Loopback Symbol node address requires SYMBOL_NODE_ALLOW_LOOPBACK=true'
	):
		node_config.assert_request_allowed('http://127.0.0.1:3000')


def test_rejects_private_without_flag():
	node_config = SymbolNodeConfiguration.from_url('http://10.0.0.5:3000')

	with pytest.raises(SymbolNodeConfigurationError, match='Private Symbol node address requires SYMBOL_NODE_ALLOW_PRIVATE=true'):
		node_config.assert_request_allowed('http://10.0.0.5:3000')


def test_allows_private_with_flag():
	node_config = SymbolNodeConfiguration.from_url('http://10.0.0.5:3000', allow_private=True)

	assert 'http://10.0.0.5:3000' == node_config.assert_request_allowed('http://10.0.0.5:3000')


def test_rejects_link_local_address():
	node_config = SymbolNodeConfiguration.from_url('http://169.254.1.1:3000', allow_private=True)

	with pytest.raises(SymbolNodeConfigurationError, match='Resolved Symbol node address is not allowed'):
		node_config.assert_request_allowed('http://169.254.1.1:3000')
