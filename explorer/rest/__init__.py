import configparser

from pathlib import Path

from flask import abort, Flask, jsonify, request
from zenlog import log

from rest.facade.NemRestFacade import NemRestFacade

def create_app():
	app = Flask(__name__)

	setup_app_config(app)
	setup_error_handlers(app)

	nem_api_facade = setup_nem_facade(app)
	setup_nem_routes(app, nem_api_facade)

	return app

def setup_app_config(app):
	app.config.from_envvar('EXPLORER_REST_SETTINGS')
	db_path = Path(app.config.get('DATABASE_PATH'))
	log.info(f'loading database config from {db_path}')

def setup_nem_facade(app):
	config = configparser.ConfigParser()
	db_path = Path(app.config.get('DATABASE_PATH'))
	config.read(db_path)
	return NemRestFacade(config['nem_db'])

def setup_nem_routes(app, nem_api_facade):
	@app.route('/api/nem/block/<height>')
	def api_get_nem_block_by_height(height):
		result = nem_api_facade.get_block(height)
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
