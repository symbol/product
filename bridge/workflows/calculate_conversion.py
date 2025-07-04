import asyncio
import math

from bridge.db.WrapRequestDatabase import WrapRequestStatus
from bridge.NetworkUtils import TransactionSender

from .main_impl import main_bootstrapper


async def send_wrapped_tokens(network_facade, wrap_request, conversion_rate):
	sender = TransactionSender(network_facade, [int(network_facade.config.extensions['wrapped_mosaic_id'], 16)])

	wrap_token_amount = math.trunc(wrap_request.amount / conversion_rate)
	message = f'issuing {wrap_token_amount} wrapped tokens for deposit of {wrap_request.amount} native tokens'

	await sender.init()
	return await sender.send_transfer(wrap_request.destination_address, wrap_token_amount, message)


async def main_impl(databases, native_network, wrapped_network):
	bridge_balance = await native_network.facade.lookup_account_balance(native_network.bridge_address)
	total_wrapped_amount = databases.wrap_request.total_wrapped_amount()
	conversion_rate = bridge_balance / total_wrapped_amount

	print(f'current bridge balance is {bridge_balance} with {total_wrapped_amount} outstanding wrapped tokens')
	print(f'each wrapped token is worth {conversion_rate:0.4f} native tokens')

	wrap_requests_to_send = databases.wrap_request.requests_by_status(WrapRequestStatus.UNPROCESSED)
	print(f'{len(wrap_requests_to_send)} requests need to be sent')

	for wrap_request in wrap_requests_to_send:
		transaction_hash = await send_wrapped_tokens(wrapped_network.facade, wrap_request, conversion_rate)
		databases.wrap_request.set_request_status(wrap_request, WrapRequestStatus.SENT, transaction_hash)
		print(f'sent transaction with hash: {transaction_hash}')
		break  # temporarily only send a single transaction for easier testing

	wrap_requests_sent = databases.wrap_request.requests_by_status(WrapRequestStatus.SENT)
	print(f'{len(wrap_requests_sent)} requests have been sent')


if '__main__' == __name__:
	asyncio.run(main_bootstrapper('calculate wrap conversion rate', main_impl))
