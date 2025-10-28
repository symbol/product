from pathlib import Path

from apscheduler.schedulers.background import BackgroundScheduler
from flask import Flask, abort, jsonify, redirect, render_template, request, send_from_directory, url_for
from flask_cors import CORS
from symbolchain.CryptoTypes import Hash256, PublicKey
from symbolchain.nem.Network import Network as NemNetwork
from symbolchain.Network import NetworkLocator
from symbolchain.symbol.Network import Network as SymbolNetwork
from zenlog import log

from .RoutesFacade import MIN_HEIGHT_CLUSTER_SIZE, TIMESTAMP_FORMAT, NemRoutesFacade, SymbolRoutesFacade


def create_app():
	# pylint: disable=too-many-locals,too-many-statements

	app = Flask(__name__)
	CORS(app)
	app.config.from_envvar('NODEWATCH_SETTINGS')

	resources_path = Path(app.config.get('RESOURCES_PATH'))
	network_name = app.config.get('NETWORK_NAME', 'mainnet')
	min_cluster_size = app.config.get('MIN_HEIGHT_CLUSTER_SIZE', MIN_HEIGHT_CLUSTER_SIZE)

	symbol_explorer_endpoint = app.config.get('SYMBOL_EXPLORER_ENDPOINT')
	symbol_generation_hash_seed = app.config.get('SYMBOL_GENERATION_HASH_SEED', None)
	symbol_block_generation_target_time = app.config.get('SYMBOL_BLOCK_GENERATION_TARGET_TIME', 30)
	symbol_voting_set_grouping = app.config.get('SYMBOL_VOTING_SET_GROUPING', 1440)
	nem_explorer_endpoint = app.config.get('NEM_EXPLORER_ENDPOINT')

	log.info(f'loading resources from {resources_path}')
	log.info(f' configured with NETWORK_NAME {network_name}')
	log.info(f' configured with MIN_HEIGHT_CLUSTER_SIZE {min_cluster_size}')
	log.info(f' configured with SYMBOL_EXPLORER_ENDPOINT {symbol_explorer_endpoint}')
	log.info(f' configured with SYMBOL_GENERATION_HASH_SEED {symbol_generation_hash_seed}')
	log.info(f' configured with SYMBOL_BLOCK_GENERATION_TARGET_TIME {symbol_block_generation_target_time}')
	log.info(f' configured with SYMBOL_VOTING_SET_GROUPING {symbol_voting_set_grouping}')
	log.info(f' configured with NEM_EXPLORER_ENDPOINT {nem_explorer_endpoint}')

	nem_network = NetworkLocator.find_by_name(NemNetwork.NETWORKS, network_name)
	symbol_network = NetworkLocator.find_by_name(SymbolNetwork.NETWORKS, network_name)
	symbol_network.block_generation_target_time = symbol_block_generation_target_time
	symbol_network.voting_set_grouping = symbol_voting_set_grouping

	if symbol_generation_hash_seed:
		symbol_network.generation_hash_seed = Hash256(symbol_generation_hash_seed)

	nem_routes_facade = NemRoutesFacade(nem_network, nem_explorer_endpoint, min_cluster_size)
	symbol_routes_facade = SymbolRoutesFacade(symbol_network, symbol_explorer_endpoint, min_cluster_size)

	@app.route('/')
	def index():  # pylint: disable=unused-variable
		return redirect(url_for('symbol_summary'))

	@app.route('/api/openapi')
	def openapi():  # pylint: disable=unused-variable
		return send_from_directory('static/openapi', 'index.html')

	@app.route('/nem/harvesters')
	def nem_harvesters():  # pylint: disable=unused-variable
		template_name, context = nem_routes_facade.html_harvesters()
		return render_template(template_name, **context)

	@app.route('/nem/nodes')
	def nem_nodes():  # pylint: disable=unused-variable
		template_name, context = nem_routes_facade.html_nodes()
		return render_template(template_name, **context)

	@app.route('/nem/summary')
	def nem_summary():  # pylint: disable=unused-variable
		template_name, context = nem_routes_facade.html_summary()
		return render_template(template_name, **context)

	@app.route('/api/nem/nodes')
	def api_nem_nodes():  # pylint: disable=unused-variable
		return jsonify(nem_routes_facade.json_nodes(1))

	@app.route('/api/nem/chart/height')
	def api_nem_chart_height():  # pylint: disable=unused-variable
		return jsonify(nem_routes_facade.json_height_chart_with_metadata())

	@app.route('/api/nem/height')
	def api_nem_height():  # pylint: disable=unused-variable
		return jsonify(nem_routes_facade.json_height())

	@app.route('/api/nem/nodes/count')
	def api_nem_time_series_nodes_count():  # pylint: disable=unused-variable
		return jsonify(nem_routes_facade.json_time_series_nodes_count())

	@app.route('/symbol/voters')
	def symbol_voters():  # pylint: disable=unused-variable
		template_name, context = symbol_routes_facade.html_voters()
		return render_template(template_name, **context)

	@app.route('/symbol/harvesters')
	def symbol_harvesters():  # pylint: disable=unused-variable
		template_name, context = symbol_routes_facade.html_harvesters()
		return render_template(template_name, **context)

	@app.route('/symbol/nodes')
	def symbol_nodes():  # pylint: disable=unused-variable
		template_name, context = symbol_routes_facade.html_nodes()
		return render_template(template_name, **context)

	@app.route('/symbol/summary')
	def symbol_summary():  # pylint: disable=unused-variable
		template_name, context = symbol_routes_facade.html_summary()
		return render_template(template_name, **context)

	def _get_json_nodes(role, exact_match, request_args):
		only_ssl = request_args.get('only_ssl', 'false').lower() in ('', 'true')

		order = request_args.get('order', None)

		limit = int(request_args.get('limit', 0))

		return jsonify(symbol_routes_facade.json_nodes(role, exact_match=exact_match, only_ssl=only_ssl, limit=limit, order=order))

	def _get_json_node(result):
		if not result:
			abort(404)

		return jsonify(result)

	def _validate_public_key(public_key):
		try:
			PublicKey(public_key)
		except ValueError:
			abort(400)

	@app.route('/api/symbol/nodes/api')
	def api_symbol_nodes_api():  # pylint: disable=unused-variable
		return _get_json_nodes(2, True, request.args)

	@app.route('/api/symbol/nodes/peer')
	def api_symbol_nodes_peer():  # pylint: disable=unused-variable
		return _get_json_nodes(1, False, request.args)

	@app.route('/api/symbol/nodes/mainPublicKey/<main_public_key>')
	def api_symbol_nodes_get_main_public_key(main_public_key):  # pylint: disable=unused-variable
		_validate_public_key(main_public_key)

		result = symbol_routes_facade.json_node(filter_field='main_public_key', public_key=main_public_key)

		return _get_json_node(result)

	@app.route('/api/symbol/nodes/nodePublicKey/<node_public_key>')
	def api_symbol_nodes_get_node_public_key(node_public_key):  # pylint: disable=unused-variable
		_validate_public_key(node_public_key)

		result = symbol_routes_facade.json_node(filter_field='node_public_key', public_key=node_public_key)

		return _get_json_node(result)

	@app.route('/api/symbol/chart/height')
	def api_symbol_chart_height():  # pylint: disable=unused-variable
		return jsonify(symbol_routes_facade.json_height_chart_with_metadata())

	@app.route('/api/symbol/height')
	def api_symbol_height():  # pylint: disable=unused-variable
		return jsonify(symbol_routes_facade.json_height())

	@app.route('/api/symbol/nodes/count')
	def api_symbol_time_series_nodes_count():  # pylint: disable=unused-variable
		return jsonify(symbol_routes_facade.json_time_series_nodes_count())

	@app.route('/api/symbol/epoch')
	def api_symbol_epoch():  # pylint: disable=unused-variable
		return jsonify(symbol_routes_facade.json_epoch())

	@app.route('/api/symbol/network/config')
	def api_symbol_network_config():  # pylint: disable=unused-variable
		return jsonify(symbol_routes_facade.json_network_config())

	@app.context_processor
	def inject_timestamps():  # pylint: disable=unused-variable
		routes_facade = nem_routes_facade if request.path.startswith('/nem') else symbol_routes_facade
		return {
			'last_reload_time': routes_facade.last_reload_time.strftime(TIMESTAMP_FORMAT),
			'last_refresh_time': routes_facade.last_refresh_time.strftime(TIMESTAMP_FORMAT)
		}

	@app.errorhandler(400)
	def bad_request(_):
		response = {
			'status': 400,
			'message': 'Bad request'
		}
		return jsonify(response), 400

	@app.errorhandler(404)
	def not_found(_):
		response = {
			'status': 404,
			'message': 'Resource not found'
		}
		return jsonify(response), 404

	def reload_all(force=False):
		log.debug('reloading all data')
		nem_routes_facade.reload_all(resources_path, force)
		symbol_routes_facade.reload_all(resources_path, force)

	def refresh_heights():
		log.debug('refreshing heights')
		nem_routes_facade.refresh_heights()
		symbol_routes_facade.refresh_heights()

	reload_all(True)

	scheduler = BackgroundScheduler()
	scheduler.add_job(func=reload_all, trigger='interval', seconds=300)
	scheduler.add_job(func=refresh_heights, trigger='interval', seconds=30)
	scheduler.start()

	return app
