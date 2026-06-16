from unittest.mock import patch

import pytest

from rest.model.symbol.NodeConfig import SymbolNodeConfig, SymbolNodeConfigError


def _base_config(**overrides):
	config = {
		'SYMBOL_NODE_URL': 'http://localhost:3000',
		'SYMBOL_NODE_ALLOWED_HOSTS': 'localhost:3000',
		'SYMBOL_NODE_ALLOW_PRIVATE': 'false',
		'SYMBOL_NODE_ALLOW_LOOPBACK': 'true'
	}
	config.update(overrides)
	return config


def _mock_address(address):
	return [(None, None, None, None, (address, 3000))]


def test_missing_node_url():
	assert SymbolNodeConfig.from_app_config({}) is None


def test_normalizes_node_config():
	node_config = SymbolNodeConfig.from_app_config(_base_config())

	assert 'http' == node_config.scheme
	assert 'localhost' == node_config.host
	assert 3000 == node_config.port
	assert 'http://localhost:3000' == node_config.base_url
	assert frozenset({'localhost:3000'}) == node_config.allowed_hosts
	assert node_config.allow_loopback
	assert not node_config.allow_private
	assert 10 == node_config.timeout_seconds


def test_normalizes_env_node_config(monkeypatch):
	monkeypatch.setenv('SYMBOL_NODE_ALLOWED_HOSTS', 'localhost:3000')
	monkeypatch.setenv('SYMBOL_NODE_ALLOW_PRIVATE', 'false')
	monkeypatch.setenv('SYMBOL_NODE_ALLOW_LOOPBACK', 'true')
	monkeypatch.setenv('SYMBOL_NODE_REQUEST_TIMEOUT_SECONDS', '15')

	node_config = SymbolNodeConfig.from_env('http://localhost:3000')

	assert 'http' == node_config.scheme
	assert 'localhost' == node_config.host
	assert 3000 == node_config.port
	assert 'http://localhost:3000' == node_config.base_url
	assert frozenset({'localhost:3000'}) == node_config.allowed_hosts
	assert node_config.allow_loopback
	assert not node_config.allow_private
	assert 15 == node_config.timeout_seconds


def test_rejects_env_unlisted_host(monkeypatch):
	monkeypatch.setenv('SYMBOL_NODE_ALLOWED_HOSTS', 'example.com:3000')

	with pytest.raises(SymbolNodeConfigError, match='Configured Symbol node host is not in SYMBOL_NODE_ALLOWED_HOSTS'):
		SymbolNodeConfig.from_env('http://localhost:3000')


def test_rejects_env_metadata_host(monkeypatch):
	monkeypatch.setenv('SYMBOL_NODE_ALLOWED_HOSTS', '169.254.169.254:3000')

	with pytest.raises(SymbolNodeConfigError, match='Metadata service Symbol node host is not allowed'):
		SymbolNodeConfig.from_env('http://169.254.169.254:3000')


def test_accepts_boolean_config_values():
	node_config = SymbolNodeConfig.from_app_config(_base_config(
		SYMBOL_NODE_ALLOW_PRIVATE=True,
		SYMBOL_NODE_ALLOW_LOOPBACK=True
	))

	assert node_config.allow_private
	assert node_config.allow_loopback


def test_rejects_bad_bool():
	with pytest.raises(SymbolNodeConfigError, match='Boolean config values must be either true or false'):
		SymbolNodeConfig.from_app_config(_base_config(SYMBOL_NODE_ALLOW_PRIVATE='yes'))


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
		SymbolNodeConfig.from_app_config(_base_config(**{config_key: config_value}))


@pytest.mark.parametrize('node_url', [
	'ftp://localhost:3000',
	'http://user@localhost:3000',
	'http://localhost:3000/path',
	'http://localhost:3000?x=1',
	'http://localhost:3000#fragment',
	'http:///missing-host'
])
def test_rejects_invalid_base_urls(node_url):
	with pytest.raises(SymbolNodeConfigError):
		SymbolNodeConfig.from_app_config(_base_config(SYMBOL_NODE_URL=node_url))


@pytest.mark.parametrize('allowed_hosts', [
	'',
	'http://localhost:3000',
	'localhost',
	'localhost:*',
	'localhost:abc',
	'localhost:3000/path'
])
def test_rejects_invalid_allowed_hosts(allowed_hosts):
	with pytest.raises(SymbolNodeConfigError):
		SymbolNodeConfig.from_app_config(_base_config(SYMBOL_NODE_ALLOWED_HOSTS=allowed_hosts))


def test_rejects_empty_allowed_hosts():
	with pytest.raises(SymbolNodeConfigError, match='SYMBOL_NODE_ALLOWED_HOSTS is required'):
		SymbolNodeConfig.from_app_config(_base_config(SYMBOL_NODE_ALLOWED_HOSTS=', ,'))


def test_skips_empty_allowed_hosts():
	node_config = SymbolNodeConfig.from_app_config(_base_config(SYMBOL_NODE_ALLOWED_HOSTS='localhost:3000,'))

	assert frozenset({'localhost:3000'}) == node_config.allowed_hosts


def test_rejects_host_not_in_allowlist():
	with pytest.raises(SymbolNodeConfigError, match='Configured Symbol node host is not in SYMBOL_NODE_ALLOWED_HOSTS'):
		SymbolNodeConfig.from_app_config(_base_config(SYMBOL_NODE_ALLOWED_HOSTS='example.com:3000'))


def test_rejects_metadata_service_host():
	with pytest.raises(SymbolNodeConfigError, match='Metadata service Symbol node host is not allowed'):
		SymbolNodeConfig.from_app_config(_base_config(
			SYMBOL_NODE_URL='http://169.254.169.254:3000',
			SYMBOL_NODE_ALLOWED_HOSTS='169.254.169.254:3000'
		))


def test_allows_matching_request_target():
	node_config = SymbolNodeConfig.from_app_config(_base_config())

	with patch('rest.model.symbol.NodeConfig.socket.getaddrinfo', return_value=_mock_address('127.0.0.1')):
		assert 'http://localhost:3000' == node_config.assert_request_allowed('http://localhost:3000')


def test_rejects_different_target():
	node_config = SymbolNodeConfig.from_app_config(_base_config())

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
	node_config = SymbolNodeConfig.from_app_config(_base_config(SYMBOL_NODE_ALLOW_LOOPBACK='false'))

	with patch('rest.model.symbol.NodeConfig.socket.getaddrinfo', return_value=_mock_address('127.0.0.1')):
		with pytest.raises(SymbolNodeConfigError, match='Loopback Symbol node address requires SYMBOL_NODE_ALLOW_LOOPBACK=true'):
			node_config.assert_request_allowed('http://localhost:3000')


def test_rejects_private_without_flag():
	node_config = SymbolNodeConfig.from_app_config(_base_config(
		SYMBOL_NODE_URL='http://symbol.internal:3000',
		SYMBOL_NODE_ALLOWED_HOSTS='symbol.internal:3000'
	))

	with patch('rest.model.symbol.NodeConfig.socket.getaddrinfo', return_value=_mock_address('10.0.0.5')):
		with pytest.raises(SymbolNodeConfigError, match='Private Symbol node address requires SYMBOL_NODE_ALLOW_PRIVATE=true'):
			node_config.assert_request_allowed('http://symbol.internal:3000')


def test_allows_private_with_flag():
	node_config = SymbolNodeConfig.from_app_config(_base_config(
		SYMBOL_NODE_URL='http://symbol.internal:3000',
		SYMBOL_NODE_ALLOWED_HOSTS='symbol.internal:3000',
		SYMBOL_NODE_ALLOW_PRIVATE='true'
	))

	with patch('rest.model.symbol.NodeConfig.socket.getaddrinfo', return_value=_mock_address('10.0.0.5')):
		assert 'http://symbol.internal:3000' == node_config.assert_request_allowed('http://symbol.internal:3000')


def test_rejects_forbidden_address():
	node_config = SymbolNodeConfig.from_app_config(_base_config(
		SYMBOL_NODE_URL='http://symbol.internal:3000',
		SYMBOL_NODE_ALLOWED_HOSTS='symbol.internal:3000',
		SYMBOL_NODE_ALLOW_PRIVATE='true'
	))

	with patch('rest.model.symbol.NodeConfig.socket.getaddrinfo', return_value=_mock_address('169.254.169.254')):
		with pytest.raises(SymbolNodeConfigError, match='Resolved Symbol node address is not allowed'):
			node_config.assert_request_allowed('http://symbol.internal:3000')


def test_to_dict_hides_allowlist():
	node_config = SymbolNodeConfig.from_app_config(_base_config())

	assert {
		'baseUrl': 'http://localhost:3000',
		'allowPrivate': False,
		'allowLoopback': True,
		'timeoutSeconds': 10
	} == node_config.to_dict()
