import pytest
from prometheus_client import CollectorRegistry
from symbolchain.CryptoTypes import PrivateKey

from bridge.api import BridgeContext
from bridge.api.metrics.ChainCollector import ChainCollector
from bridge.ethereum.EthereumAdapters import EthereumSdkFacade
from bridge.models.BridgeConfiguration import (
	BridgeConfiguration,
	GlobalConfiguration,
	MachineConfiguration,
	NetworkConfiguration,
	PriceOracleConfiguration,
	StrategyMode
)

from ...test.MockEthereumServer import create_simple_ethereum_client
from ...test.MockNemServer import create_simple_nem_client
from ...test.MockSymbolServer import create_simple_symbol_client

# pylint: disable=invalid-name

NEM_BRIDGE_ADDRESS = 'TBINJOHFNWMNUOJ2KW3DWJTLRVNAOGQCE6FECSQJ'
SYMBOL_BRIDGE_ADDRESS = 'TCRZANFBD6O6EGYCBAH6ICTLAMH6OGBV6CEH7UY'
ETHEREUM_BRIDGE_ADDRESS = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'

SYMBOL_MOSAIC_ID = '5D6CFC64A20E86E6'
ETHEREUM_TOKEN_ID = '0x5E8343A455F03109B737B6D8b410e4ECCE998cdA'

NEM_XEM_BALANCE = 4400
SYMBOL_MOSAIC_BALANCE = 55000
SYMBOL_XYM_BALANCE = 66000
ETHEREUM_TOKEN_BALANCE = 777000
ETHEREUM_ETH_BALANCE = 888000

UNREACHABLE_ENDPOINT = 'http://127.0.0.1:1'

# region fixtures


@pytest.fixture
async def nem_server(aiohttp_client):
	return await create_simple_nem_client(aiohttp_client, {NEM_BRIDGE_ADDRESS: NEM_XEM_BALANCE})


@pytest.fixture
async def symbol_server(aiohttp_client):
	return await create_simple_symbol_client(aiohttp_client, '0x72C0\'212E\'67A0\'8BCE', {
		SYMBOL_BRIDGE_ADDRESS: [(SYMBOL_MOSAIC_ID, SYMBOL_MOSAIC_BALANCE), ('currency', SYMBOL_XYM_BALANCE)]
	})


@pytest.fixture
async def ethereum_server(aiohttp_client):
	return await create_simple_ethereum_client(
		aiohttp_client,
		{ETHEREUM_BRIDGE_ADDRESS: ETHEREUM_ETH_BALANCE},
		{ETHEREUM_BRIDGE_ADDRESS: ETHEREUM_TOKEN_BALANCE})

# endregion


# region network configurations

def _nem_network(server=None, mosaic_id='nem:xem'):
	endpoint = str(server.make_url('')) if server else UNREACHABLE_ENDPOINT
	return NetworkConfiguration('nem', 'testnet', endpoint, NEM_BRIDGE_ADDRESS, mosaic_id, {})


def _symbol_network(server, mosaic_id=SYMBOL_MOSAIC_ID):
	return NetworkConfiguration('symbol', 'testnet', str(server.make_url('')), SYMBOL_BRIDGE_ADDRESS, mosaic_id, {})


def _ethereum_network(server, mosaic_id=ETHEREUM_TOKEN_ID):
	signer_key_pair = EthereumSdkFacade.KeyPair(PrivateKey('0999A20D4FDDA8D7273E8A24F70E1105F9DCFCAE2FBA55E9A08F6E752411ED7A'))
	return NetworkConfiguration('ethereum', 'testnet', str(server.make_url('')), ETHEREUM_BRIDGE_ADDRESS, mosaic_id, {
		'chain_id': '1337',
		'signer_public_key': f'0x{signer_key_pair.public_key}'
	})

# endregion


# region test utils

def _create_config(native_network, wrapped_network):
	"""Creates a configuration without any file on disk."""

	return BridgeConfiguration(
		# the collector reads neither the databases nor the price oracle, so these only need to parse
		MachineConfiguration('/nonexistent', '/nonexistent/log', 1, 1),
		GlobalConfiguration(StrategyMode.STAKE),
		PriceOracleConfiguration(UNREACHABLE_ENDPOINT, ''),
		PriceOracleConfiguration(UNREACHABLE_ENDPOINT, ''),
		native_network,
		wrapped_network)


async def _collect(native_network, wrapped_network):
	config = _create_config(native_network, wrapped_network)

	registry = CollectorRegistry()
	await ChainCollector(config, BridgeContext(config, 600), 3).collect(registry)
	return registry


ROLE_TO_ADDRESS = {'native': NEM_BRIDGE_ADDRESS, 'wrapped': SYMBOL_BRIDGE_ADDRESS}


def _balance(registry, role, token, address=None):
	address = address or ROLE_TO_ADDRESS[role]
	return registry.get_sample_value('bridge_balance', {'network': role, 'token': token, 'address': address})


def _gas_balance(registry, role, address=None):
	return registry.get_sample_value('bridge_gas_balance', {'network': role, 'address': address or ROLE_TO_ADDRESS[role]})


def _node_up(registry, role, server=None):
	endpoint = str(server.make_url('')) if server else UNREACHABLE_ENDPOINT
	return registry.get_sample_value('bridge_node_up', {'network': role, 'endpoint': endpoint})

# endregion


async def test_balances_are_reported_for_both_legs(nem_server, symbol_server):  # pylint: disable=redefined-outer-name
	# Act:
	registry = await _collect(_nem_network(nem_server), _symbol_network(symbol_server))

	# Assert: both nodes answered
	assert 1 == _node_up(registry, 'native', nem_server)
	assert 1 == _node_up(registry, 'wrapped', symbol_server)

	# ... and each balance was read for the token named in configuration
	assert NEM_XEM_BALANCE == _balance(registry, 'native', 'nem:xem')
	assert SYMBOL_MOSAIC_BALANCE == _balance(registry, 'wrapped', SYMBOL_MOSAIC_ID)


async def test_gas_is_reported_only_when_the_bridge_token_is_not_the_native_currency(nem_server, symbol_server):
	# pylint: disable=redefined-outer-name
	# Act: the native leg moves XEM itself, the wrapped leg moves a mosaic
	registry = await _collect(_nem_network(nem_server), _symbol_network(symbol_server))

	# Assert:
	assert SYMBOL_XYM_BALANCE == _gas_balance(registry, 'wrapped')
	assert _gas_balance(registry, 'native') is None


async def test_nem_leg_moving_a_mosaic_reports_a_separate_xem_balance(nem_server, symbol_server):  # pylint: disable=redefined-outer-name
	# Act:
	registry = await _collect(_nem_network(nem_server, 'foo:bar'), _symbol_network(symbol_server))

	# Assert:
	assert 2 * NEM_XEM_BALANCE == _balance(registry, 'native', 'foo:bar')
	assert NEM_XEM_BALANCE == _gas_balance(registry, 'native')


async def test_ethereum_leg_reports_token_balance_and_gas_separately(nem_server, ethereum_server):  # pylint: disable=redefined-outer-name
	# Act:
	registry = await _collect(_nem_network(nem_server), _ethereum_network(ethereum_server))

	# Assert: the bridge balance comes from the ERC-20 contract
	assert ETHEREUM_TOKEN_BALANCE == _balance(registry, 'wrapped', ETHEREUM_TOKEN_ID, ETHEREUM_BRIDGE_ADDRESS)

	# ... while gas is the ETH balance of the same account
	assert ETHEREUM_ETH_BALANCE == _gas_balance(registry, 'wrapped', ETHEREUM_BRIDGE_ADDRESS)


async def test_failed_balance_read_is_not_reported_as_a_zero_balance(nem_server, symbol_server):  # pylint: disable=redefined-outer-name
	# Arrange: the wrapped node answers during facade initialization but fails the balance lookup
	symbol_server.mock.simulate_account_error = True

	# Act:
	registry = await _collect(_nem_network(nem_server), _symbol_network(symbol_server))

	# Assert: only the failing leg is marked down
	assert 0 == _node_up(registry, 'wrapped', symbol_server)
	assert 1 == _node_up(registry, 'native', nem_server)

	# ... and it reports no balance at all, rather than a zero that would look like a drained account
	assert _balance(registry, 'wrapped', SYMBOL_MOSAIC_ID) is None
	assert NEM_XEM_BALANCE == _balance(registry, 'native', 'nem:xem')


async def test_unreachable_node_is_reported_as_down(symbol_server):  # pylint: disable=redefined-outer-name
	# Act: the native endpoint refuses connections, so facade initialization never completes
	registry = await _collect(_nem_network(), _symbol_network(symbol_server))

	# Assert: both legs are reported as down
	assert 0 == _node_up(registry, 'native')
	assert 0 == _node_up(registry, 'wrapped', symbol_server)

	# ... and no balance is published for either
	assert _balance(registry, 'native', 'nem:xem') is None
	assert _balance(registry, 'wrapped', SYMBOL_MOSAIC_ID) is None
