import configparser
from pathlib import Path

from flask import Flask, abort, jsonify, request
from flask_cors import CORS
from symbolchain.CryptoTypes import PublicKey
from zenlog import log

from rest.facade.NemRestFacade import NemRestFacade
from rest.model.common import DatabaseConfig, Pagination, RestConfig, Sorting


def create_app():
	app = Flask(__name__)

	CORS(app)

	setup_error_handlers(app)

	nem_api_facade = setup_nem_facade(app)
	setup_nem_routes(app, nem_api_facade)

	return app


def setup_nem_facade(app):
	app.config.from_envvar('EXPLORER_REST_SETTINGS')
	config = configparser.ConfigParser()
	db_path = Path(app.config.get('DATABASE_CONFIG_FILEPATH'))

	log.info(f'loading database config from {db_path}')

	config.read(db_path)

	nem_db_config = config['nem_db']
	db_params = DatabaseConfig(
		nem_db_config['database'],
		nem_db_config['user'],
		nem_db_config['password'],
		nem_db_config['host'],
		nem_db_config['port']
	)

	rest_config = RestConfig(
		app.config.get('NETWORK_NAME', 'mainnet'),
		app.config.get('NODE_URL', 'http://localhost:7890'),
		int(app.config.get('MAX_LAG_BLOCKS', 2))
	)

	return NemRestFacade(db_params, rest_config)


def setup_nem_routes(app, nem_api_facade):  # pylint: disable=too-many-statements
	@app.route('/api/nem/block/<height>')
	def api_get_nem_block_by_height(height):
		try:
			height = int(height)
			if height < 1:
				raise ValueError('Height must be greater than or equal to 1')

		except ValueError as error:
			abort(400, error)

		result = nem_api_facade.get_block(height)
		if not result:
			abort(404)

		return jsonify(result)

	@app.route('/api/nem/blocks')
	def api_get_nem_blocks():
		try:
			limit = int(request.args.get('limit', 10))
			offset = int(request.args.get('offset', 0))
			min_height = int(request.args.get('min_height', 1))
			sort = request.args.get('sort', 'DESC')

			if limit < 0 or offset < 0:
				raise ValueError('Limit and offset must be greater than or equal to 0')
			if min_height < 1:
				raise ValueError('Minimum height must be greater than or equal to 1')
			if sort.upper() not in ['ASC', 'DESC']:
				raise ValueError('Sort must be either ASC or DESC')

		except ValueError as error:
			abort(400, error)

		result = nem_api_facade.get_blocks(
			pagination=Pagination(limit, offset),
			min_height=min_height,
			sort=sort
		)

		return jsonify(result)

	@app.route('/api/nem/account')
	def api_get_nem_account():
		address = request.args.get('address', '').strip() or None
		public_key = request.args.get('publicKey', '').strip() or None

		# Validate that exactly one of address or public_key is provided
		if bool(address) == bool(public_key):
			abort(400, 'Exactly one of address or publicKey must be provided')

		if address and not nem_api_facade.nem_db.network.is_valid_address_string(address):
			abort(400, 'Invalid address format')

		if public_key:
			try:
				PublicKey(public_key)
			except ValueError:
				abort(400, 'Invalid public key format')

		if address:
			result = nem_api_facade.get_account_by_address(address)
		else:
			result = nem_api_facade.get_account_by_public_key(public_key)

		if not result:
			abort(404)

		return jsonify(result)

	@app.route('/api/nem/account/statistics')
	def api_get_nem_account_statistics():
		return jsonify(nem_api_facade.get_account_statistics())

	@app.route('/api/nem/health')
	async def api_get_nem_health():
		result = await nem_api_facade.get_health()

		return jsonify(result)

	@app.route('/api/nem/accounts')
	def api_get_nem_accounts():
		try:
			limit = int(request.args.get('limit', 10))
			offset = int(request.args.get('offset', 0))
			sort_field = request.args.get('sort_field', 'BALANCE').upper()
			sort_order = request.args.get('sort_order', 'DESC').upper()
			is_harvesting = request.args.get('is_harvesting', 'false').lower() == 'true'

			if limit < 0 or offset < 0:
				raise ValueError('Limit and offset must be greater than or equal to 0')
			if sort_order not in ['ASC', 'DESC']:
				raise ValueError('Sort order must be either ASC or DESC')
			if sort_field not in ['BALANCE']:
				raise ValueError('Sort field must be BALANCE')

		except ValueError as error:
			abort(400, error)

		results = nem_api_facade.get_accounts(
			pagination=Pagination(limit, offset),
			sorting=Sorting(sort_field, sort_order),
			is_harvesting=is_harvesting
		)

		return jsonify(results)

	@app.route('/api/nem/namespace/<name>')
	def api_get_nem_namespace_by_name(name):
		result = nem_api_facade.get_namespace_by_name(name)

		if not result:
			abort(404)

		return jsonify(result)

	@app.route('/api/nem/namespaces')
	def api_get_nem_namespaces():
		try:
			limit = int(request.args.get('limit', 10))
			offset = int(request.args.get('offset', 0))
			sort = request.args.get('sort', 'DESC')

			if limit < 0 or offset < 0:
				raise ValueError('Limit and offset must be greater than or equal to 0')
			if sort.upper() not in ['ASC', 'DESC']:
				raise ValueError('Sort must be either ASC or DESC')

		except ValueError as error:
			abort(400, error)

		results = nem_api_facade.get_namespaces(
			pagination=Pagination(limit, offset),
			sort=sort
		)

		return jsonify(results)

	@app.route('/api/nem/mosaic/<name>')
	def api_get_nem_mosaic_by_name(name):
		result = nem_api_facade.get_mosaic_by_name(name)

		if not result:
			abort(404)

		return jsonify(result)

	@app.route('/api/nem/mosaics')
	def api_get_nem_mosaics():
		try:
			limit = int(request.args.get('limit', 10))
			offset = int(request.args.get('offset', 0))
			sort = request.args.get('sort', 'DESC')

			if limit < 0 or offset < 0:
				raise ValueError('Limit and offset must be greater than or equal to 0')
			if sort.upper() not in ['ASC', 'DESC']:
				raise ValueError('Sort must be either ASC or DESC')

		except ValueError as error:
			abort(400, error)

		results = nem_api_facade.get_mosaics(
			pagination=Pagination(limit, offset),
			sort=sort
		)

		return jsonify(results)

	@app.route('/api/nem/mosaic/rich/list')
	def api_get_nem_mosaic_rich_list_by_name():
		try:
			limit = int(request.args.get('limit', 10))
			offset = int(request.args.get('offset', 0))
			namespace_name = request.args.get('namespace_name', 'nem.xem')

			if limit < 0 or offset < 0:
				raise ValueError('Limit and offset must be greater than or equal to 0')

		except ValueError as error:
			abort(400, error)

		results = nem_api_facade.get_mosaic_rich_list(
			pagination=Pagination(limit, offset),
			namespace_name=namespace_name
		)

		return jsonify(results)

	@app.route('/api/nem/transaction/<transaction_hash>')
	def api_get_nem_transaction_by_hash(transaction_hash):
		result = nem_api_facade.get_transaction_by_hash(transaction_hash)

		if not result:
			abort(404)

		return jsonify(result)


def setup_error_handlers(app):
	@app.errorhandler(404)
	def not_found(_):
		response = {
			'status': 404,
			'message': 'Resource not found'
		}
		return jsonify(response), 404

	@app.errorhandler(400)
	def bad_request(error):
		response = {
			'status': 400,
			'message': str(error.description) if error.description else 'Bad request'
		}
		return jsonify(response), 400
