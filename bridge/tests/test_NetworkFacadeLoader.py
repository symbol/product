import pytest

from bridge.models.BridgeConfiguration import NetworkConfiguration
from bridge.nem.NemNetworkFacade import NemNetworkFacade
from bridge.NetworkFacadeLoader import load_network_facade
from bridge.symbol.SymbolNetworkFacade import SymbolNetworkFacade

from .test.PytestUtils import create_symbol_client_with_network_properties


@pytest.fixture
async def server(aiohttp_client):
	return await create_symbol_client_with_network_properties(aiohttp_client, '0x72C0\'212E\'67A0\'8BCE')


# pylint: disable=invalid-name


async def test_can_load_nem_network_facade(server):  # pylint: disable=redefined-outer-name
	# Act:
	facade = await load_network_facade(NetworkConfiguration('nem', 'testnet', server.make_url(''), ''))

	# Assert:
	assert isinstance(facade, NemNetworkFacade)
	assert 'testnet' == facade.network.name


async def test_can_load_symbol_network_facade(server):  # pylint: disable=redefined-outer-name
	# Act:
	facade = await load_network_facade(NetworkConfiguration('symbol', 'testnet', server.make_url(''), ''))

	# Assert:
	assert isinstance(facade, SymbolNetworkFacade)
	assert 'testnet' == facade.network.name

	assert facade.is_currency_mosaic_id(0x72C0212E67A08BCE)  # from /network/properties
	assert facade.is_currency_mosaic_id(0xE74B99BA41F4AFEE)  # alias symbol.xym
	assert not facade.is_currency_mosaic_id(0x6BED913FA20223F8)  # mainnet


async def test_cannot_load_unknown_network_facade(server):  # pylint: disable=redefined-outer-name
	with pytest.raises(ValueError, match='blockchain "foo" is unsupported'):
		await load_network_facade(NetworkConfiguration('foo', 'testnet', server.make_url(''), ''))
