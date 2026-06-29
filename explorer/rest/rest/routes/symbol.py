import configparser
from pathlib import Path

from common.symbol.NodeConfiguration import SymbolNodeConfiguration
from flask import jsonify
from zenlog import log

from rest.facade.SymbolRestFacade import SymbolRestFacade
from rest.model.common import DatabaseConfig


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
