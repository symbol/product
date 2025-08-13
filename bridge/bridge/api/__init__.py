import asyncio
import configparser
from collections import namedtuple
from decimal import Decimal
from pathlib import Path

from flask import Flask, jsonify, request
from symbolchain.CryptoTypes import Hash256

from ..CoinGeckoConnector import CoinGeckoConnector
from ..ConversionRateCalculatorFactory import ConversionRateCalculatorFactory
from ..db.Databases import Databases
from ..models.BridgeConfiguration import parse_bridge_configuration
from ..NetworkFacadeLoader import load_network_facade
from ..NetworkUtils import BalanceTransfer, estimate_balance_transfer_fees
from ..WorkflowUtils import create_conversion_rate_calculator_factory, is_native_to_native_conversion
from .Validators import is_valid_address_string, is_valid_decimal_string, is_valid_hash_string

FilterOptions = namedtuple('FilterOptions', ['address', 'transaction_hash', 'offset', 'limit'])

# region handler implementations


def _network_config_to_dict(config):
	return {
		'blockchain': config.blockchain,
		'network': config.network,
		'bridgeAddress': config.bridge_address,
		'tokenId': config.mosaic_id,
		'defaultNodeUrl': config.endpoint,
		'explorerUrl': config.extensions['explorer_endpoint']
	}


def _parse_filter_parameters(network_facade, address, transaction_hash):
	offset = request.args.get('offset', '0')
	limit = request.args.get('limit', '25')

	if not is_valid_address_string(network_facade, address):
		return (None, 'address')

	address = network_facade.make_address(address)

	if transaction_hash:
		if not is_valid_hash_string(transaction_hash):
			return (None, 'transaction_hash')

		transaction_hash = Hash256(transaction_hash)

	if not is_valid_decimal_string(offset):
		return (None, 'offset')

	offset = int(offset)

	if not is_valid_decimal_string(limit):
		return (None, 'limit')

	limit = int(limit)

	return (FilterOptions(address, transaction_hash, offset, limit), None)


def _make_bad_request_response(parse_failure_identifier):
	return jsonify({'error': f'{parse_failure_identifier} parameter is invalid'}), 400


def _handle_wrap_requests(network_facade, address, transaction_hash, database_params, database_name):
	(filter_options, parse_failure_identifier) = _parse_filter_parameters(network_facade, address, transaction_hash)
	if parse_failure_identifier:
		return _make_bad_request_response(parse_failure_identifier)

	with Databases(*database_params) as databases:
		views = getattr(databases, database_name).find_requests(*filter_options)
		return jsonify([
			{
				'requestTransactionHeight': view.request_transaction_height,
				'requestTransactionHash': str(view.request_transaction_hash),
				'requestTransactionSubindex': view.request_transaction_subindex,
				'senderAddress': str(view.sender_address),

				'requestAmount': view.request_amount,
				'destinationAddress': str(view.destination_address),
				'payoutStatus': view.payout_status,
				'payoutTransactionHash': str(view.payout_transaction_hash) if view.payout_transaction_hash else None,

				'requestTimestamp': view.request_timestamp,

				'payoutTransactionHeight': view.payout_transaction_height,
				'payoutNetAmount': view.payout_net_amount,
				'payoutTotalFee': view.payout_total_fee,
				'payoutConversionRate': view.payout_conversion_rate,

				'payoutTimestamp': view.payout_timestamp
			} for view in views
		])


def _handle_wrap_errors(network_facade, address, transaction_hash, database_params, database_name):
	(filter_options, parse_failure_identifier) = _parse_filter_parameters(network_facade, address, transaction_hash)
	if parse_failure_identifier:
		return _make_bad_request_response(parse_failure_identifier)

	with Databases(*database_params) as databases:
		views = getattr(databases, database_name).find_errors(*filter_options)
		return jsonify([
			{
				'requestTransactionHeight': view.request_transaction_height,
				'requestTransactionHash': str(view.request_transaction_hash),
				'requestTransactionSubindex': view.request_transaction_subindex,
				'senderAddress': str(view.sender_address),

				'errorMessage': view.error_message,

				'requestTimestamp': view.request_timestamp
			} for view in views
		])


async def _handle_wrap_prepare(is_unwrap_mode, context, fee_multiplier):
	request_json = request.get_json()

	request_amount = request_json.get('amount', None)
	if not is_valid_decimal_string(request_amount):
		return _make_bad_request_response('amount')

	request_amount = int(request_amount)

	with Databases(*context.database_params) as databases:
		conversion_rate_calculator_factory = create_conversion_rate_calculator_factory(
			is_unwrap_mode,
			databases,
			context.native_facade,
			context.wrapped_facade,
			fee_multiplier)
		calculator = conversion_rate_calculator_factory.create_best_calculator()
		calculator_func = calculator.to_native_amount if is_unwrap_mode else calculator.to_wrapped_amount
		gross_amount = calculator_func(request_amount)

		if fee_multiplier:
			fee_multiplier *= Decimal(calculator_func(10 ** 12)) / Decimal(10 ** 12)

		network_facade = context.native_facade if is_unwrap_mode else context.wrapped_facade
		balance_transfer = BalanceTransfer(
			network_facade.make_public_key(network_facade.config.extensions['signer_public_key']),
			network_facade.bridge_address,
			gross_amount,
			None)

		if is_native_to_native_conversion(context.wrapped_facade):
			fee_multiplier = None

		fee_information = await estimate_balance_transfer_fees(network_facade, balance_transfer, fee_multiplier or Decimal('1'))

		result = {
			'grossAmount': gross_amount,
			'transactionFee': fee_information.transaction.quantize(Decimal('0.0001')),
			'conversionFee': fee_information.conversion.quantize(Decimal('0.0001')),
			'totalFee': fee_information.total,
			'netAmount': gross_amount - fee_information.total,

			'diagnostics': {
				'height': calculator.height,
				'nativeBalance': calculator.native_balance,
				'wrappedBalance': calculator.wrapped_balance,
				'unwrappedBalance': calculator.unwrapped_balance,
			}
		}

		if is_native_to_native_conversion(context.wrapped_facade):
			# clear other diagnostic calculator properties because they're not relevant
			result['diagnostics'] = {'height': calculator.height}

		return jsonify(result)

# endregion


# region BridgeContext

class BridgeContext:
	def __init__(self, config):
		self._config = config
		self._semaphore = asyncio.Semaphore(1)
		self._is_loaded = False

		self.native_facade = None
		self.wrapped_facade = None
		self.database_params = None
		self.native_mosaic_id = None

	async def load(self):
		if not self._is_loaded:
			async with self._semaphore:
				if not self._is_loaded:
					await self._load()

	async def _load(self):
		self.native_facade = await load_network_facade(self._config.native_network)
		self.wrapped_facade = await load_network_facade(self._config.wrapped_network)
		self.database_params = [self._config.machine.database_directory, self.native_facade, self.wrapped_facade, True]
		self.native_mosaic_id = self.native_facade.extract_mosaic_id()

		self._is_loaded = True

# endregion


def add_wrap_routes(app, context, price_oracle):
	@app.route('/wrap/requests/<address>')
	@app.route('/wrap/requests/<address>/<transaction_hash>')
	async def wrap_requests(address, transaction_hash=None):  # pylint: disable=unused-variable
		await context.load()

		return _handle_wrap_requests(context.native_facade, address, transaction_hash, context.database_params, 'wrap_request')

	@app.route('/wrap/errors/<address>')
	@app.route('/wrap/errors/<address>/<transaction_hash>')
	async def wrap_errors(address, transaction_hash=None):  # pylint: disable=unused-variable
		await context.load()

		return _handle_wrap_errors(context.native_facade, address, transaction_hash, context.database_params, 'wrap_request')

	@app.route('/wrap/prepare', methods=['POST'])
	async def wrap_prepare():
		await context.load()

		fee_multiplier = await price_oracle.conversion_rate(
			context.wrapped_facade.config.blockchain,
			context.native_facade.config.blockchain)
		fee_multiplier *= Decimal(10 ** context.native_facade.native_token_precision)
		fee_multiplier /= Decimal(10 ** context.wrapped_facade.native_token_precision)
		return await _handle_wrap_prepare(False, context, fee_multiplier)


def add_unwrap_routes(app, context):
	@app.route('/unwrap/requests/<address>')
	@app.route('/unwrap/requests/<address>/<transaction_hash>')
	async def unwrap_requests(address, transaction_hash=None):  # pylint: disable=unused-variable
		await context.load()

		return _handle_wrap_requests(context.wrapped_facade, address, transaction_hash, context.database_params, 'unwrap_request')

	@app.route('/unwrap/errors/<address>')
	@app.route('/unwrap/errors/<address>/<transaction_hash>')
	async def unwrap_errors(address, transaction_hash=None):  # pylint: disable=unused-variable
		await context.load()

		return _handle_wrap_errors(context.wrapped_facade, address, transaction_hash, context.database_params, 'unwrap_request')

	@app.route('/unwrap/prepare', methods=['POST'])
	async def unwrap_prepare():
		await context.load()

		return await _handle_wrap_prepare(True, context, None)


def create_app():
	app = Flask(__name__)
	app.config.from_envvar('BRIDGE_API_SETTINGS')

	config_path = Path(app.config.get('CONFIG_PATH'))
	config = parse_bridge_configuration(config_path)
	context = BridgeContext(config)

	price_oracle = CoinGeckoConnector(config.price_oracle.url)

	@app.route('/')
	def root():  # pylint: disable=unused-variable
		return jsonify({
			'nativeNetwork': _network_config_to_dict(config.native_network),
			'wrappedNetwork': _network_config_to_dict(config.wrapped_network),
			'enabled': True
		})

	add_wrap_routes(app, context, price_oracle)
	if config.wrapped_network.mosaic_id:  # not native to native conversion
		add_unwrap_routes(app, context)

	return app
