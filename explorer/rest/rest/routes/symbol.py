import configparser
from pathlib import Path

from common.symbol.NodeConfiguration import SymbolNodeConfiguration
from flask import abort, jsonify, request
from psycopg2 import Error as PsycopgError
from zenlog import log

from rest.facade.SymbolRestFacade import SymbolRestFacade
from rest.model.common import DatabaseConfig

BLOCK_LIST_QUERY_PARAMETERS = frozenset(['limit', 'fromHeight', 'sort'])


def setup_symbol_facade(app):
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

	return SymbolRestFacade(db_params, node_config)


def setup_symbol_routes(app, symbol_api_facade):
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

			if not symbol_api_facade.is_block_data_available():
				return _service_unavailable('Symbol backend data is unavailable')

			result = symbol_api_facade.get_blocks(limit, from_height, sort)
		except ValueError as error:
			abort(400, error)
		except PsycopgError:
			log.error('Failed to get Symbol blocks')
			return _service_unavailable('Symbol backend data is unavailable')

		if result is None:
			return _service_unavailable('Symbol backend data is unavailable')

		return jsonify(result)

	@app.route('/api/symbol/block/<height>')
	def api_get_symbol_block_by_height(height):
		try:
			height = _parse_block_height(height)
		except ValueError as error:
			abort(400, error)

		if not symbol_api_facade.is_block_data_available():
			return _service_unavailable('Symbol backend data is unavailable')

		try:
			result = symbol_api_facade.get_block(height)
		except PsycopgError:
			log.error('Failed to get Symbol block')
			return _service_unavailable('Symbol backend data is unavailable')

		if not result:
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


def _service_unavailable(message):
	return jsonify({
		'status': 503,
		'message': message
	}), 503
