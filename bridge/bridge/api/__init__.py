import asyncio
import configparser
from collections import namedtuple
from decimal import Decimal
from pathlib import Path

from flask import Flask, jsonify, request
from symbolchain.CryptoTypes import Hash256
from symbollightapi.model.Exceptions import NodeException

from ..ConversionRateCalculatorFactory import ConversionRateCalculatorFactory
from ..db.Databases import Databases
from ..models.BridgeConfiguration import parse_bridge_configuration
from ..NetworkFacadeLoader import load_network_facade
from ..NetworkUtils import BalanceTransfer, estimate_balance_transfer_fees
from ..price_oracle.PriceOracleLoader import load_price_oracle
from ..WorkflowUtils import create_conversion_rate_calculator_factory, is_native_to_native_conversion
from .Validators import is_valid_address_string, is_valid_decimal_string, is_valid_hash_string

FilterOptions = namedtuple('FilterOptions', ['address', 'transaction_hash', 'offset', 'limit', 'sort', 'payout_status'])
PrepareOptions = namedtuple('PrepareOptions', ['recipient_address', 'amount'])

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


def _parse_filter_parameters(context, address, transaction_hash, is_unwrap_mode):
	# pylint: disable=too-many-return-statements, too-many-branches
	offset = request.args.get('offset', '0')
	limit = request.args.get('limit', '25')
	sort = request.args.get('sort', '1')
	payout_status = request.args.get('payout_status', None)

	if address:
		if is_valid_address_string(context.native_facade, address):
			address = context.native_facade.make_address(address)

			if is_unwrap_mode:
				address = str(address)  # destination addresses are stored as string
		elif is_valid_address_string(context.wrapped_facade, address):
			address = context.wrapped_facade.make_address(address)

			if not is_unwrap_mode:
				address = str(address)  # destination addresses are stored as string
		else:
			return (None, 'address')

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

	if not is_valid_decimal_string(sort):
		return (None, 'sort')

	sort = int(sort)

	if payout_status:
		if not is_valid_decimal_string(payout_status):
			return (None, 'payout_status')

		payout_status = int(payout_status)

	return (FilterOptions(address, transaction_hash, offset, limit, sort, payout_status), None)


def _make_bad_request_response(parse_failure_identifier):
	return jsonify({'error': f'{parse_failure_identifier} parameter is invalid'}), 400


def _handle_wrap_requests(context, address, transaction_hash, database_name):
	is_unwrap_mode = 'unwrap_request' == database_name
	(filter_options, parse_failure_identifier) = _parse_filter_parameters(context, address, transaction_hash, is_unwrap_mode)
	if parse_failure_identifier:
		return _make_bad_request_response(parse_failure_identifier)

	with Databases(*context.database_params) as databases:
		views = getattr(databases, database_name).find_requests(*filter_options)
		return jsonify([
			{
				'requestTransactionHeight': str(view.request_transaction_height),
				'requestTransactionHash': str(view.request_transaction_hash),
				'requestTransactionSubindex': view.request_transaction_subindex,
				'senderAddress': str(view.sender_address),

				'requestAmount': str(int(view.request_amount)),  # render real db values as integer strings
				'destinationAddress': str(view.destination_address),
				'payoutStatus': view.payout_status,
				'payoutTransactionHash': str(view.payout_transaction_hash) if view.payout_transaction_hash else None,

				'requestTimestamp': view.request_timestamp,

				'payoutTransactionHeight': str(view.payout_transaction_height) if view.payout_transaction_height else None,
				'payoutNetAmount': str(int(view.payout_net_amount)) if view.payout_net_amount else None,
				'payoutTotalFee': str(int(view.payout_total_fee)) if view.payout_total_fee else None,
				'payoutConversionRate': str(int(view.payout_conversion_rate)) if view.payout_conversion_rate else None,

				'payoutTimestamp': view.payout_timestamp,

				'errorMessage': view.error_message
			} for view in views
		])


def _handle_wrap_errors(context, address, transaction_hash, database_name):
	is_unwrap_mode = 'unwrap_request' == database_name
	(filter_options, parse_failure_identifier) = _parse_filter_parameters(context, address, transaction_hash, is_unwrap_mode)
	if parse_failure_identifier:
		return _make_bad_request_response(parse_failure_identifier)

	with Databases(*context.database_params) as databases:
		views = getattr(databases, database_name).find_errors(*([*filter_options][:-1]))  # strip payout_status filter option
		return jsonify([
			{
				'requestTransactionHeight': str(view.request_transaction_height),
				'requestTransactionHash': str(view.request_transaction_hash),
				'requestTransactionSubindex': view.request_transaction_subindex,
				'senderAddress': str(view.sender_address),

				'errorMessage': view.error_message,

				'requestTimestamp': view.request_timestamp
			} for view in views
		])


def _parse_prepare_parameters(network_facade, request_json):
	recipient_address = request_json.get('recipientAddress', None)
	if not is_valid_address_string(network_facade, recipient_address):
		return (None, 'recipientAddress')

	recipient_address = network_facade.make_address(recipient_address)

	amount = request_json.get('amount', None)
	if not is_valid_decimal_string(amount):
		return (None, 'amount')

	amount = int(amount)

	return (PrepareOptions(recipient_address, amount), None)


async def _handle_wrap_prepare(is_unwrap_mode, context, fee_multiplier):  # pylint: disable=too-many-locals
	network_facade = context.native_facade if is_unwrap_mode else context.wrapped_facade

	request_json = request.get_json()
	(prepare_options, parse_failure_identifier) = _parse_prepare_parameters(network_facade, request_json)
	if parse_failure_identifier:
		return _make_bad_request_response(parse_failure_identifier)

	with Databases(*context.database_params) as databases:
		conversion_rate_calculator_factory = create_conversion_rate_calculator_factory(
			is_unwrap_mode,
			databases,
			context.native_facade,
			context.wrapped_facade,
			fee_multiplier)
		calculator = conversion_rate_calculator_factory.create_best_calculator()
		calculator_func = calculator.to_native_amount if is_unwrap_mode else calculator.to_wrapped_amount
		gross_amount = calculator_func(prepare_options.amount)

		if fee_multiplier:
			fee_multiplier *= Decimal(calculator_func(10 ** 12)) / Decimal(10 ** 12)

		balance_transfer = BalanceTransfer(
			network_facade.make_public_key(network_facade.config.extensions['signer_public_key']),
			prepare_options.recipient_address,
			gross_amount,
			None)

		if is_native_to_native_conversion(context.wrapped_facade):
			fee_multiplier = None

		try:
			fee_information = await estimate_balance_transfer_fees(network_facade, balance_transfer, fee_multiplier or Decimal('1'))
		except NodeException as ex:
			return jsonify({'error': str(ex)}), 500

		result = {
			'grossAmount': str(gross_amount),
			'transactionFee': fee_information.transaction.quantize(Decimal('0.0001')),
			'conversionFee': fee_information.conversion.quantize(Decimal('0.0001')),
			'totalFee': str(fee_information.total),
			'netAmount': str(gross_amount - fee_information.total),

			'diagnostics': {
				'height': str(calculator.height),
				'nativeBalance': calculator.native_balance,
				'wrappedBalance': calculator.wrapped_balance,
				'unwrappedBalance': calculator.unwrapped_balance,
			}
		}

		if is_native_to_native_conversion(context.wrapped_facade):
			# clear other diagnostic calculator properties because they're not relevant
			result['diagnostics'] = {'height': str(calculator.height)}

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
	@app.route('/wrap/requests')
	@app.route('/wrap/requests/<address>')
	@app.route('/wrap/requests/hash/<transaction_hash>')
	async def wrap_requests(address=None, transaction_hash=None):  # pylint: disable=unused-variable
		await context.load()

		return _handle_wrap_requests(context, address, transaction_hash, 'wrap_request')

	@app.route('/wrap/errors')
	@app.route('/wrap/errors/<address>')
	@app.route('/wrap/errors/hash/<transaction_hash>')
	async def wrap_errors(address=None, transaction_hash=None):  # pylint: disable=unused-variable
		await context.load()

		return _handle_wrap_errors(context, address, transaction_hash, 'wrap_request')

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
	@app.route('/unwrap/requests')
	@app.route('/unwrap/requests/<address>')
	@app.route('/unwrap/requests/hash/<transaction_hash>')
	async def unwrap_requests(address=None, transaction_hash=None):  # pylint: disable=unused-variable
		await context.load()

		return _handle_wrap_requests(context, address, transaction_hash, 'unwrap_request')

	@app.route('/unwrap/errors')
	@app.route('/unwrap/errors/<address>')
	@app.route('/unwrap/errors/hash/<transaction_hash>')
	async def unwrap_errors(address=None, transaction_hash=None):  # pylint: disable=unused-variable
		await context.load()

		return _handle_wrap_errors(context, address, transaction_hash, 'unwrap_request')

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

	price_oracle = load_price_oracle(config.price_oracle)

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
