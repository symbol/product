import asyncio
from decimal import Decimal

from bridge.db.WrapRequestDatabase import PayoutDetails, WrapRequestStatus
from bridge.NetworkUtils import TransactionSender
from bridge.WorkflowUtils import create_conversion_rate_calculator_factory, is_native_to_native_conversion

from .main_impl import main_bootstrapper, print_banner


async def _send_payout(network, request, conversion_rate_calculator, fee_multiplier):
	mosaic_id = network.extract_mosaic_id()
	if not fee_multiplier:
		fee_multiplier = Decimal('1')
	else:
		fee_multiplier *= Decimal(conversion_rate_calculator(10 ** 12)) / Decimal(10 ** 12)

	sender = TransactionSender(network, fee_multiplier)
	transfer_amount = conversion_rate_calculator(request.amount)

	print(
		f'> issuing {transfer_amount} [{mosaic_id.formatted}] tokens (gross) to {request.destination_address}'
		f' for deposit of {request.amount} tokens')
	print(f'  redeeming 1:{transfer_amount/request.amount:.6f}')

	await sender.init()
	return await sender.try_send_transfer(request.destination_address, transfer_amount)


async def send_payouts(conversion_rate_calculator_factory, database, network, fee_multiplier=None):
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
		send_result = await _send_payout(network, request, conversion_rate_calculator, fee_multiplier)
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


async def main_impl(is_unwrap_mode, databases, native_facade, wrapped_facade, price_oracle):
	fee_multiplier = await price_oracle.conversion_rate(wrapped_facade.config.blockchain, native_facade.config.blockchain)
	fee_multiplier *= Decimal(10 ** native_facade.native_token_precision) / Decimal(10 ** wrapped_facade.native_token_precision)

	create_calculator_factory = create_conversion_rate_calculator_factory
	conversion_rate_calculator_factory = create_calculator_factory(is_unwrap_mode, databases, native_facade, wrapped_facade, fee_multiplier)

	if is_unwrap_mode:
		await send_payouts(conversion_rate_calculator_factory, databases.unwrap_request, native_facade)
	else:
		print(f'calculated fee_multiplier as {fee_multiplier:0.4f} ({wrapped_facade.config.blockchain}/{native_facade.config.blockchain})')

		send_payouts_params = [databases.wrap_request, wrapped_facade]
		if not is_native_to_native_conversion(wrapped_facade):
			send_payouts_params.append(fee_multiplier)

		await send_payouts(conversion_rate_calculator_factory, *send_payouts_params)


if '__main__' == __name__:
	asyncio.run(main_bootstrapper('sends wrap or unwrap token payouts', main_impl))
