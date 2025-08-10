import configparser
from pathlib import Path

from flask import Flask, jsonify, request
from symbolchain.CryptoTypes import Hash256

from ..db.Databases import Databases
from ..models.BridgeConfiguration import parse_bridge_configuration
from ..NetworkFacadeLoader import load_network_facade


def _network_config_to_dict(config):
	return {
		'blockchain': config.blockchain,
		'network': config.network,
		'bridgeAddress': config.bridge_address,
		'tokenId': config.mosaic_id
	}


def _handle_wrap_requests(address, transaction_hash, database_params, database_name):
	offset = request.args.get('offset', 0)
	limit = request.args.get('limit', 25)

	with Databases(*database_params) as databases:
		views = getattr(databases, database_name).find_requests(
			address,
			Hash256(transaction_hash) if transaction_hash else None,
			offset,
			limit)
		return jsonify([
			{
				'requestTransactionHeight': view.request_transaction_height,
				'requestTransactionHash': str(view.request_transaction_hash),
				'requestTransactionSubindex': view.request_transaction_subindex,
				'senderAddress': str(view.sender_address),

				'requestAmount': view.request_amount,
				'destinationAddress': str(view.destination_address),
				'payoutStatus': view.payout_status,
				'payoutTransactionHash': str(view.payout_transaction_hash),

				'requestTimestamp': view.request_timestamp,

				'payoutTransactionHeight': view.payout_transaction_height,
				'payoutNetAmount': view.payout_net_amount,
				'payoutTotalFee': view.payout_total_fee,
				'payoutConversionRate': view.payout_conversion_rate,

				'payoutTimestamp': view.payout_timestamp
			} for view in views
		])


def _handle_wrap_errors(address, transaction_hash, database_params, database_name):
	offset = request.args.get('offset', 0)
	limit = request.args.get('limit', 25)

	with Databases(*database_params) as databases:
		views = getattr(databases, database_name).find_errors(
			address,
			Hash256(transaction_hash) if transaction_hash else None,
			offset,
			limit)
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


async def create_app():
	app = Flask(__name__)
	app.config.from_envvar('BRIDGE_API_SETTINGS')

	config_path = Path(app.config.get('CONFIG_PATH'))

	config = parse_bridge_configuration(config_path)
	native_facade = await load_network_facade(config.native_network)
	wrapped_facade = await load_network_facade(config.wrapped_network)

	database_params = [config.machine.database_directory, native_facade, wrapped_facade, True]

	@app.route('/')
	def root():  # pylint: disable=unused-variable
		return jsonify({
			'native_network': _network_config_to_dict(config.native_network),
			'wrapped_network': _network_config_to_dict(config.wrapped_network)
		})

	@app.route('/wrap/requests/<address>')
	@app.route('/wrap/requests/<address>/<transaction_hash>')
	def wrap_requests(address, transaction_hash=None):  # pylint: disable=unused-variable
		return _handle_wrap_requests(native_facade.make_address(address), transaction_hash, database_params, 'wrap_request')

	@app.route('/unwrap/requests/<address>')
	@app.route('/unwrap/requests/<address>/<transaction_hash>')
	def unwrap_requests(address, transaction_hash=None):  # pylint: disable=unused-variable
		return _handle_wrap_requests(wrapped_facade.make_address(address), transaction_hash, database_params, 'unwrap_request')

	@app.route('/wrap/errors/<address>')
	@app.route('/wrap/errors/<address>/<transaction_hash>')
	def wrap_errors(address, transaction_hash=None):  # pylint: disable=unused-variable
		return _handle_wrap_errors(native_facade.make_address(address), transaction_hash, database_params, 'wrap_request')

	@app.route('/unwrap/errors/<address>')
	@app.route('/unwrap/errors/<address>/<transaction_hash>')
	def unwrap_errors(address, transaction_hash=None):  # pylint: disable=unused-variable
		return _handle_wrap_errors(wrapped_facade.make_address(address), transaction_hash, database_params, 'unwrap_request')

	return app
