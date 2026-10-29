import configparser
import re
from datetime import datetime, timezone
from pathlib import Path

from common.symbol.NativeMosaic import create_native_mosaic_info
from common.symbol.NodeConfiguration import SymbolNodeConfiguration
from common.symbol.ReceiptTypes import RECEIPT_GROUP_LABELS, RECEIPT_TYPE_GROUPS, RECEIPT_TYPE_LABELS
from flask import abort, jsonify, request
from psycopg2 import Error as PsycopgError
from symbolchain.CryptoTypes import PublicKey
from symbolchain.sc import NamespaceRegistrationType, TransactionType
from symbolchain.symbol.IdGenerator import generate_namespace_path
from symbolchain.symbol.Network import Address, Network
from zenlog import log

from rest.db.SymbolDatabase import (
	AccountListQuery,
	AccountSortField,
	NamespaceQuery,
	ReceiptQuery,
	SortOrder,
	SymbolDatabase,
	SymbolDataUnavailable,
	SymbolMosaicAliasNotFound,
	TransactionQuery
)
from rest.facade.SymbolRestFacade import SymbolRestFacade
from rest.model.common import DatabaseConfig
from rest.model.symbol.HarvestingBalanceRange import HarvestingBalanceRange
from rest.model.symbol.validation import SymbolDataInvalid

BLOCK_LIST_QUERY_PARAMETERS = frozenset(['limit', 'fromHeight', 'sort'])
BLOCK_STATISTICS_QUERY_PARAMETERS = frozenset()
MOSAIC_QUERY_PARAMETERS = frozenset(['limit', 'offset', 'sort'])
MOSAIC_MAX_OFFSET = 100000
RECEIPT_QUERY_PARAMETERS = frozenset([
	'limit', 'offset', 'group', 'receiptType', 'includedReceiptTypes', 'targetAddress', 'senderAddress'
])
BLOCK_RECEIPT_QUERY_PARAMETERS = frozenset(['limit', 'offset'])
TRANSACTION_QUERY_PARAMETERS = frozenset([
	'limit', 'offset', 'height', 'transactionTypes', 'address', 'senderAddress', 'signerPublicKey', 'recipientAddress',
	'mosaic', 'embedded', 'order'
])
NAMESPACE_QUERY_PARAMETERS = frozenset(['limit', 'offset', 'sort', 'aliasType', 'registrationType', 'ownerAddress'])
NAMESPACE_MAX_OFFSET = 100000
NAMESPACE_ALIAS_TYPES = {0: 'none', 1: 'mosaic', 2: 'address'}
NAMESPACE_REGISTRATION_TYPES = {
	registration_type.value: registration_type.name.lower() for registration_type in NamespaceRegistrationType
}
RECEIPT_MAX_OFFSET = 100000
TRANSACTION_MAX_OFFSET = 100000
ACCOUNT_LIST_QUERY_PARAMETERS = frozenset(['limit', 'offset', 'sort_field', 'sort_order', 'mosaic_id', 'is_harvesting'])
ACCOUNT_LIST_MAX_OFFSET = 100000
MAX_TRANSACTION_HEIGHT = 9223372036854775807
MOSAIC_ID_PATTERN = re.compile(r'[0-9A-Fa-f]{16}', re.ASCII)
NAMESPACE_NAME_LEVEL_PATTERN = r'[a-z0-9][a-z0-9_-]{0,63}'
NAMESPACE_NAME_PATTERN = re.compile(
	rf'{NAMESPACE_NAME_LEVEL_PATTERN}(?:\.{NAMESPACE_NAME_LEVEL_PATTERN}){{0,2}}', re.ASCII)
MAX_NAMESPACE_NAME_SIZE = 64
MAX_NAMESPACE_DEPTH = 3
XYM_DIVISIBILITY = 6
ACCOUNT_REFRESH_MAX_AGE_SETTING = 'SYMBOL_ACCOUNT_REFRESH_MAX_AGE_SECONDS'
HARVESTING_ACTIVE_WINDOW_SETTING = 'SYMBOL_HARVESTING_ACTIVE_WINDOW_DAYS'
HARVESTING_MIN_BALANCE_SETTING = 'SYMBOL_HARVESTING_MIN_BALANCE'
HARVESTING_MAX_BALANCE_SETTING = 'SYMBOL_HARVESTING_MAX_BALANCE'


def setup_symbol_facade(app, clock=None):
	"""Creates the Symbol facade after validating configuration against the UTC setup clock."""

	network = _create_symbol_network(app.config)
	native_mosaic_info = _create_native_mosaic_info(app.config)
	account_refresh_max_age_seconds = _create_required_positive_integer_setting(app.config, ACCOUNT_REFRESH_MAX_AGE_SETTING)
	harvesting_active_window_days = _create_required_positive_integer_setting(app.config, HARVESTING_ACTIVE_WINDOW_SETTING)
	harvesting_balance_range = _create_harvesting_balance_range(app.config)
	# Bound subtraction by datetime.min, not just timedelta's much larger range.
	# Later UTC request dates can represent at least this many whole days.
	setup_now = clock() if clock is not None else datetime.now(timezone.utc)
	max_harvesting_window_days = setup_now.astimezone(timezone.utc).toordinal() - datetime.min.toordinal()
	if harvesting_active_window_days > max_harvesting_window_days:
		raise ValueError(f'{HARVESTING_ACTIVE_WINDOW_SETTING} must be at most {max_harvesting_window_days} days at setup')
	node_config = SymbolNodeConfiguration.from_app_config(app.config)
	node_config.assert_request_allowed(node_config.base_url)

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
	symbol_db = SymbolDatabase(db_params, native_mosaic_info, clock)
	app.extensions['symbol_database'] = symbol_db
	return SymbolRestFacade(
		symbol_db, native_mosaic_info, network, account_refresh_max_age_seconds, harvesting_active_window_days,
		harvesting_balance_range)


def _create_symbol_network(app_config):
	if 'NETWORK_NAME' not in app_config:
		raise ValueError('NETWORK_NAME is required')

	network_name = app_config['NETWORK_NAME']
	if network_name not in ('mainnet', 'testnet'):
		raise ValueError('NETWORK_NAME must be either mainnet or testnet')

	return Network.MAINNET if network_name == 'mainnet' else Network.TESTNET


def _create_native_mosaic_info(app_config):
	try:
		mosaic_id = app_config['SYMBOL_NATIVE_MOSAIC_ID']
	except KeyError as error:
		raise ValueError(f'{error.args[0]} is required') from error

	return create_native_mosaic_info(mosaic_id, XYM_DIVISIBILITY)


def _create_required_positive_integer_setting(app_config, setting):
	if setting not in app_config:
		raise ValueError(f'{setting} is required')

	value = app_config[setting]
	if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
		raise ValueError(f'{setting} must be a positive integer')

	return value


def _create_harvesting_balance_range(app_config):
	values = {}
	for setting in (HARVESTING_MIN_BALANCE_SETTING, HARVESTING_MAX_BALANCE_SETTING):
		if setting not in app_config:
			raise ValueError(f'{setting} is required')
		value = app_config[setting]
		if isinstance(value, bool) or not isinstance(value, int) or not 0 <= value <= 2 ** 64 - 1:
			raise ValueError(f'{setting} must be an integer between 0 and 2**64 - 1')
		values[setting] = value

	if values[HARVESTING_MIN_BALANCE_SETTING] > values[HARVESTING_MAX_BALANCE_SETTING]:
		raise ValueError(f'{HARVESTING_MIN_BALANCE_SETTING} must be at most {HARVESTING_MAX_BALANCE_SETTING}')

	return HarvestingBalanceRange(values[HARVESTING_MIN_BALANCE_SETTING], values[HARVESTING_MAX_BALANCE_SETTING])


def setup_symbol_routes(app, symbol_api_facade):
	def _run_symbol_query(query_fn, error_log):
		try:
			return None, query_fn()
		except (PsycopgError, SymbolDataUnavailable):
			log.error(error_log)
			return _service_unavailable('Symbol backend data is unavailable'), None
		except SymbolDataInvalid as error:
			log.error(f'Invalid Symbol backend data at {error.field_path}: {error.reason}')
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

	@app.route('/api/symbol/block/statistics')
	def api_get_symbol_block_statistics():
		_validate_allowed_query_parameters(BLOCK_STATISTICS_QUERY_PARAMETERS)

		error, result = _run_symbol_query(
			symbol_api_facade.get_block_statistics,
			'Failed to get Symbol block statistics')
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

	_setup_symbol_mosaic_routes(app, symbol_api_facade, _run_symbol_query)
	_setup_symbol_namespace_routes(app, symbol_api_facade, _run_symbol_query)

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

	_setup_symbol_transactions_route(app, symbol_api_facade, _run_symbol_query)
	_setup_symbol_account_routes(app, symbol_api_facade, _run_symbol_query)
	_setup_symbol_block_receipts_route(app, symbol_api_facade, _run_symbol_query)


def _setup_symbol_block_receipts_route(app, symbol_api_facade, run_symbol_query):
	@app.route('/api/symbol/block/<height>/receipts')
	def api_get_symbol_block_receipts(height):
		try:
			height = _parse_block_height(height)
			_validate_allowed_query_parameters(BLOCK_RECEIPT_QUERY_PARAMETERS)
			query = _parse_receipt_query(height)
		except ValueError as error:
			abort(400, error)

		error, result = run_symbol_query(
			lambda: symbol_api_facade.get_receipts(query),
			'Failed to get Symbol block receipts')
		if error:
			return error

		if result is None:
			abort(404)

		return jsonify(result)


def _setup_symbol_account_routes(app, symbol_api_facade, run_symbol_query):
	@app.route('/api/symbol/account/statistics')
	def api_get_symbol_account_statistics():
		_validate_allowed_query_parameters(frozenset())

		error, result = run_symbol_query(
			symbol_api_facade.get_account_statistics,
			'Failed to get Symbol account statistics')
		if error:
			return error

		return jsonify(result)

	@app.route('/api/symbol/accounts')
	def api_get_symbol_accounts():
		try:
			_validate_allowed_query_parameters(ACCOUNT_LIST_QUERY_PARAMETERS)
			query = _parse_account_list_query()
		except ValueError as error:
			abort(400, error)

		error, result = run_symbol_query(
			lambda: symbol_api_facade.get_accounts(query),
			'Failed to get Symbol accounts')
		if error:
			return error

		return jsonify(result)

	@app.route('/api/symbol/account')
	def api_get_symbol_account():
		try:
			address, public_key = _parse_account_query(symbol_api_facade.network)
		except ValueError as error:
			abort(400, error)

		error, result = run_symbol_query(
			lambda: symbol_api_facade.try_get_account(address, public_key),
			'Failed to get Symbol account')
		if error:
			return error

		if result is None:
			abort(404)

		return jsonify(result)


def _setup_symbol_mosaic_routes(app, symbol_api_facade, run_symbol_query):
	@app.route('/api/symbol/mosaics')
	def api_get_symbol_mosaics():
		try:
			_validate_allowed_query_parameters(MOSAIC_QUERY_PARAMETERS)
			limit = _parse_bounded_integer('limit', _get_scalar_parameter('limit', '10'), 1, 100)
			offset = _parse_bounded_integer('offset', _get_scalar_parameter('offset', '0'), 0, MOSAIC_MAX_OFFSET)
			sort = _get_scalar_parameter('sort', 'DESC').upper()
			if sort not in ['ASC', 'DESC']:
				raise ValueError('Sort must be either ASC or DESC')
		except ValueError as error:
			abort(400, error)

		error, result = run_symbol_query(
			lambda: symbol_api_facade.get_mosaics(limit, offset, SortOrder(sort)),
			'Failed to get Symbol mosaics')
		if error:
			return error

		return jsonify(result)

	@app.route('/api/symbol/mosaic/<name>')
	def api_get_symbol_mosaic(name):
		try:
			_validate_allowed_query_parameters(frozenset())
			mosaic_id = _parse_mosaic_id(name)
		except ValueError as error:
			abort(400, error)

		error, result = run_symbol_query(
			lambda: symbol_api_facade.get_mosaic(mosaic_id),
			'Failed to get Symbol mosaic')
		if error:
			return error

		if result is None:
			abort(404)

		return jsonify(result)


def _setup_symbol_namespace_routes(app, symbol_api_facade, run_symbol_query):
	@app.route('/api/symbol/namespaces')
	def api_get_symbol_namespaces():
		try:
			_validate_allowed_query_parameters(NAMESPACE_QUERY_PARAMETERS)
			query = _parse_namespace_query()
		except ValueError as error:
			abort(400, error)

		error, result = run_symbol_query(
			lambda: symbol_api_facade.get_namespaces(query),
			'Failed to get Symbol namespaces')
		if error:
			return error

		return jsonify(result)

	@app.route('/api/symbol/namespace/<name>')
	def api_get_symbol_namespace(name):
		try:
			_validate_allowed_query_parameters(frozenset())
			namespace_id = _parse_namespace_id(name)
		except ValueError as error:
			abort(400, error)

		error, result = run_symbol_query(
			lambda: symbol_api_facade.try_get_namespace(namespace_id),
			'Failed to get Symbol namespace')
		if error:
			return error

		if result is None:
			abort(404)

		return jsonify(result)


def _setup_symbol_transactions_route(app, symbol_api_facade, run_symbol_query):
	@app.route('/api/symbol/transactions')
	def api_get_symbol_transactions():
		try:
			_validate_allowed_query_parameters(TRANSACTION_QUERY_PARAMETERS)
			query = _parse_transaction_query()
		except ValueError as error:
			abort(400, error)

		try:
			error, result = run_symbol_query(
				lambda: symbol_api_facade.get_transactions(query),
				'Failed to get Symbol transactions')
		except SymbolMosaicAliasNotFound:
			abort(404)

		if error:
			return error

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


def _parse_account_list_query():
	limit = _parse_bounded_integer('limit', _get_scalar_parameter('limit', '10'), 1, 100)
	offset = _parse_bounded_integer('offset', _get_scalar_parameter('offset', '0'), 0, ACCOUNT_LIST_MAX_OFFSET)
	sort_field_value = _get_scalar_parameter('sort_field', 'ID').upper()
	try:
		sort_field = AccountSortField(sort_field_value)
	except ValueError as error:
		raise ValueError('sort_field must be ID, IMPORTANCE, BALANCE, or HEIGHT') from error

	sort_order = _get_scalar_parameter('sort_order', 'DESC').upper()
	if sort_order != SortOrder.DESC.value:
		raise ValueError('sort_order must be DESC')

	mosaic_id = _get_scalar_parameter('mosaic_id')
	if mosaic_id is not None:
		if not MOSAIC_ID_PATTERN.fullmatch(mosaic_id):
			raise ValueError('Invalid mosaic_id')

		mosaic_id = mosaic_id.upper()

	if sort_field == AccountSortField.BALANCE and mosaic_id is None:
		raise ValueError('mosaic_id is required for BALANCE')

	if sort_field != AccountSortField.BALANCE and mosaic_id is not None:
		raise ValueError('mosaic_id can only be used with BALANCE')

	is_harvesting = _parse_boolean('is_harvesting', _get_scalar_parameter('is_harvesting'))
	return AccountListQuery(sort_field, mosaic_id, limit, offset, is_harvesting)


def _parse_namespace_query():
	limit = _parse_bounded_integer('limit', _get_scalar_parameter('limit', '10'), 1, 100)
	offset = _parse_bounded_integer('offset', _get_scalar_parameter('offset', '0'), 0, NAMESPACE_MAX_OFFSET)
	sort_value = _get_scalar_parameter('sort', 'DESC').upper()
	if sort_value not in ('ASC', 'DESC'):
		raise ValueError('Sort must be either ASC or DESC')

	alias_type_value = _get_scalar_parameter('aliasType')
	alias_type = None
	if alias_type_value is not None:
		alias_type = _parse_bounded_integer('aliasType', alias_type_value, 0, 2)

	registration_type_value = _get_scalar_parameter('registrationType')
	registration_type = None
	if registration_type_value is not None:
		registration_type = _parse_bounded_integer('registrationType', registration_type_value, 0, 1)

	return NamespaceQuery(
		limit=limit,
		offset=offset,
		sort=SortOrder(sort_value),
		alias_type=NAMESPACE_ALIAS_TYPES[alias_type] if alias_type is not None else None,
		registration_type=NAMESPACE_REGISTRATION_TYPES[registration_type] if registration_type is not None else None,
		owner_address=_parse_address('ownerAddress'))


def _parse_transaction_query():
	limit = _parse_bounded_integer('limit', _get_scalar_parameter('limit', '10'), 1, 250)
	offset = _parse_bounded_integer('offset', _get_scalar_parameter('offset', '0'), 0, TRANSACTION_MAX_OFFSET)
	height_arg = _get_scalar_parameter('height')
	height = _parse_bounded_integer('height', height_arg, 1, MAX_TRANSACTION_HEIGHT) if height_arg is not None else None
	types = _parse_transaction_types(_get_scalar_parameter('transactionTypes'))
	address = _parse_address('address')
	sender_address = _parse_address('senderAddress')
	signer_public_key = _parse_public_key('signerPublicKey')
	recipient_address = _parse_address('recipientAddress')
	if address is not None and sender_address is not None:
		raise ValueError('address cannot be combined with senderAddress')

	if address is not None and (signer_public_key is not None or recipient_address is not None):
		raise ValueError('address cannot be combined with signerPublicKey or recipientAddress')

	transfer_mosaic_id = _parse_mosaic_id(_get_scalar_parameter('mosaic'))
	embedded = _parse_boolean('embedded', _get_scalar_parameter('embedded'))
	order_value = _get_scalar_parameter('order', 'DESC').upper()
	if order_value != SortOrder.DESC.value:
		raise ValueError('order must be DESC')

	return TransactionQuery(
		limit=limit,
		offset=offset,
		height=height,
		transaction_types=types,
		address=address,
		sender_address=sender_address,
		signer_public_key=signer_public_key,
		recipient_address=recipient_address,
		transfer_mosaic_id=transfer_mosaic_id,
		include_embedded=embedded)


def _parse_transaction_types(value):
	if value is None:
		return ()

	if not value:
		raise ValueError('transactionTypes must not be empty')

	type_names = value.split(',')
	if any(not type_name for type_name in type_names):
		raise ValueError('transactionTypes must not contain empty values')

	transaction_types = []
	for type_name in type_names:
		normalized_name = type_name.upper()
		if normalized_name not in TransactionType.__members__:
			raise ValueError(f'Unknown transactionTypes value: {type_name}')

		transaction_types.append(TransactionType[normalized_name].value)

	return tuple(transaction_types)


def _parse_public_key(name):
	value = _get_scalar_parameter(name)
	if value is None:
		return None

	try:
		return PublicKey(value).bytes
	except ValueError as error:
		raise ValueError(f'Invalid {name}') from error


def _parse_mosaic_id(value):
	if value is None:
		return None

	if MOSAIC_ID_PATTERN.fullmatch(value):
		return value.upper()

	parts = value.split('.')
	if len(parts) > MAX_NAMESPACE_DEPTH:
		raise ValueError('Invalid mosaic')

	if any(len(part) > MAX_NAMESPACE_NAME_SIZE for part in parts):
		raise ValueError('Invalid mosaic')

	try:
		return f'{generate_namespace_path(value)[-1]:016X}'
	except ValueError as error:
		raise ValueError('Invalid mosaic') from error


def _parse_namespace_id(value):
	if MOSAIC_ID_PATTERN.fullmatch(value):
		return value.upper()

	if not NAMESPACE_NAME_PATTERN.fullmatch(value):
		raise ValueError('Invalid namespace')

	return f'{generate_namespace_path(value)[-1]:016X}'


def _parse_boolean(name, value):
	if value is None:
		return False

	normalized_value = value.lower()
	if normalized_value == 'true':
		return True

	if normalized_value == 'false':
		return False

	raise ValueError(f'{name} must be true or false')


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


def _parse_account_query(network):
	_validate_query_parameters({'address', 'publicKey'})
	address = _get_scalar_parameter('address')
	public_key = _get_scalar_parameter('publicKey')
	if (address is None) == (public_key is None):
		raise ValueError('Exactly one of address or publicKey is required')

	if address is not None:
		return _parse_account_address(address, network), None

	return None, _parse_account_search_public_key(public_key)


def _validate_query_parameters(allowed_parameters):
	if set(request.args.keys()) - allowed_parameters:
		raise ValueError('Unsupported query parameter')


def _parse_account_address(value, network):
	if not network.is_valid_address_string(value):
		raise ValueError('Invalid address')

	return Address(value).bytes


def _parse_account_search_public_key(value):
	if not re.fullmatch(r'[0-9A-Fa-f]{64}', value, re.ASCII) or value == '0' * 64:
		raise ValueError('Invalid publicKey')

	return PublicKey(value).bytes


def _service_unavailable(message):
	return jsonify({
		'status': 503,
		'message': message
	}), 503
