import pytest

from bridge.ethereum.EthereumNetworkFacade import EthereumNetworkFacade
from bridge.models.BridgeConfiguration import NetworkConfiguration
from bridge.nem.NemNetworkFacade import NemNetworkFacade
from bridge.NetworkFacadeLoader import load_network_facade
from bridge.symbol.SymbolNetworkFacade import SymbolNetworkFacade

from .test.MockEthereumServer import create_simple_ethereum_client
from .test.MockNemServer import create_simple_nem_client
from .test.MockSymbolServer import create_simple_symbol_client


@pytest.fixture
async def ethereum_server(aiohttp_client):
	return await create_simple_ethereum_client(aiohttp_client)


@pytest.fixture
async def nem_server(aiohttp_client):
	return await create_simple_nem_client(aiohttp_client, {
		'TCQKTUUNUOPQGDQIDQT2CCJGQZ4QNAAGBZRV5YJJ': 9988776655
	})


@pytest.fixture
async def symbol_server(aiohttp_client):
	return await create_simple_symbol_client(aiohttp_client, '0x72C0\'212E\'67A0\'8BCE')


# pylint: disable=invalid-name


def _create_config(blockchain, server):  # pylint: disable=redefined-outer-name
	blockchain_tuple_map = {
		'ethereum': ('0x67b1d87101671b127f5f8714789C7192f7ad340e', '0x0D8775F648430679A709E98d2b0Cb6250d2887EF'),
		'nem': ('TCYIHED7HZQ3IPBY5WRDPDLV5CCMMOOVSOMSPD6B', 'foo:bar'),
		'symbol': ('TDDRDLK5QL2LJPZOF26QFXB24TJ5HGB4NDTF6SI', 'foo:bar')
	}

	(bridge_address, mosaic_id) = blockchain_tuple_map.get(blockchain, blockchain_tuple_map['symbol'])
	return NetworkConfiguration(blockchain, 'testnet', server.make_url(''), bridge_address, mosaic_id, {
		'chain_id': '1234',
		'signer_private_key': 'CDAAEF4C1EC606C7E8B72472803D84EF24AF8150D338C0B1A150812E4BC41DAF'
	})


async def test_can_load_nem_network_facade(nem_server):  # pylint: disable=redefined-outer-name
	# Act:
	facade = await load_network_facade(_create_config('nem', nem_server))

	# Assert:
	assert isinstance(facade, NemNetworkFacade)
	assert 'testnet' == facade.network.name

	assert 1 == len(facade.mosaic_id_to_fee_information_map)


async def test_can_load_symbol_network_facade(symbol_server):  # pylint: disable=redefined-outer-name
	# Act:
	facade = await load_network_facade(_create_config('symbol', symbol_server))

	# Assert:
	assert isinstance(facade, SymbolNetworkFacade)
	assert 'testnet' == facade.network.name

	assert facade.is_currency_mosaic_id(0x72C0212E67A08BCE)  # from /network/properties
	assert facade.is_currency_mosaic_id(0xE74B99BA41F4AFEE)  # alias symbol.xym
	assert not facade.is_currency_mosaic_id(0x6BED913FA20223F8)  # mainnet


async def test_can_load_ethereum_network_facade(ethereum_server):  # pylint: disable=redefined-outer-name
	# Act:
	facade = await load_network_facade(_create_config('ethereum', ethereum_server))

	# Assert:
	assert isinstance(facade, EthereumNetworkFacade)
	assert 'testnet' == facade.network.name

	assert 1 == len(facade.address_to_nonce_map)


async def test_cannot_load_unknown_network_facade(symbol_server):  # pylint: disable=redefined-outer-name
	with pytest.raises(ValueError, match='blockchain "foo" is unsupported'):
		await load_network_facade(_create_config('foo', symbol_server))
