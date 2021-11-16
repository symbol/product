from pathlib import Path

from apscheduler.schedulers.background import BackgroundScheduler
from flask import Flask, redirect, render_template, url_for
from zenlog import log

from .HeightChartBuilder import HeightChartBuilder
from .NetworkConnector import NetworkConnector
from .NetworkRepository import NetworkRepository
from .VersionChartBuilder import VersionChartBuilder


def nem_version_to_css_class(version):
    tag = 'danger'
    if not version:
        tag = 'warning'
    if '0.6.98' in version or '0.6.99' in version:
        tag = 'success'

    return tag


def symbol_version_to_css_class(version):
    tag = 'danger'
    if not version:
        tag = 'warning'
    if '1.0.3.0' == version:
        tag = 'success'

    return tag


def create_app():
    # pylint: disable=too-many-locals

    app = Flask(__name__)
    app.config.from_envvar('NODEWATCH_SETTINGS')

    resources_path = Path(app.config.get('RESOURCES_PATH'))
    log.info('loading resources from {}'.format(resources_path))

    nem_repository = NetworkRepository('nem')
    symbol_repository = NetworkRepository('symbol')

    @app.route('/')
    def index():  # pylint: disable=unused-variable
        return redirect(url_for('nem_summary'))

    # region nem routes

    @app.route('/nem/harvesters')
    def nem_harvesters():  # pylint: disable=unused-variable
        return render_template(
            'nem_nodes.html',
            title='NEM Recent Harvesters',
            descriptors=nem_repository.harvester_descriptors,
            version_to_css_class=nem_version_to_css_class)

    @app.route('/nem/nodes')
    def nem_nodes():  # pylint: disable=unused-variable
        return render_template(
            'nem_nodes.html',
            title='NEM Nodes',
            descriptors=nem_repository.node_descriptors,
            version_to_css_class=nem_version_to_css_class)

    @app.route('/nem/summary')
    def nem_summary():  # pylint: disable=unused-variable
        height_builder = HeightChartBuilder()
        height_builder.add(nem_repository.node_descriptors, 'height', 'height')

        version_builder = VersionChartBuilder({
            '0.6.99': ('#006400', 1),
            '0.6.98': ('#008000', 2),
            '0.6.98-BETA': ('#2E8B57', 3),
            'delegating / updating': ('#FCFFA4', 4),
            '0.6.97-BETA': ('#DC143C', 5),
            '0.6.96-BETA': ('#FF4500', 6),
            '0.6.95-BETA': ('#FF0000', 7)
        })
        version_builder.add(nem_repository.harvester_descriptors, 'harvesting_power', 'harvesting_count')
        version_builder.add(nem_repository.node_descriptors, None, 'node_count')

        return render_template(
            'nem_summary.html',
            height_chart_json=height_builder.create_chart(),
            harvesting_power_chart_json=version_builder.create_chart('harvesting_power', 0.5),
            harvesting_count_chart_json=version_builder.create_chart('harvesting_count'),
            node_count_chart_json=version_builder.create_chart('node_count'))

    @app.route('/nem/height')
    def nem_height():  # pylint: disable=unused-variable
        return NetworkConnector('nem').get_height(nem_repository.node_descriptors)

    # endregion

    # region symbol routes

    @app.route('/symbol/voters')
    def symbol_voters():  # pylint: disable=unused-variable
        return render_template(
            'symbol_nodes.html',
            title='Symbol Voters',
            descriptors=[descriptor for descriptor in symbol_repository.voter_descriptors if descriptor.is_voting],
            version_to_css_class=symbol_version_to_css_class,
            show_voting=True)

    @app.route('/symbol/harvesters')
    def symbol_harvesters():  # pylint: disable=unused-variable
        return render_template(
            'symbol_nodes.html',
            title='Symbol Recent Harvesters',
            descriptors=symbol_repository.harvester_descriptors,
            version_to_css_class=symbol_version_to_css_class)

    @app.route('/symbol/nodes')
    def symbol_nodes():  # pylint: disable=unused-variable
        return render_template(
            'symbol_nodes.html',
            title='Symbol Nodes',
            descriptors=symbol_repository.node_descriptors,
            version_to_css_class=symbol_version_to_css_class)

    @app.route('/symbol/summary')
    def symbol_summary():  # pylint: disable=unused-variable
        height_builder = HeightChartBuilder()
        height_builder.add(symbol_repository.node_descriptors, 'height', 'height')
        height_builder.add(symbol_repository.node_descriptors, 'finalized_height', 'finalized height')

        version_builder = VersionChartBuilder({
            '1.0.3.0': ('#006400', 1),
            'delegating / updating': ('#FCFFA4', 2),
            '1.0.2.0': ('#DC143C', 3),
            '1.0.1.0': ('#FF4500', 4),
            '0.0.0.0': ('#FF0000', 5)
        })
        version_builder.add([descriptor for descriptor in symbol_repository.voter_descriptors if descriptor.is_voting], 'voting_power')
        version_builder.add(symbol_repository.harvester_descriptors, 'harvesting_power', 'harvesting_count')
        version_builder.add(symbol_repository.node_descriptors, None, 'node_count')

        return render_template(
            'symbol_summary.html',
            height_chart_json=height_builder.create_chart(),
            voting_power_chart_json=version_builder.create_chart('voting_power', 0.67),
            harvesting_power_chart_json=version_builder.create_chart('harvesting_power'),
            harvesting_count_chart_json=version_builder.create_chart('harvesting_count'),
            node_count_chart_json=version_builder.create_chart('node_count'))

    @app.route('/symbol/height')
    def symbol_height():  # pylint: disable=unused-variable
        return NetworkConnector('symbol').get_height(symbol_repository.node_descriptors)

    # endregion

    def reload_all():
        log.debug('reloading all data')

        nem_repository.load_node_descriptors(resources_path / 'nem_nodes.json')
        nem_repository.load_harvester_descriptors(resources_path / 'nem_harvesters.csv')

        symbol_repository.load_node_descriptors(resources_path / 'symbol_nodes.json')
        symbol_repository.load_harvester_descriptors(resources_path / 'symbol_harvesters.csv')
        symbol_repository.load_voter_descriptors(resources_path / 'symbol_richlist.csv')

    reload_all()

    scheduler = BackgroundScheduler()
    scheduler.add_job(func=reload_all, trigger='interval', seconds=300)
    scheduler.start()

    return app
