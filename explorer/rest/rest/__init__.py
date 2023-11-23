import configparser
from collections import namedtuple
from pathlib import Path

from flask import Flask, abort, jsonify, request
from flask_cors import CORS
from symbolchain.CryptoTypes import PublicKey
from symbolchain.nc import TransactionType
from symbolchain.nem.Network import Network
from zenlog import log

from rest.facade.NemRestFacade import NemRestFacade
from rest.model.Account import AccountQuery
from rest.model.Transaction import TransactionQuery

DatabaseConfig = namedtuple('DatabaseConfig', ['database', 'user', 'password', 'host', 'port'])


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
	network = Network.MAINNET if str(Path(app.config.get('NETWORK'))).upper() == 'MAINNET' else Network.TESTNET

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

	return NemRestFacade(db_params, network)


def setup_nem_routes(app, nem_api_facade):
	@app.route('/api/nem/block/<height>')
	def api_get_nem_block_by_height(height):
		try:
			height = int(height)
			if height < 1:
				raise ValueError()

		except ValueError:
			abort(400)

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

			if limit < 0 or offset < 0 or min_height < 1 or sort.upper() not in ['ASC', 'DESC']:
				raise ValueError()

		except ValueError:
			abort(400)

		return jsonify(nem_api_facade.get_blocks(limit=limit, offset=offset, min_height=min_height, sort=sort))

	@app.route('/api/nem/namespace/<name>')
	def api_get_nem_namespace_by_name(name):
		result = nem_api_facade.get_namespace(name)
		if not result:
			abort(404)
		return jsonify(result)

	@app.route('/api/nem/namespaces')
	def api_get_nem_namespaces():
		try:

			limit = int(request.args.get('limit', 10))
			offset = int(request.args.get('offset', 0))
			sort = request.args.get('sort', 'DESC')

			if limit < 0 or offset < 0 or sort.upper() not in ['ASC', 'DESC']:
				raise ValueError()

		except ValueError:
			abort(400)

		return jsonify(nem_api_facade.get_namespaces(limit=limit, offset=offset, sort=sort))

	@app.route('/api/nem/mosaic/<name>')
	def api_get_nem_mosaic_by_name(name):
		result = nem_api_facade.get_mosaic(name)
		if not result:
			abort(404)
		return jsonify(result)

	@app.route('/api/nem/mosaics')
	def api_get_nem_mosaics():
		try:
			limit = int(request.args.get('limit', 10))
			offset = int(request.args.get('offset', 0))
			sort = request.args.get('sort', 'DESC')

			if limit < 0 or offset < 0 or sort.upper() not in ['ASC', 'DESC']:
				raise ValueError()

		except ValueError:
			abort(400)

		return jsonify(nem_api_facade.get_mosaics(limit=limit, offset=offset, sort=sort))

	@app.route('/api/nem/mosaic/rich/list')
	def api_get_nem_mosaic_rich_list_by_name():
		try:
			limit = int(request.args.get('limit', 10))
			offset = int(request.args.get('offset', 0))
			namespace_name = request.args.get('namespaceName', None)

			if limit < 0 or offset < 0 or namespace_name is None:
				raise ValueError()

		except ValueError:
			abort(400)

		return jsonify(nem_api_facade.get_mosaic_rich_list(limit=limit, offset=offset, namespace_name=namespace_name))

	@app.route('/api/nem/mosaic/transfers')
	def api_get_nem_mosaic_transfers_by_name():
		try:
			limit = int(request.args.get('limit', 10))
			offset = int(request.args.get('offset', 0))
			namespace_name = request.args.get('namespaceName', None)

			if limit < 0 or offset < 0 or namespace_name is None:
				raise ValueError()

		except ValueError:
			abort(400)

		return jsonify(nem_api_facade.get_mosaic_transfers(limit=limit, offset=offset, namespace_name=namespace_name))

	@app.route('/api/nem/transaction/<hash>')
	def api_get_nem_transaction_by_hash(hash):
		result = nem_api_facade.get_transaction(hash)
		if not result:
			abort(404)
		return jsonify(result)

	@app.route('/api/nem/transactions')
	def api_get_nem_transactions():
		try:
			limit = int(request.args.get('limit', 10))
			offset = int(request.args.get('offset', 0))
			sort = request.args.get('sort', 'DESC')

			transaction_query = TransactionQuery(
				height=request.args.get('height', None),
				transaction_type=request.args.get('type', None),
				address=request.args.get('address', None),
				sender_address=request.args.get('senderAddress', None),
				recipient_address=request.args.get('recipientAddress', None),
				sender=request.args.get('senderPublicKey', None)
			)

			if limit < 0 or offset < 0 or sort.upper() not in ['ASC', 'DESC']:
				raise ValueError()

			if transaction_query.height is not None:
				height = int(transaction_query.height)
				if height < 1:
					raise ValueError()

			if transaction_query.address is not None:
				if not nem_api_facade.network.is_valid_address_string(transaction_query.address):
					raise ValueError()
			else:
				if transaction_query.sender_address is not None:
					if not nem_api_facade.network.is_valid_address_string(transaction_query.sender_address):
						raise ValueError()
				else:
					if transaction_query.sender is not None and not PublicKey(transaction_query.sender):
						raise ValueError()

				if transaction_query.recipient_address is not None:
					if not nem_api_facade.network.is_valid_address_string(transaction_query.recipient_address):
						raise ValueError()

			if transaction_query.transaction_type:
				VALID_TRANSACTION_TYPES = {
					TransactionType.TRANSFER.name,
					TransactionType.ACCOUNT_KEY_LINK.name,
					TransactionType.MULTISIG_ACCOUNT_MODIFICATION.name,
					TransactionType.MULTISIG.name,
					TransactionType.NAMESPACE_REGISTRATION.name,
					TransactionType.MOSAIC_DEFINITION.name,
					TransactionType.MOSAIC_SUPPLY_CHANGE.name
				}

				transaction_type = transaction_query.transaction_type.upper()

				if transaction_type not in VALID_TRANSACTION_TYPES:
					raise ValueError()

				transaction_type = TransactionType[transaction_type].value

				transaction_query = transaction_query._replace(transaction_type=transaction_type)

		except ValueError:
			abort(400)

		return jsonify(nem_api_facade.get_transactions(limit=limit, offset=offset, sort=sort, query=transaction_query))

	@app.route('/api/nem/account')
	def api_get_nem_account():
		try:
			address = request.args.get('address', None)
			public_key = request.args.get('publicKey', None)

			if address is not None:
				if not nem_api_facade.network.is_valid_address_string(address):
					raise ValueError()
			else:
				if public_key is not None and not PublicKey(public_key):
					raise ValueError()
		except ValueError:
			abort(400)

		account_query = AccountQuery(
			address=address,
			public_key=public_key
		)

		result = nem_api_facade.get_account(query=account_query)
		if not result:
			abort(404)
		return jsonify(result)

	@app.route('/api/nem/accounts')
	def api_get_nem_accounts():
		try:
			limit = int(request.args.get('limit', 10))
			offset = int(request.args.get('offset', 0))
			sort = request.args.get('sort', 'DESC')

			if limit < 0 or offset < 0 or sort.upper() not in ['ASC', 'DESC']:
				raise ValueError()

		except ValueError:
			abort(400)

		return jsonify(nem_api_facade.get_accounts(limit=limit, offset=offset, sort=sort))

	@app.route('/api/nem/transaction/statistics')
	def api_get_nem_transaction_statistics():
		return jsonify(nem_api_facade.get_transaction_statistics())

	@app.route('/api/nem/account/statistics')
	def api_get_nem_account_statistics():
		return jsonify(nem_api_facade.get_account_statistics())


def setup_error_handlers(app):
	@app.errorhandler(404)
	def not_found(_):
		response = {
			'status': 404,
			'message': 'Resource not found'
		}
		return jsonify(response), 404

	@app.errorhandler(400)
	def bad_request(_):
		response = {
			'status': 400,
			'message': 'Bad request'
		}
		return jsonify(response), 400
