import configparser
from pathlib import Path

from flask import jsonify
from zenlog import log

from rest.facade.SymbolRestFacade import SymbolRestFacade
from rest.model.common import DatabaseConfig
from rest.model.symbol.NodeConfig import SymbolNodeConfig, SymbolNodeConfigError


def setup_symbol_facade(app):
	if 'DATABASE_CONFIG_FILEPATH' not in app.config:
		app.config.from_envvar('EXPLORER_REST_SETTINGS')

	config = configparser.ConfigParser()
	db_path = Path(app.config.get('DATABASE_CONFIG_FILEPATH'))

	log.info(f'loading database config from {db_path}')

	config.read(db_path)

	db_params = None
	if config.has_section('symbol_db'):
		symbol_db_config = config['symbol_db']
		db_params = DatabaseConfig(
			symbol_db_config['database'],
			symbol_db_config['user'],
			symbol_db_config['password'],
			symbol_db_config['host'],
			symbol_db_config['port']
		)

	try:
		node_config = SymbolNodeConfig.from_app_config(app.config)
		config_error = None
	except SymbolNodeConfigError as error:
		node_config = None
		config_error = error

	return SymbolRestFacade(db_params, node_config, config_error)


def setup_symbol_routes(app, symbol_api_facade):
	@app.route('/api/symbol/health')
	def api_get_symbol_health():
		return jsonify(symbol_api_facade.get_health())
