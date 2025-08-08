from pathlib import Path

from flask import Flask, jsonify, redirect

from ..models.BridgeConfiguration import parse_bridge_configuration


def _network_config_to_dict(config):
	return {
		'blockchain': config.blockchain,
		'network': config.network,
		'bridgeAddress': config.bridge_address,
		'tokenId': config.mosaic_id
	}


def create_app():
	app = Flask(__name__)
	app.config.from_envvar('BRIDGE_API_SETTINGS')

	config_path = Path(app.config.get('CONFIG_PATH'))

	config = parse_bridge_configuration(config_path)

	@app.route('/')
	def root():  # pylint: disable=unused-variable
		return jsonify({
			'native_network': _network_config_to_dict(config.native_network),
			'wrapped_network': _network_config_to_dict(config.wrapped_network)
		})

	return app
