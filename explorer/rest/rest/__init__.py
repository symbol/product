from flask import Flask, jsonify
from flask_cors import CORS

from rest.model.common import Pagination, Sorting
from rest.routes.nem import setup_nem_facade, setup_nem_routes

REST_CHAIN_HANDLERS = {
	'nem': (setup_nem_facade, setup_nem_routes)
}


def create_app(rest_chain_handlers=None):
	app = Flask(__name__)
	rest_chain_handlers = REST_CHAIN_HANDLERS if rest_chain_handlers is None else rest_chain_handlers

	CORS(app)

	setup_error_handlers(app)
	load_rest_config(app)

	setup_facade, setup_routes = _get_rest_chain_handlers(app.config.get('REST_CHAIN'), rest_chain_handlers)
	api_facade = setup_facade(app)
	setup_routes(app, api_facade)

	return app


def load_rest_config(app):
	"""Loads REST application configuration."""

	app.config.from_envvar('EXPLORER_REST_SETTINGS')


def _get_rest_chain_handlers(rest_chain, rest_chain_handlers):
	"""Gets the facade and route setup handlers for the selected chain."""

	if not rest_chain:
		raise ValueError('REST_CHAIN is required')

	rest_chain = rest_chain.lower()
	if rest_chain not in rest_chain_handlers:
		supported_chains = ', '.join(sorted(rest_chain_handlers.keys()))
		raise ValueError(f'Unsupported REST_CHAIN "{rest_chain}". Supported values: {supported_chains}')

	return rest_chain_handlers[rest_chain]


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
