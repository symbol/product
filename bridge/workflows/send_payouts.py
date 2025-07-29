import asyncio

from bridge.ConversionRateCalculatorFactory import ConversionRateCalculatorFactory
from bridge.db.WrapRequestDatabase import PayoutDetails, WrapRequestStatus
from bridge.NetworkUtils import TransactionSender
from bridge.WorkflowUtils import extract_mosaic_id

from .main_impl import main_bootstrapper, print_banner


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


async def send_payouts(conversion_rate_calculator_factory, database, network):
	requests_to_send = database.requests_by_status(WrapRequestStatus.UNPROCESSED)
	print(f'{len(requests_to_send)} requests need to be sent')

	count = 0
	error_count = 0
	skip_count = 0
	for request in requests_to_send:
		conversion_rate_calculator = conversion_rate_calculator_factory.try_create_calculator(request.transaction_height)
		if not conversion_rate_calculator:
			print(f'  payout skipped due to missing data: {request.transaction_hash}:{request.transaction_subindex}')
			skip_count += 1
			continue

		print(f'  processing payout: {request.transaction_hash}:{request. transaction_subindex}')
		send_result = await _send_payout(network, request, conversion_rate_calculator)
		if send_result.is_error:
			database.mark_payout_failed(request, send_result.error_message)
			print(f'  payout failed with error: {send_result.error_message}')
			error_count += 1
		else:
			conversion_rate = conversion_rate_calculator(1000000)
			payout_details = PayoutDetails(
				send_result.transaction_hash,
				send_result.net_amount,
				send_result.total_fee,
				conversion_rate)
			database.mark_payout_sent(request, payout_details)
			print(
				f'  sent transaction with hash: {payout_details.transaction_hash}'
				f' {payout_details.net_amount} amount ({payout_details.total_fee} fee deducted)'
				f' at conversion rate {payout_details.conversion_rate}')
			count += 1

	print_banner([
		f'==>      total payouts processed: {count}',
		f'==>        total payouts errored: {error_count}',
		f'==>        total payouts skipped: {skip_count}'
	])


async def main_impl(is_unwrap_mode, databases, native_facade, wrapped_facade):
	native_mosaic_id = extract_mosaic_id(native_facade.config, native_facade.is_currency_mosaic_id)
	conversion_rate_calculator_factory = ConversionRateCalculatorFactory(databases, native_mosaic_id.formatted, is_unwrap_mode)
	if is_unwrap_mode:
		await send_payouts(conversion_rate_calculator_factory, databases.unwrap_request, native_facade)
	else:
		await send_payouts(conversion_rate_calculator_factory, databases.wrap_request, wrapped_facade)


if '__main__' == __name__:
	asyncio.run(main_bootstrapper('sends wrap or unwrap token payouts', main_impl))
