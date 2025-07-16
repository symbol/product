import asyncio

from bridge.db.WrapRequestDatabase import WrapRequestStatus
from bridge.NetworkUtils import TransactionSender
from bridge.WorkflowUtils import ConversionRateCalculator, extract_mosaic_id

from .main_impl import main_bootstrapper, print_banner


class ConversionRateManager:
	def __init__(self, databases, network, is_unwrap_mode):
		self.databases = databases
		self.network = network
		self.is_unwrap_mode = is_unwrap_mode
		self.mosaic_id = extract_mosaic_id(network.config, network.is_currency_mosaic_id).formatted

	async def create_calculator(self, height):

		historical_native_height = height
		if self.is_unwrap_mode:
			timestamp = self.databases.unwrap_request.lookup_block_timestamp(height)
			historical_native_height = self.databases.wrap_request.lookup_block_height(timestamp)
		else:
			timestamp = self.databases.wrap_request.lookup_block_timestamp(height)

		native_balance = self.databases.balance_change.balance_at(historical_native_height, self.mosaic_id)
		wrapped_balance = self.databases.wrap_request.cumulative_wrapped_amount_at(timestamp)
		unwrapped_balance = self.databases.unwrap_request.cumulative_wrapped_amount_at(timestamp)

		calculator = ConversionRateCalculator(native_balance, wrapped_balance, unwrapped_balance)
		return calculator.to_native_amount if self.is_unwrap_mode else calculator.to_wrapped_amount


async def _send_payout(network, request, conversion_rate_calculator):
	mosaic_id = extract_mosaic_id(network.config, network.is_currency_mosaic_id)
	sender = TransactionSender(network, mosaic_id.id)
	transfer_amount = conversion_rate_calculator(request.amount)

	print(
		f'> issuing {transfer_amount} [{mosaic_id.formatted}] tokens (gross) to {request.destination_address}'
		f' for deposit of {request.amount} tokens')
	print(f'  redeeming 1:{transfer_amount/request.amount:.6f}')

	await sender.init()
	return await sender.try_send_transfer(request.destination_address, transfer_amount)


async def send_payouts(conversion_rate_manager, database, network):
	requests_to_send = database.requests_by_status(WrapRequestStatus.UNPROCESSED)
	print(f'{len(requests_to_send)} requests need to be sent')

	count = 0
	error_count = 0
	for request in requests_to_send:
		conversion_rate_calculator = await conversion_rate_manager.create_calculator(request.transaction_height)
		send_result = await _send_payout(network, request, conversion_rate_calculator)
		if send_result.is_error:
			database.mark_payout_failed(request, send_result.error_message)
			print(f'  payout failed with error: {send_result.error_message}')
			error_count += 1
		else:
			database.mark_payout_sent(request, send_result.transaction_hash, send_result.total_fee)
			print(f'  sent transaction with hash: {send_result.transaction_hash} ({send_result.total_fee} fee deducted)')
			count += 1

	print_banner([
		f'==>      total payouts processed: {count}',
		f'==>        total payouts errored: {error_count}'
	])


async def main_impl(is_unwrap_mode, databases, native_facade, wrapped_facade):
	conversion_rate_manager = ConversionRateManager(databases, native_facade, is_unwrap_mode)
	if is_unwrap_mode:
		await send_payouts(conversion_rate_manager, databases.unwrap_request, native_facade)
	else:
		await send_payouts(conversion_rate_manager, databases.wrap_request, wrapped_facade)


if '__main__' == __name__:
	asyncio.run(main_bootstrapper('sends wrap or unwrap token payouts', main_impl))
