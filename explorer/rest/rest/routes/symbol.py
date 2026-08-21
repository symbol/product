import configparser
import hashlib
import json
from pathlib import Path

import common.symbol.Receipt as receipt_contract
from common.symbol.NodeConfiguration import SymbolNodeConfiguration
from flask import abort, jsonify, request
from psycopg2 import Error as PsycopgError
from symbolchain.Network import NetworkLocator
from symbolchain.symbol.Network import Network
from zenlog import log

from rest.db.SymbolDatabase import ReceiptCursorStaleError, ReceiptDataUnavailableError, ReceiptQuery, SortOrder
from rest.facade.SymbolRestFacade import SymbolRestFacade
from rest.model.common import DatabaseConfig
from rest.model.symbol.ReceiptCursor import ReceiptCursor, decode_receipt_cursor, encode_receipt_cursor
from rest.symbol_node import fetch_native_mosaic_info

BLOCK_LIST_QUERY_PARAMETERS = frozenset(['limit', 'fromHeight', 'sort'])
RECEIPT_QUERY_PARAMETERS = frozenset([
	'limit',
	'cursor',
	'group',
	'receiptType',
	'includedReceiptTypes',
	'targetAddress',
	'senderAddress'
])
BLOCK_RECEIPT_QUERY_PARAMETERS = frozenset(['limit', 'cursor'])


def setup_symbol_facade(app, native_mosaic_info_fetcher=fetch_native_mosaic_info):
	"""Creates the Symbol facade after setup-time native mosaic validation.

	The fetcher is injected at the Symbol setup boundary for deterministic tests;
	production uses the Node-backed default and fetches once before serving requests.
	"""
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
	native_mosaic_info = native_mosaic_info_fetcher(node_config)

	return SymbolRestFacade(db_params, node_config, native_mosaic_info)


def setup_symbol_routes(app, symbol_api_facade):  # pylint: disable=too-many-statements
	network_name = app.config.get('NETWORK_NAME', 'mainnet').lower()
	network = NetworkLocator.find_by_name(Network.NETWORKS, network_name)

	def _run_symbol_query(query_fn, error_log, availability_check=None):
		try:
			if availability_check and not availability_check():
				return _service_unavailable('Symbol backend data is unavailable'), None
			return None, query_fn()
		except ReceiptCursorStaleError:
			return _conflict(ReceiptCursorStaleError.MESSAGE), None
		except ReceiptDataUnavailableError:
			return _service_unavailable('Symbol backend data is unavailable'), None
		except PsycopgError:
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
			'Failed to get Symbol blocks',
			symbol_api_facade.is_block_data_available)
		if error:
			return error

		if result is None:
			return _service_unavailable('Symbol backend data is unavailable')

		return jsonify(result)

	@app.route('/api/symbol/block/<height>')
	def api_get_symbol_block_by_height(height):
		try:
			height = _parse_block_height(height)
		except ValueError as error:
			abort(400, error)

		error, result = _run_symbol_query(
			lambda: symbol_api_facade.get_block(height),
			'Failed to get Symbol block',
			symbol_api_facade.is_block_data_available)
		if error:
			return error

		if not result:
			abort(404)

		return jsonify(result)

	@app.route('/api/symbol/receipts')
	def api_get_symbol_receipts():
		_validate_allowed_query_parameters(RECEIPT_QUERY_PARAMETERS)
		try:
			query = _parse_receipt_query(network, network_name, height=None, scope='receipts')
		except ValueError as error:
			abort(400, error)

		error, result = _run_symbol_query(
			lambda: symbol_api_facade.get_receipts(query),
			'Failed to get Symbol receipts')
		if error:
			return error

		if result is None:
			return _service_unavailable('Symbol backend data is unavailable')

		return jsonify(_serialize_receipt_page(result, query, network_name, 'receipts'))

	@app.route('/api/symbol/block/<height>/receipts')
	def api_get_symbol_block_receipts(height):
		_validate_allowed_query_parameters(BLOCK_RECEIPT_QUERY_PARAMETERS)
		try:
			validated_height = _parse_block_height(height)
			query = _parse_receipt_query(
				network,
				network_name,
				height=validated_height,
				scope='blockReceipts',
				block_route=True)
		except ValueError as error:
			abort(400, error)

		error, result = _run_symbol_query(
			lambda: symbol_api_facade.get_receipts(query),
			'Failed to get Symbol block receipts')
		if error:
			return error

		if result is None:
			return _service_unavailable('Symbol backend data is unavailable')

		return jsonify(_serialize_receipt_page(result, query, network_name, 'blockReceipts'))


def _validate_allowed_query_parameters(allowed_parameters):
	unsupported_parameters = sorted(set(request.args.keys()) - allowed_parameters)
	if unsupported_parameters:
		abort(400, f'Unsupported query parameter: {unsupported_parameters[0]}')


def _parse_block_height(raw_height):
	height = int(raw_height)
	if height < 1:
		raise ValueError('Height must be greater than or equal to 1')

	return height


def _parse_receipt_query(network, network_name, height, scope, block_route=False):
	limit = _parse_bounded_integer('limit', 10, 1, 100)
	raw_cursor = _get_scalar('cursor')
	cursor = decode_receipt_cursor(raw_cursor) if raw_cursor is not None else None
	if block_route:
		query = ReceiptQuery(limit, cursor, height, None, None, (), None, None)
		_filter_cursor(query, cursor, network_name, scope, height)
		return query

	group = _parse_group()
	receipt_type = _parse_scalar_receipt_type()
	included_receipt_types = _parse_included_receipt_types()
	if receipt_type is not None and included_receipt_types:
		raise ValueError('receiptType and includedReceiptTypes cannot be combined')

	if group and receipt_type and _receipt_group_for_label(receipt_type) != group:
		raise ValueError('receiptType does not belong to group')
	if group and any(_receipt_group_for_label(receipt_type) != group for receipt_type in included_receipt_types):
		raise ValueError('includedReceiptTypes contains a receipt from another group')

	target_address = _parse_address('targetAddress', network)
	sender_address = _parse_address('senderAddress', network)
	query = ReceiptQuery(
		limit,
		cursor,
		height,
		group,
		receipt_type,
		included_receipt_types,
		target_address,
		sender_address
	)
	_filter_cursor(query, cursor, network_name, scope, height)
	return query


def _parse_bounded_integer(name, default, minimum, maximum):
	raw_value = _get_scalar(name)
	if raw_value is None:
		return default

	try:
		value = int(raw_value)
	except (TypeError, ValueError) as error:
		raise ValueError(f'{name} must be an integer') from error

	if value < minimum or value > maximum:
		raise ValueError(f'{name} must be between {minimum} and {maximum}')

	return value


def _parse_group():
	group = _get_scalar('group')
	if group is not None and group not in receipt_contract.RECEIPT_GROUP_VALUES:
		raise ValueError('group is invalid')

	return group


def _parse_scalar_receipt_type():
	raw_value = _get_scalar('receiptType')
	if raw_value is None:
		return None

	try:
		code = int(raw_value)
	except (TypeError, ValueError) as error:
		raise ValueError('receiptType must be a valid numeric code') from error

	if code not in receipt_contract.RECEIPT_TYPE_LABELS:
		raise ValueError('receiptType is not supported')

	return receipt_contract.RECEIPT_TYPE_LABELS[code]


def _parse_included_receipt_types():
	values = request.args.getlist('includedReceiptTypes')
	parsed_values = []
	for raw_value in values:
		if ',' in raw_value:
			raise ValueError('includedReceiptTypes must use repeated query parameters')
		try:
			code = int(raw_value)
		except (TypeError, ValueError) as error:
			raise ValueError('includedReceiptTypes must contain numeric codes') from error
		if code not in receipt_contract.RECEIPT_TYPE_LABELS:
			raise ValueError('includedReceiptTypes contains an unsupported receipt type')
		parsed_values.append(receipt_contract.RECEIPT_TYPE_LABELS[code])

	return tuple(sorted(set(parsed_values)))


def _receipt_group_for_label(label):
	code = next(code for code, candidate in receipt_contract.RECEIPT_TYPE_LABELS.items() if candidate == label)
	return receipt_contract.RECEIPT_TYPE_GROUPS[code]


def _parse_address(name, network):
	raw_value = _get_scalar(name)
	if raw_value is None:
		return None

	if not network.is_valid_address_string(raw_value):
		raise ValueError(f'{name} is invalid')

	return network.address_class(raw_value).bytes


def _get_scalar(name):
	values = request.args.getlist(name)
	if len(values) > 1:
		raise ValueError(f'{name} must not be repeated')

	return values[0] if values else None


def _service_unavailable(message):
	return jsonify({
		'status': 503,
		'message': message
	}), 503


def _receipt_filter_hash(query, scope):
	filter_payload = {
		'blockHeight': query.height,
		'group': query.receipt_group,
		'includedReceiptTypes': list(query.included_receipt_types),
		'receiptType': query.receipt_type,
		'scope': scope,
		'senderAddress': query.sender_address.hex() if query.sender_address is not None else None,
		'targetAddress': query.target_address.hex() if query.target_address is not None else None
	}
	canonical_filter = json.dumps(filter_payload, sort_keys=True, separators=(',', ':')).encode('utf-8')
	return hashlib.sha256(canonical_filter).hexdigest()


def _filter_cursor(query, cursor, network_name, scope, height):
	if cursor is None:
		return
	if cursor.scope != scope:
		raise ValueError('Receipt cursor scope mismatch')
	if cursor.network != network_name:
		raise ValueError('Receipt cursor network mismatch')
	if scope == 'blockReceipts' and cursor.height != height:
		raise ValueError('Receipt cursor block height mismatch')
	if cursor.filter_hash != _receipt_filter_hash(query, scope):
		raise ValueError('Receipt cursor filter mismatch')


def _serialize_receipt_page(page, query, network_name, scope):
	next_cursor = None
	if page.next_position is not None:
		receipt_cursor = ReceiptCursor(
			1,
			scope,
			network_name,
			page.chain_revision,
			page.next_position.height,
			page.next_position.id,
			_receipt_filter_hash(query, scope)
		)
		next_cursor = encode_receipt_cursor(receipt_cursor)

	return {
		'data': page.items,
		'pagination': {
			'nextCursor': next_cursor
		}
	}


def _conflict(message):
	return jsonify({
		'status': 409,
		'message': message
	}), 409
