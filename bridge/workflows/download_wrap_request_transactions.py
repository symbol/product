import argparse
import asyncio
import logging

from symbollightapi.connector.ConnectorExtensions import get_incoming_transactions_from

from bridge.db.Databases import Databases
from bridge.models.BridgeConfiguration import parse_bridge_configuration
from bridge.NetworkFacadeLoader import load_network_facade


def parse_args():
	parser = argparse.ArgumentParser(description='download wrap requests')
	parser.add_argument('--config', help='wrap configuration file', required=True)
	return parser.parse_args()


async def main():
	args = parse_args()
	config = parse_bridge_configuration(args.config)
	logging.basicConfig(filename=config.machine.log_filename, level=logging.DEBUG)

	network_facade = await load_network_facade(config.native_network)
	connector = network_facade.create_connector(config.native_network.endpoint)

	finalized_chain_height = await connector.finalized_chain_height()
	end_height = finalized_chain_height + 1

	bridge_address = network_facade.make_address(config.native_network.bridge_address)
	with Databases(config.machine.database_directory, network_facade) as databases:
		databases.wrap_request.create_tables()

		database_height = databases.wrap_request.max_processed_height()
		start_height = database_height + 1

		print(f'searching address {bridge_address} for deposits in range [{start_height}, {end_height})...')

		count = 0
		error_count = 0
		async for transaction in get_incoming_transactions_from(connector, bridge_address, start_height):
			for result in network_facade.extract_wrap_request_from_transaction(transaction):
				if result.is_error:
					databases.wrap_request.add_error(result.error)
					error_count += 1
				else:
					databases.wrap_request.add_request(result.request)

				count += 1

		print('*** *** ***')
		print(f'==> last processed transaction height: {databases.wrap_request.max_processed_height()}')
		print(f'==>      total transactions processed: {count}')
		print(f'==>        total transactions errored: {error_count}')


if '__main__' == __name__:
	asyncio.run(main())
