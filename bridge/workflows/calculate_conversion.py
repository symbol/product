import asyncio

from bridge.db.WrapRequestDatabase import WrapRequestStatus

from .main_impl import main_bootstrapper


async def main_impl(databases, network_facade, connector, bridge_address):
	bridge_balance = await network_facade.lookup_account_balance(connector, bridge_address)

	total_wrapped_amount = databases.wrap_request.total_wrapped_amount()

	print(f'current bridge balance is {bridge_balance} with {total_wrapped_amount} outstanding wrapped tokens')
	print(f'each wrapped token is worth {bridge_balance/total_wrapped_amount:0.4f} native tokens')

	wrap_requests_to_send = databases.wrap_request.requests_by_status(WrapRequestStatus.UNPROCESSED)
	print(f'{len(wrap_requests_to_send)} requests need to be sent')


if '__main__' == __name__:
	asyncio.run(main_bootstrapper('calculate wrap conversion rate', main_impl))
