import pytest

from puller.model.symbol.NodeConfig import SymbolNodeConfig, SymbolNodeConfigError


def _base_app_config(**overrides):
	values = {
		'SYMBOL_NODE_URL': 'http://localhost:3000',
		'SYMBOL_NODE_ALLOWED_HOSTS': 'localhost:3000',
		'SYMBOL_NODE_ALLOW_PRIVATE': 'false',
		'SYMBOL_NODE_ALLOW_LOOPBACK': 'true'
	}
	values.update(overrides)

	return values


def _assert_rejects_node_url(node_url, expected_message):
	with pytest.raises(SymbolNodeConfigError, match=expected_message):
		SymbolNodeConfig.from_url(node_url)


def _assert_rejects_allowed_hosts(allowed_hosts):
	with pytest.raises(SymbolNodeConfigError, match='SYMBOL_NODE_ALLOWED_HOSTS entries must be exact host:port values'):
		SymbolNodeConfig.from_app_config(_base_app_config(SYMBOL_NODE_ALLOWED_HOSTS=allowed_hosts))


def test_normalizes_node_config():
	node_config = SymbolNodeConfig.from_url(
		'http://localhost:3000',
		allow_loopback=True,
		timeout_seconds=15
	)

	assert 'http' == node_config.scheme
	assert 'localhost' == node_config.host
	assert 3000 == node_config.port
	assert 'http://localhost:3000' == node_config.base_url
	assert frozenset({'localhost:3000'}) == node_config.allowed_hosts
	assert node_config.allow_loopback
	assert not node_config.allow_private
	assert 15 == node_config.timeout_seconds


def test_defaults_http_port():
	node_config = SymbolNodeConfig.from_url('http://localhost')

	assert 80 == node_config.port
	assert 'http://localhost:80' == node_config.base_url
	assert frozenset({'localhost:80'}) == node_config.allowed_hosts


def test_defaults_https_port():
	node_config = SymbolNodeConfig.from_url('https://localhost')

	assert 443 == node_config.port
	assert 'https://localhost:443' == node_config.base_url
	assert frozenset({'localhost:443'}) == node_config.allowed_hosts


def test_missing_app_node_url():
	assert SymbolNodeConfig.from_app_config({}) is None


def test_normalizes_app_node_config():
	node_config = SymbolNodeConfig.from_app_config(_base_app_config(
		SYMBOL_NODE_ALLOW_PRIVATE=True,
		SYMBOL_NODE_ALLOW_LOOPBACK=True
	))

	assert 'http' == node_config.scheme
	assert 'localhost' == node_config.host
	assert 3000 == node_config.port
	assert 'http://localhost:3000' == node_config.base_url
	assert frozenset({'localhost:3000'}) == node_config.allowed_hosts
	assert node_config.allow_private
	assert node_config.allow_loopback
	assert 10 == node_config.timeout_seconds


def test_to_dict_hides_allowlist():
	node_config = SymbolNodeConfig.from_app_config(_base_app_config(
		SYMBOL_NODE_ALLOW_PRIVATE=True,
		SYMBOL_NODE_ALLOW_LOOPBACK=True
	))

	assert {
		'baseUrl': 'http://localhost:3000',
		'allowPrivate': True,
		'allowLoopback': True,
		'timeoutSeconds': 10
	} == node_config.to_dict()


def test_app_host_not_allowlisted():
	with pytest.raises(SymbolNodeConfigError, match='Configured Symbol node host is not in SYMBOL_NODE_ALLOWED_HOSTS'):
		SymbolNodeConfig.from_app_config(_base_app_config(SYMBOL_NODE_ALLOWED_HOSTS='example.com:3000'))


def test_app_metadata_host_rejected():
	with pytest.raises(SymbolNodeConfigError, match='Metadata service Symbol node host is not allowed'):
		SymbolNodeConfig.from_app_config(_base_app_config(
			SYMBOL_NODE_URL='http://169.254.169.254:3000',
			SYMBOL_NODE_ALLOWED_HOSTS='169.254.169.254:3000'
		))


def test_accepts_boolean_config_values():
	node_config = SymbolNodeConfig.from_app_config(_base_app_config(
		SYMBOL_NODE_ALLOW_PRIVATE='true',
		SYMBOL_NODE_ALLOW_LOOPBACK='true'
	))

	assert node_config.allow_private
	assert node_config.allow_loopback


def test_rejects_bad_bool():
	with pytest.raises(SymbolNodeConfigError, match='Boolean config values must be either true or false'):
		SymbolNodeConfig.from_app_config(_base_app_config(SYMBOL_NODE_ALLOW_PRIVATE='yes'))


@pytest.mark.parametrize('config_key', [
	'SYMBOL_NODE_REQUEST_TIMEOUT_SECONDS'
])
@pytest.mark.parametrize('config_value', [
	'0',
	'-1',
	'invalid'
])
def test_rejects_bad_positive_int(config_key, config_value):
	with pytest.raises(SymbolNodeConfigError, match=f'{config_key} must be a positive integer'):
		SymbolNodeConfig.from_app_config(_base_app_config(**{config_key: config_value}))


def test_rejects_missing_allowed_hosts():
	with pytest.raises(SymbolNodeConfigError, match='SYMBOL_NODE_ALLOWED_HOSTS is required'):
		SymbolNodeConfig.from_app_config(_base_app_config(SYMBOL_NODE_ALLOWED_HOSTS=None))


def test_rejects_unsupported_url_scheme():
	_assert_rejects_node_url('ftp://localhost:3000', 'Symbol node URL scheme must be http or https')


def test_rejects_url_userinfo():
	_assert_rejects_node_url('http://user@localhost:3000', 'Symbol node URL must not include userinfo')


def test_rejects_url_path_prefix():
	_assert_rejects_node_url('http://localhost:3000/path', 'Symbol node URL must not include a path prefix')


def test_rejects_url_query():
	_assert_rejects_node_url('http://localhost:3000?x=1', 'Symbol node URL must not include query or fragment')


def test_rejects_url_fragment():
	_assert_rejects_node_url('http://localhost:3000#fragment', 'Symbol node URL must not include query or fragment')


def test_rejects_url_missing_host():
	_assert_rejects_node_url('http:///missing-host', 'Symbol node URL must include a host')


def test_rejects_url_non_numeric_port():
	_assert_rejects_node_url('http://localhost:abc', 'Symbol node URL port must be numeric')


def test_rejects_allowed_hosts_without_port():
	_assert_rejects_allowed_hosts('localhost')


def test_rejects_allowed_hosts_with_scheme():
	_assert_rejects_allowed_hosts('http://localhost:3000')


def test_rejects_allowed_hosts_with_wildcard():
	_assert_rejects_allowed_hosts('localhost:*')


def test_rejects_allowed_hosts_with_non_numeric_port():
	_assert_rejects_allowed_hosts('localhost:abc')


def test_rejects_allowed_hosts_with_path():
	_assert_rejects_allowed_hosts('localhost:3000/path')


def test_rejects_empty_allowed_hosts():
	with pytest.raises(SymbolNodeConfigError, match='SYMBOL_NODE_ALLOWED_HOSTS is required'):
		SymbolNodeConfig.from_app_config(_base_app_config(SYMBOL_NODE_ALLOWED_HOSTS=', ,'))


def test_skips_empty_allowed_hosts():
	node_config = SymbolNodeConfig.from_app_config(_base_app_config(SYMBOL_NODE_ALLOWED_HOSTS='localhost:3000,'))

	assert frozenset({'localhost:3000'}) == node_config.allowed_hosts


def test_rejects_host_not_in_allowlist():
	with pytest.raises(SymbolNodeConfigError, match='Configured Symbol node host is not in SYMBOL_NODE_ALLOWED_HOSTS'):
		SymbolNodeConfig.from_app_config(_base_app_config(SYMBOL_NODE_ALLOWED_HOSTS='example.com:3000'))


def test_rejects_metadata_service_host():
	with pytest.raises(SymbolNodeConfigError, match='Metadata service Symbol node host is not allowed'):
		SymbolNodeConfig.from_url('http://169.254.169.254:3000')


def test_allows_matching_request_target():
	node_config = SymbolNodeConfig.from_url('http://127.0.0.1:3000', allow_loopback=True)

	assert 'http://127.0.0.1:3000' == node_config.assert_request_allowed('http://127.0.0.1:3000')


def test_rejects_different_target():
	node_config = SymbolNodeConfig.from_url('http://localhost:3000', allow_loopback=True)

	with pytest.raises(SymbolNodeConfigError, match='Symbol node request target does not match configured base URL'):
		node_config.assert_request_allowed('http://localhost:3001')


def test_rejects_removed_target():
	node_config = SymbolNodeConfig(
		scheme='http',
		host='localhost',
		port=3000,
		base_url='http://localhost:3000',
		allowed_hosts=frozenset()
	)

	with pytest.raises(SymbolNodeConfigError, match='Symbol node request target is not allowed'):
		node_config.assert_request_allowed('http://localhost:3000')


def test_rejects_metadata_target():
	node_config = SymbolNodeConfig(
		scheme='http',
		host='metadata.google.internal',
		port=3000,
		base_url='http://metadata.google.internal:3000',
		allowed_hosts=frozenset({'metadata.google.internal:3000'})
	)

	with pytest.raises(SymbolNodeConfigError, match='Metadata service Symbol node host is not allowed'):
		node_config.assert_request_allowed('http://metadata.google.internal:3000')


def test_rejects_loopback_without_flag():
	node_config = SymbolNodeConfig.from_url('http://127.0.0.1:3000')

	with pytest.raises(
		SymbolNodeConfigError,
		match='Loopback Symbol node address requires SYMBOL_NODE_ALLOW_LOOPBACK=true'
	):
		node_config.assert_request_allowed('http://127.0.0.1:3000')


def test_rejects_private_without_flag():
	node_config = SymbolNodeConfig.from_url('http://10.0.0.5:3000')

	with pytest.raises(SymbolNodeConfigError, match='Private Symbol node address requires SYMBOL_NODE_ALLOW_PRIVATE=true'):
		node_config.assert_request_allowed('http://10.0.0.5:3000')


def test_allows_private_with_flag():
	node_config = SymbolNodeConfig.from_url('http://10.0.0.5:3000', allow_private=True)

	assert 'http://10.0.0.5:3000' == node_config.assert_request_allowed('http://10.0.0.5:3000')


def test_rejects_forbidden_address():
	node_config = SymbolNodeConfig.from_url('http://169.254.1.1:3000', allow_private=True)

	with pytest.raises(SymbolNodeConfigError, match='Resolved Symbol node address is not allowed'):
		node_config.assert_request_allowed('http://169.254.1.1:3000')
