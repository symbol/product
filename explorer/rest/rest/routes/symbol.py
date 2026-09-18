import configparser
from pathlib import Path

from common.symbol.NativeMosaic import create_native_mosaic_info
from common.symbol.NodeConfiguration import SymbolNodeConfiguration
from common.symbol.ReceiptTypes import RECEIPT_GROUP_LABELS, RECEIPT_TYPE_GROUPS, RECEIPT_TYPE_LABELS
from flask import abort, jsonify, request
from psycopg2 import Error as PsycopgError
from symbolchain.symbol.Network import Address, Network
from zenlog import log

from rest.db.SymbolDatabase import ReceiptQuery, SortOrder, SymbolDatabase, SymbolDataUnavailable
from rest.facade.SymbolRestFacade import SymbolRestFacade
from rest.model.common import DatabaseConfig

BLOCK_LIST_QUERY_PARAMETERS = frozenset(['limit', 'fromHeight', 'sort'])
RECEIPT_QUERY_PARAMETERS = frozenset([
	'limit', 'offset', 'group', 'receiptType', 'includedReceiptTypes', 'targetAddress', 'senderAddress'
])
BLOCK_RECEIPT_QUERY_PARAMETERS = frozenset(['limit', 'offset'])
RECEIPT_MAX_OFFSET = 100000
XYM_DIVISIBILITY = 6


def setup_symbol_facade(app):
	native_mosaic_info = _create_native_mosaic_info(app.config)
	config = configparser.ConfigParser()
	db_path = Path(app.config.get('DATABASE_CONFIG_FILEPATH'))

	log.info(f'loading database config from {db_path}')

	config.read(db_path)

	symbol_db_config = config['symbol_db']
	db_params = DatabaseConfig(
		symbol_db_config['database'],
		symbol_db_config['user'],
		symbol_db_config['password'],
		symbol_db_config['host'],
		symbol_db_config['port']
	)
	node_config = SymbolNodeConfiguration.from_app_config(app.config)
	node_config.assert_request_allowed(node_config.base_url)

	symbol_db = SymbolDatabase(db_params, native_mosaic_info)
	app.extensions['symbol_database'] = symbol_db
	return SymbolRestFacade(symbol_db, node_config, native_mosaic_info)


def _create_native_mosaic_info(app_config):
	try:
		mosaic_id = app_config['SYMBOL_NATIVE_MOSAIC_ID']
	except KeyError as error:
		raise ValueError(f'{error.args[0]} is required') from error

	return create_native_mosaic_info(mosaic_id, XYM_DIVISIBILITY)


def setup_symbol_routes(app, symbol_api_facade):
	def _run_symbol_query(query_fn, error_log):
		try:
			return None, query_fn()
		except (PsycopgError, SymbolDataUnavailable):
			log.error(error_log)
			return _service_unavailable('Symbol backend data is unavailable'), None

	@app.route('/api/symbol/health')
	def api_get_symbol_health():
		return jsonify(symbol_api_facade.get_health())

	@app.route('/api/symbol/blocks')
	def api_get_symbol_blocks():
		_validate_allowed_query_parameters(BLOCK_LIST_QUERY_PARAMETERS)

		try:
			limit = int(request.args.get('limit', 10))
			from_height_arg = request.args.get('fromHeight')
			from_height = int(from_height_arg) if from_height_arg is not None else None
			sort = request.args.get('sort', 'DESC').upper()
			if limit < 1 or limit > 100:
				raise ValueError('Limit must be between 1 and 100')
			if from_height is not None and from_height < 1:
				raise ValueError('fromHeight must be greater than or equal to 1')
			if sort not in ['ASC', 'DESC']:
				raise ValueError('Sort must be either ASC or DESC')
		except ValueError as error:
			abort(400, error)

		error, result = _run_symbol_query(
			lambda: symbol_api_facade.get_blocks(from_height, limit, SortOrder(sort)),
			'Failed to get Symbol blocks')
		if error:
			return error

		return jsonify(result)

	@app.route('/api/symbol/block/<height>')
	def api_get_symbol_block_by_height(height):
		try:
			height = _parse_block_height(height)
		except ValueError as error:
			abort(400, error)

		error, result = _run_symbol_query(
			lambda: symbol_api_facade.get_block(height),
			'Failed to get Symbol block')
		if error:
			return error

		if result is None:
			abort(404)

		return jsonify(result)

	@app.route('/api/symbol/receipts')
	def api_get_symbol_receipts():
		try:
			_validate_allowed_query_parameters(RECEIPT_QUERY_PARAMETERS)
			query = _parse_receipt_query()
		except ValueError as error:
			abort(400, error)

		error, result = _run_symbol_query(
			lambda: symbol_api_facade.get_receipts(query),
			'Failed to get Symbol receipts')
		if error:
			return error

		return jsonify(result)

	@app.route('/api/symbol/block/<height>/receipts')
	def api_get_symbol_block_receipts(height):
		try:
			height = _parse_block_height(height)
			_validate_allowed_query_parameters(BLOCK_RECEIPT_QUERY_PARAMETERS)
			query = _parse_receipt_query(height)
		except ValueError as error:
			abort(400, error)

		error, result = _run_symbol_query(
			lambda: symbol_api_facade.get_receipts(query),
			'Failed to get Symbol block receipts')
		if error:
			return error

		if result is None:
			abort(404)

		return jsonify(result)


def _validate_allowed_query_parameters(allowed_parameters):
	unsupported_parameters = sorted(set(request.args.keys()) - allowed_parameters)
	if unsupported_parameters:
		abort(400, f'Unsupported query parameter: {unsupported_parameters[0]}')


def _parse_block_height(raw_height):
	height = int(raw_height)
	if height < 1:
		raise ValueError('Height must be greater than or equal to 1')

	return height


def _parse_receipt_query(height=None):
	limit = _parse_bounded_integer('limit', _get_scalar_parameter('limit', '10'), 1, 100)
	offset = _parse_bounded_integer('offset', _get_scalar_parameter('offset', '0'), 0, RECEIPT_MAX_OFFSET)
	group = _get_scalar_parameter('group')
	if group is not None and group not in RECEIPT_GROUP_LABELS:
		raise ValueError('Invalid receipt group')

	receipt_type_arg = _get_scalar_parameter('receiptType')
	included_receipt_type_args = request.args.getlist('includedReceiptTypes')
	if receipt_type_arg is not None and included_receipt_type_args:
		raise ValueError('receiptType and includedReceiptTypes cannot be used together')

	receipt_type = _parse_receipt_type(receipt_type_arg) if receipt_type_arg is not None else None
	included_receipt_types = tuple(
		_parse_receipt_type(value, 'includedReceiptTypes') for value in included_receipt_type_args)
	if group is not None:
		if receipt_type is not None and RECEIPT_TYPE_GROUPS[receipt_type] != group:
			raise ValueError('Receipt type does not belong to group')
		if any(RECEIPT_TYPE_GROUPS[value] != group for value in included_receipt_types):
			raise ValueError('Receipt type does not belong to group')

	return ReceiptQuery(
		limit=limit,
		offset=offset,
		height=height,
		receipt_group=group,
		receipt_type=RECEIPT_TYPE_LABELS[receipt_type] if receipt_type is not None else None,
		included_receipt_types=tuple(RECEIPT_TYPE_LABELS[value] for value in included_receipt_types),
		target_address=_parse_address('targetAddress'),
		sender_address=_parse_address('senderAddress'))


def _get_scalar_parameter(name, default=None):
	values = request.args.getlist(name)
	if not values:
		return default
	if len(values) != 1:
		raise ValueError(f'{name} must not be repeated')

	return values[0]


def _parse_bounded_integer(name, value, minimum, maximum):
	try:
		parsed_value = int(value)
	except (TypeError, ValueError) as error:
		raise ValueError(f'{name} must be an integer') from error
	if parsed_value < minimum or parsed_value > maximum:
		raise ValueError(f'{name} must be between {minimum} and {maximum}')

	return parsed_value


def _parse_receipt_type(value, parameter_name='receiptType'):
	if ',' in value:
		if parameter_name == 'includedReceiptTypes':
			raise ValueError('includedReceiptTypes must be repeated query parameters')
		raise ValueError('Receipt type must be an integer')
	try:
		receipt_type = int(value)
	except (TypeError, ValueError) as error:
		raise ValueError('Receipt type must be an integer') from error
	if receipt_type not in RECEIPT_TYPE_LABELS:
		raise ValueError('Unsupported receipt type')

	return receipt_type


def _parse_address(name):
	value = _get_scalar_parameter(name)
	if value is None:
		return None
	try:
		if not any(network.is_valid_address_string(value) for network in Network.NETWORKS):
			raise ValueError(f'Invalid {name}')
		return Address(value).bytes
	except (TypeError, ValueError) as error:
		raise ValueError(f'Invalid {name}') from error


def _service_unavailable(message):
	return jsonify({
		'status': 503,
		'message': message
	}), 503
