import pytest

from bridge.models.BridgeConfiguration import NetworkConfiguration
from bridge.nem.NemNetworkFacade import NemNetworkFacade
from bridge.NetworkFacadeLoader import load_network_facade
from bridge.symbol.SymbolNetworkFacade import SymbolNetworkFacade

from .test.PytestUtils import create_simple_nem_client, create_simple_symbol_client


@pytest.fixture
async def symbol_server(aiohttp_client):
	return await create_simple_symbol_client(aiohttp_client, '0x72C0\'212E\'67A0\'8BCE')


@pytest.fixture
async def nem_server(aiohttp_client):
	return await create_simple_nem_client(aiohttp_client, {
		'TCQKTUUNUOPQGDQIDQT2CCJGQZ4QNAAGBZRV5YJJ': 9988776655
	})


# pylint: disable=invalid-name


def _create_config(blockchain, server):  # pylint: disable=redefined-outer-name
	bridge_address = 'TCYIHED7HZQ3IPBY5WRDPDLV5CCMMOOVSOMSPD6B' if 'nem' == blockchain else 'TDDRDLK5QL2LJPZOF26QFXB24TJ5HGB4NDTF6SI'
	return NetworkConfiguration(blockchain, 'testnet', server.make_url(''), bridge_address, {
		'mosaic_id': 'nem:xem'
	})


async def test_can_load_nem_network_facade(nem_server):  # pylint: disable=redefined-outer-name
	# Act:
	facade = await load_network_facade(_create_config('nem', nem_server))

	# Assert:
	assert isinstance(facade, NemNetworkFacade)
	assert 'testnet' == facade.network.name


async def test_can_load_symbol_network_facade(symbol_server):  # pylint: disable=redefined-outer-name
	# Act:
	facade = await load_network_facade(_create_config('symbol', symbol_server))

	# Assert:
	assert isinstance(facade, SymbolNetworkFacade)
	assert 'testnet' == facade.network.name

	assert facade.is_currency_mosaic_id(0x72C0212E67A08BCE)  # from /network/properties
	assert facade.is_currency_mosaic_id(0xE74B99BA41F4AFEE)  # alias symbol.xym
	assert not facade.is_currency_mosaic_id(0x6BED913FA20223F8)  # mainnet


async def test_cannot_load_unknown_network_facade(symbol_server):  # pylint: disable=redefined-outer-name
	with pytest.raises(ValueError, match='blockchain "foo" is unsupported'):
		await load_network_facade(_create_config('foo', symbol_server))
