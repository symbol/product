import asyncio

from symbolchain.CryptoTypes import PublicKey
from symbolchain.nem.Network import Address as NemAddress
from symbolchain.nem.Network import Network as NemNetwork
from symbolchain.symbol.Network import Address as SymbolAddress
from symbolchain.symbol.Network import Network as SymbolNetwork

from puller.processors.AccountChecker import check_destination_availability

from ..test.OptinRequestTestUtils import PUBLIC_KEYS, make_request


class MockNemClient:
	@staticmethod
	async def node_network():
		await asyncio.sleep(0.01)
		return NemNetwork.TESTNET

	@staticmethod
	async def is_known_address(address):
		await asyncio.sleep(0.01)
		return address in [
			NemAddress('TCBSSUTLYGPMFWWSTF25JNXUH2PTG5CZR2V4VGGA'),  # PUBLIC_KEYS[0] as NEM public key
			NemAddress('TBCBZIXMU2KWITPYUQSR5HN2YE2OPJOIGTPJWOHW')  # PUBLIC_KEYS[1] as NEM private key
		]


class MockSymbolClient:
	@staticmethod
	async def node_network():
		await asyncio.sleep(0.01)
		return SymbolNetwork.TESTNET

	@staticmethod
	async def is_known_address(address):
		await asyncio.sleep(0.01)
		return address in [
			SymbolAddress('TDJUZBOUALJJBV4AOR5BS42JWJD4B2MF3HD6GUI')  # PUBLIC_KEYS[2] as NEM private key
		]


# pylint: disable=invalid-name, unused-argument


async def _run_test(destination_public_key, expected_error_message):
	# Arrange:
	nem_client = MockNemClient()
	symbol_client = MockSymbolClient()
	request = make_request(1, {'type': 100, 'destination': destination_public_key})

	# Act:
	result = await check_destination_availability(request, nem_client, symbol_client)

	# Assert:
	if not expected_error_message:
		assert request == result
	else:
		assert result.is_error
		assert request.address == result.address
		assert request.optin_transaction_height == result.optin_transaction_height
		assert request.optin_transaction_hash == result.optin_transaction_hash
		assert expected_error_message == result.message


async def test_nem_public_key_destination_not_available(event_loop):
	await _run_test(PublicKey(PUBLIC_KEYS[0]), 'destination is a NEM public key')


async def test_nem_private_key_destination_not_available(event_loop):
	await _run_test(PublicKey(PUBLIC_KEYS[1]), 'destination is a NEM private key')


async def test_symbol_private_key_destination_not_available(event_loop):
	await _run_test(PublicKey(PUBLIC_KEYS[2]), 'destination is a Symbol private key')


async def test_other_destination_available(event_loop):
	await _run_test(PublicKey(PUBLIC_KEYS[3]), None)
