import asyncio
import logging
from decimal import Decimal

from symbollightapi.model.Exceptions import NodeException

from bridge.db.WrapRequestDatabase import PayoutDetails, WrapRequestStatus
from bridge.NetworkUtils import TransactionSender, TrySendResult, is_transient_error
from bridge.WorkflowUtils import create_conversion_rate_calculator_factory, is_native_to_native_conversion, prepare_send

from .main_impl import main_bootstrapper, print_banner


class SendCounts:
	def __init__(self):
		self.sent = 0
		self.errored = 0
		self.skipped = 0


async def _send_payout(sender, network, request, conversion_function, fee_multiplier):
	logger = logging.getLogger(__name__)

	prepare_send_result = prepare_send(network, request, conversion_function, fee_multiplier)
	if prepare_send_result.error_message:
		return TrySendResult(True, None, None, None, prepare_send_result.error_message)

	transfer_amount = prepare_send_result.transfer_amount
	mosaic_id = network.extract_mosaic_id()

	logger.info(
		'> issuing %s [%s] tokens (gross) to %s for deposit of %s tokens',
		transfer_amount,
		mosaic_id.formatted,
		request.destination_address,
		request.amount)
	logger.info('  redeeming 1:%.6f', transfer_amount / request.amount)

	return await sender.try_send_transfer(
		request.destination_address,
		prepare_send_result.fee_multiplier,
		transfer_amount,
		request.transaction_hash.bytes)


async def send_payouts(conversion_rate_calculator_factory, is_unwrap_mode, vault_connector, database, network, fee_multiplier=None):
	# pylint: disable=too-many-locals, too-many-arguments, too-many-positional-arguments
	logger = logging.getLogger(__name__)

	requests_to_send = database.requests_by_status(WrapRequestStatus.UNPROCESSED)
	logger.info('%s requests need to be sent', len(requests_to_send))

	counts = SendCounts()

	def mark_skipped(request, skip_reason):
		logger.info('payout skipped due to %s: %s:%s', skip_reason, request.transaction_hash, request.transaction_subindex)
		counts.skipped += 1

	def mark_permanent_failure(request, error_message):
		database.mark_payout_failed(request, error_message)
		counts.errored += 1

	sender = TransactionSender(network)
	await sender.init(vault_connector)

	for request in requests_to_send:
		conversion_rate_calculator = conversion_rate_calculator_factory.try_create_calculator(request.transaction_height)
		if not conversion_rate_calculator:
			mark_skipped(request, 'missing data')
			continue

		logger.info('processing payout: %s:%s', request.transaction_hash, request.transaction_subindex)
		conversion_function = conversion_rate_calculator.to_conversion_function(is_unwrap_mode)
		try:
			send_result = await _send_payout(sender, network, request, conversion_function, fee_multiplier)
		except NodeException as ex:
			if is_transient_error(ex):
				mark_skipped(request, f'transient failure {ex}')
			else:
				mark_permanent_failure(request, str(ex))

			continue

		if send_result.is_error:
			mark_permanent_failure(request, send_result.error_message)
		else:
			conversion_rate = conversion_function(1000000)
			payout_details = PayoutDetails(
				send_result.transaction_hash,
				send_result.net_amount,
				send_result.total_fee,
				conversion_rate)
			database.mark_payout_sent(request, payout_details)
			counts.sent += 1

	print_banner([
		f'==>      total payouts sent: {counts.sent}',
		f'==>   total payouts errored: {counts.errored}',
		f'==>   total payouts skipped: {counts.skipped}'
	])


async def main_impl(execution_context, databases, native_facade, wrapped_facade, external_services):
	logger = logging.getLogger(__name__)

	fee_multiplier = await external_services.price_oracle.conversion_rate(wrapped_facade.config.blockchain, native_facade.config.blockchain)
	fee_multiplier *= Decimal(10 ** native_facade.native_token_precision) / Decimal(10 ** wrapped_facade.native_token_precision)

	conversion_rate_calculator_factory = create_conversion_rate_calculator_factory(
		execution_context,
		databases,
		native_facade,
		wrapped_facade,
		fee_multiplier)

	send_params_shared_params = [conversion_rate_calculator_factory, execution_context.is_unwrap_mode, external_services.vault_connector]
	if execution_context.is_unwrap_mode:
		await send_payouts(*send_params_shared_params, databases.unwrap_request, native_facade)
	else:
		logger.info(
			'calculated fee_multiplier as %.8f (%s/%s)',
			fee_multiplier,
			wrapped_facade.config.blockchain,
			native_facade.config.blockchain)

		send_payouts_params = [databases.wrap_request, wrapped_facade]
		if not is_native_to_native_conversion(wrapped_facade):
			send_payouts_params.append(fee_multiplier)

		await send_payouts(*send_params_shared_params, *send_payouts_params)


if '__main__' == __name__:
	asyncio.run(main_bootstrapper('sends wrap or unwrap token payouts', main_impl))
