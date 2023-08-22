import configparser
from collections import namedtuple
from pathlib import Path

from flask import Flask, abort, jsonify, request
from zenlog import log

from rest.facade.NemRestFacade import NemRestFacade

DatabaseConfig = namedtuple('DatabaseConfig', ['database', 'user', 'password', 'host', 'port'])


def create_app():
	app = Flask(__name__)

	setup_error_handlers(app)

	nem_api_facade = setup_nem_facade(app)
	setup_nem_routes(app, nem_api_facade)

	return app


def setup_nem_facade(app):
	app.config.from_envvar('EXPLORER_REST_SETTINGS')
	config = configparser.ConfigParser()
	db_path = Path(app.config.get('DATABASE_PATH'))

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

	return NemRestFacade(db_params)


def setup_nem_routes(app, nem_api_facade):
	@app.route('/api/nem/block/<height>')
	def api_get_nem_block_by_height(height):
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

			if limit < 0 or offset < 0 or min_height < 1:
				raise ValueError()

		except ValueError:
			abort(400)

		return jsonify(nem_api_facade.get_blocks(limit=limit, offset=offset, min_height=min_height))


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
