import asyncio
import logging
from decimal import Decimal

from bridge.db.WrapRequestDatabase import PayoutDetails, WrapRequestStatus
from bridge.NetworkUtils import TransactionSender, TrySendResult
from bridge.WorkflowUtils import create_conversion_rate_calculator_factory, is_native_to_native_conversion

from .main_impl import main_bootstrapper, print_banner


async def _send_payout(network, request, conversion_function, fee_multiplier):
	logger = logging.getLogger(__name__)

	mosaic_id = network.extract_mosaic_id()
	if not fee_multiplier:
		fee_multiplier = Decimal('1')
	else:
		fee_multiplier *= Decimal(conversion_function(10 ** 12)) / Decimal(10 ** 12)

	sender = TransactionSender(network, fee_multiplier)
	transfer_amount = conversion_function(request.amount)

	max_transfer_amount = int(network.config.extensions.get('max_transfer_amount', 0))
	if max_transfer_amount and transfer_amount > max_transfer_amount:
		error_message = f'gross transfer amount {transfer_amount} exceeds max transfer amount {max_transfer_amount}'
		return TrySendResult(True, None, None, None, error_message)

	logger.info(
		'> issuing %s [%s] tokens (gross) to %s for deposit of %s tokens',
		transfer_amount,
		mosaic_id.formatted,
		request.destination_address,
		request.amount)
	logger.info('  redeeming 1:%.6f', transfer_amount / request.amount)

	await sender.init()
	return await sender.try_send_transfer(request.destination_address, transfer_amount, request.transaction_hash.bytes)


async def send_payouts(conversion_rate_calculator_factory, is_unwrap_mode, database, network, fee_multiplier=None):
	# pylint: disable=too-many-locals
	logger = logging.getLogger(__name__)

	requests_to_send = database.requests_by_status(WrapRequestStatus.UNPROCESSED)
	logger.info('%s requests need to be sent', len(requests_to_send))

	count = 0
	error_count = 0
	skip_count = 0
	for request in requests_to_send:
		conversion_rate_calculator = conversion_rate_calculator_factory.try_create_calculator(request.transaction_height)
		if not conversion_rate_calculator:
			logger.info('  payout skipped due to missing data: %s:%s', request.transaction_hash, request.transaction_subindex)
			skip_count += 1
			continue

		logger.info('  processing payout: %s:%s', request.transaction_hash, request.transaction_subindex)
		conversion_function = conversion_rate_calculator.to_conversion_function(is_unwrap_mode)
		send_result = await _send_payout(network, request, conversion_function, fee_multiplier)
		if send_result.is_error:
			database.mark_payout_failed(request, send_result.error_message)
			logger.info('  payout failed with error: %s', send_result.error_message)
			error_count += 1
		else:
			conversion_rate = conversion_function(1000000)
			payout_details = PayoutDetails(
				send_result.transaction_hash,
				send_result.net_amount,
				send_result.total_fee,
				conversion_rate)
			database.mark_payout_sent(request, payout_details)
			logger.info(
				'  sent transaction with hash: %s %s amount (%s fee deducted) at conversion rate %s',
				payout_details.transaction_hash,
				payout_details.net_amount,
				payout_details.total_fee,
				payout_details.conversion_rate)
			count += 1

	print_banner([
		f'==>      total payouts processed: {count}',
		f'==>        total payouts errored: {error_count}',
		f'==>        total payouts skipped: {skip_count}'
	])


async def main_impl(execution_context, databases, native_facade, wrapped_facade, price_oracle):
	logger = logging.getLogger(__name__)

	fee_multiplier = await price_oracle.conversion_rate(wrapped_facade.config.blockchain, native_facade.config.blockchain)
	fee_multiplier *= Decimal(10 ** native_facade.native_token_precision) / Decimal(10 ** wrapped_facade.native_token_precision)

	conversion_rate_calculator_factory = create_conversion_rate_calculator_factory(
		execution_context,
		databases,
		native_facade,
		wrapped_facade,
		fee_multiplier)

	if execution_context.is_unwrap_mode:
		await send_payouts(conversion_rate_calculator_factory, execution_context.is_unwrap_mode, databases.unwrap_request, native_facade)
	else:
		logger.info(
			'calculated fee_multiplier as %.8f (%s/%s)',
			fee_multiplier,
			wrapped_facade.config.blockchain,
			native_facade.config.blockchain)

		send_payouts_params = [databases.wrap_request, wrapped_facade]
		if not is_native_to_native_conversion(wrapped_facade):
			send_payouts_params.append(fee_multiplier)

		await send_payouts(conversion_rate_calculator_factory, execution_context.is_unwrap_mode, *send_payouts_params)


if '__main__' == __name__:
	asyncio.run(main_bootstrapper('sends wrap or unwrap token payouts', main_impl))
