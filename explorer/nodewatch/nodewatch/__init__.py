from pathlib import Path

from apscheduler.schedulers.background import BackgroundScheduler
from flask import Flask, redirect, render_template, request, url_for
from zenlog import log

from .RoutesFacade import MIN_HEIGHT_CLUSTER_SIZE, TIMESTAMP_FORMAT, NemRoutesFacade, SymbolRoutesFacade


def create_app():
	# pylint: disable=too-many-locals

	app = Flask(__name__)
	app.config.from_envvar('NODEWATCH_SETTINGS')

	resources_path = Path(app.config.get('RESOURCES_PATH'))
	min_cluster_size = app.config.get('MIN_HEIGHT_CLUSTER_SIZE', MIN_HEIGHT_CLUSTER_SIZE)
	network_name = app.config.get('NETWORK_NAME', 'mainnet')
	log.info(f'loading resources from {resources_path}')
	log.info(f' configured with MIN_HEIGHT_CLUSTER_SIZE {min_cluster_size}')
	log.info(f' configured with NETWORK_NAME {network_name}')

	nem_routes_facade = NemRoutesFacade(min_cluster_size, network_name)
	symbol_routes_facade = SymbolRoutesFacade(min_cluster_size, network_name)

	@app.route('/')
	def index():  # pylint: disable=unused-variable
		return redirect(url_for('symbol_summary'))

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
		return nem_routes_facade.json_nodes(1)

	@app.route('/api/nem/chart/height')
	def api_nem_chart_height():  # pylint: disable=unused-variable
		return nem_routes_facade.json_height_chart_with_metadata()

	@app.route('/api/nem/height')
	def api_nem_height():  # pylint: disable=unused-variable
		return nem_routes_facade.json_height()

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

	@app.route('/api/symbol/nodes/api')
	def api_symbol_nodes_api():  # pylint: disable=unused-variable
		return symbol_routes_facade.json_nodes(2, exact_match=True)

	@app.route('/api/symbol/nodes/peer')
	def api_symbol_nodes_peer():  # pylint: disable=unused-variable
		return symbol_routes_facade.json_nodes(1)

	@app.route('/api/symbol/chart/height')
	def api_symbol_chart_height():  # pylint: disable=unused-variable
		return symbol_routes_facade.json_height_chart_with_metadata()

	@app.route('/api/symbol/height')
	def api_symbol_height():  # pylint: disable=unused-variable
		return symbol_routes_facade.json_height()

	@app.context_processor
	def inject_timestamps():  # pylint: disable=unused-variable
		routes_facade = nem_routes_facade if request.path.startswith('/nem') else symbol_routes_facade
		return {
			'last_reload_time': routes_facade.last_reload_time.strftime(TIMESTAMP_FORMAT),
			'last_refresh_time': routes_facade.last_refresh_time.strftime(TIMESTAMP_FORMAT)
		}

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
