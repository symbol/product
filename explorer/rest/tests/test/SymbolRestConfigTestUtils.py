from pathlib import Path


def write_symbol_rest_config(directory, database_config, native_mosaic_id):
	"""Writes the Symbol app and database config used by REST HTTP integration tests."""

	db_path = Path(directory) / 'db.ini'
	db_path.write_text(
		'[symbol_db]\n'
		f'database = {database_config.database}\n'
		f'user = {database_config.user}\n'
		'password = \n'
		f'host = {database_config.host}\n'
		f'port = {database_config.port}\n',
		encoding='utf8')

	app_path = Path(directory) / 'app.config'
	app_path.write_text(
		'REST_CHAIN="symbol"\n'
		'NETWORK_NAME="testnet"\n'
		f'DATABASE_CONFIG_FILEPATH="{db_path}"\n'
		f'SYMBOL_NATIVE_MOSAIC_ID={native_mosaic_id!r}\n'
		'SYMBOL_ACCOUNT_REFRESH_MAX_AGE_SECONDS=7200\n'
		'SYMBOL_HARVESTING_ACTIVE_WINDOW_DAYS=7\n'
		'SYMBOL_HARVESTING_MIN_BALANCE=0\n'
		'SYMBOL_HARVESTING_MAX_BALANCE=18446744073709551615\n'
		'SYMBOL_NODE_URL="http://127.0.0.1:1"\n'
		'SYMBOL_NODE_ALLOWED_HOSTS="127.0.0.1:1"\n'
		'SYMBOL_NODE_ALLOW_LOOPBACK="true"\n'
		'SYMBOL_NODE_ALLOW_PRIVATE="false"\n',
		encoding='utf8')

	return app_path
