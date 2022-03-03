import asyncio

from symbolchain.CryptoTypes import PrivateKey
from symbolchain.nem.KeyPair import KeyPair as NemKeyPair
from symbolchain.symbol.KeyPair import KeyPair as SymbolKeyPair

from puller.models.OptinRequest import OptinRequestError


async def check_destination_availability(request, nem_client, symbol_client):
	"""Checks if the destination public key is in use."""

	public_key = request.destination_public_key
	nem_network = await nem_client.node_network()
	symbol_network = await symbol_client.node_network()

	nem_address_from_public = nem_network.public_key_to_address(public_key)
	nem_address_from_private = nem_network.public_key_to_address(NemKeyPair(PrivateKey(public_key.bytes)).public_key)
	symbol_address_from_private = symbol_network.public_key_to_address(SymbolKeyPair(PrivateKey(public_key.bytes)).public_key)

	results = await asyncio.gather(
		nem_client.is_known_address(nem_address_from_public),
		nem_client.is_known_address(nem_address_from_private),
		symbol_client.is_known_address(symbol_address_from_private))

	for i, result in enumerate(results):
		if result:
			return OptinRequestError(request.address, request.transaction_height, request.transaction_hash, [
				'destination is a NEM public key',
				'destination is a NEM private key',
				'destination is a Symbol private key',
			][i])

	return request
