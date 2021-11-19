import datetime
import json
from pathlib import Path

from apscheduler.schedulers.background import BackgroundScheduler
from flask import Flask, redirect, render_template, request, url_for
from zenlog import log

from .chart_utils import VersionCustomizations
from .HeightChartBuilder import HeightChartBuilder
from .NetworkConnector import NetworkConnector
from .NetworkRepository import NetworkRepository
from .VersionChartBuilder import VersionChartBuilder

MIN_HEIGHT_CLUSTER_SIZE = 3
TIMESTAMP_FORMAT = '%H:%M'


# region routes facades

class BasicRoutesFacade:
    def __init__(self, network_name, title_network_name, version_to_css_class, version_customizations):
        self.network_name = network_name
        self.title_network_name = title_network_name
        self.version_to_css_class = version_to_css_class
        self.version_customizations = VersionCustomizations(version_customizations)

        self.repository = NetworkRepository(self.network_name)
        self.last_reload_time = datetime.datetime(2021, 1, 1)
        self.last_refresh_time = None

    def html_harvesters(self):
        return render_template(
            '{}_nodes.html'.format(self.network_name),
            title='{} Recent Harvesters'.format(self.title_network_name),
            descriptors=self.repository.harvester_descriptors,
            version_to_css_class=self.version_to_css_class)

    def html_nodes(self):
        return render_template(
            '{}_nodes.html'.format(self.network_name),
            title='{} Nodes'.format(self.title_network_name),
            descriptors=self.repository.node_descriptors,
            version_to_css_class=self.version_to_css_class)

    def json_height_chart(self):
        height_builder = HeightChartBuilder(self.version_customizations, MIN_HEIGHT_CLUSTER_SIZE)
        height_builder.add_heights(self.repository.node_descriptors)
        height_builder.add_finalized_heights(self.repository.node_descriptors)
        return height_builder.create_chart()

    def json_height_chart_with_metadata(self):
        return json.dumps({
            'chart_json': self.json_height_chart(),
            'last_refresh_time':  self.last_refresh_time.strftime(TIMESTAMP_FORMAT)
        })

    def json_height(self):
        return json.dumps({'height': self.repository.estimate_height()})

    def reload_all(self, resources_path):
        nodes_filepath = resources_path / '{}_nodes.json'.format(self.network_name)
        harvesters_filepath = resources_path / '{}_harvesters.csv'.format(self.network_name)
        voters_filepath = resources_path / '{}_richlist.csv'.format(self.network_name)
        all_filepaths = [nodes_filepath, harvesters_filepath, voters_filepath]

        # nodes.json is produced by the network crawl, all other files are derived from it
        last_crawl_timestamp = nodes_filepath.stat().st_mtime
        last_crawl_time = datetime.datetime.utcfromtimestamp(last_crawl_timestamp)
        if self.last_reload_time >= last_crawl_time:
            log.debug('skipping update because crawl ({}) is not newer than reload ({})'.format(
                last_crawl_time,
                self.last_reload_time))
            return

        if any(filepath.exists() and filepath.stat().st_mtime < last_crawl_timestamp for filepath in all_filepaths):
            log.debug('skipping update because some files have not been updated on disk (last crawl {}, last reload {})'.format(
                last_crawl_time,
                self.last_reload_time))
            return

        log.info('reloading files with crawl data from {} (previous reload {})'.format(last_crawl_time, self.last_reload_time))

        self.repository.load_node_descriptors(nodes_filepath)
        self.repository.load_harvester_descriptors(harvesters_filepath)
        if voters_filepath.exists():
            self.repository.load_voter_descriptors(voters_filepath)

        self.last_reload_time = last_crawl_time
        self.last_refresh_time = self.last_reload_time

    def refresh_heights(self):
        NetworkConnector(self.network_name).update_heights(self.repository.node_descriptors)
        self.last_refresh_time = datetime.datetime.utcnow()


class NemRoutesFacade(BasicRoutesFacade):
    def __init__(self):
        super().__init__('nem', 'NEM', self._version_to_css_class, {
            '0.6.99': ('#006400', 7),
            '0.6.98': ('#008000', 6),
            '0.6.98-BETA': ('#2E8B57', 5),
            'delegating / updating': ('#FCFFA4', 4),
            '0.6.97-BETA': ('#DC143C', 3),
            '0.6.96-BETA': ('#FF4500', 2),
            '0.6.95-BETA': ('#FF0000', 1)
        })

    def html_summary(self):
        version_builder = VersionChartBuilder(self.version_customizations)
        version_builder.add(self.repository.harvester_descriptors, 'harvesting_power', 'harvesting_count')
        version_builder.add(self.repository.node_descriptors, None, 'node_count')

        return render_template(
            '{}_summary.html'.format(self.network_name),
            height_chart_json=self.json_height_chart(),
            harvesting_power_chart_json=version_builder.create_chart('harvesting_power', 0.5),
            harvesting_count_chart_json=version_builder.create_chart('harvesting_count'),
            node_count_chart_json=version_builder.create_chart('node_count'))

    @staticmethod
    def _version_to_css_class(version):
        tag = 'danger'
        if not version:
            tag = 'warning'
        if '0.6.98' in version or '0.6.99' in version:
            tag = 'success'

        return tag


class SymbolRoutesFacade(BasicRoutesFacade):
    def __init__(self):
        super().__init__('symbol', 'Symbol', self._version_to_css_class, {
            '1.0.3.1': ('#006400', 6),
            '1.0.3.0': ('#008000', 5),
            'delegating / updating': ('#FCFFA4', 4),
            '1.0.2.0': ('#DC143C', 3),
            '1.0.1.0': ('#FF4500', 2),
            '0.0.0.0': ('#FF0000', 1)
        })

    def html_voters(self):
        return render_template(
            '{}_nodes.html'.format(self.network_name),
            title='{} Voters'.format(self.title_network_name),
            descriptors=[descriptor for descriptor in self.repository.voter_descriptors if descriptor.is_voting],
            version_to_css_class=self.version_to_css_class,
            show_voting=True)

    def html_summary(self):
        version_builder = VersionChartBuilder(self.version_customizations)
        version_builder.add([descriptor for descriptor in self.repository.voter_descriptors if descriptor.is_voting], 'voting_power')
        version_builder.add(self.repository.harvester_descriptors, 'harvesting_power', 'harvesting_count')
        version_builder.add(self.repository.node_descriptors, None, 'node_count')

        return render_template(
            '{}_summary.html'.format(self.network_name),
            cyprus_height_chart_json=self.json_height_chart_cyprus(),
            height_chart_json=self.json_height_chart(),
            voting_power_chart_json=version_builder.create_chart('voting_power', 0.67),
            harvesting_power_chart_json=version_builder.create_chart('harvesting_power'),
            harvesting_count_chart_json=version_builder.create_chart('harvesting_count'),
            node_count_chart_json=version_builder.create_chart('node_count'))

    def json_height_chart_cyprus(self):
        cyprus_node_descriptors = [
            descriptor for descriptor in self.repository.node_descriptors if 'success' == self.version_to_css_class(descriptor.version)
        ]
        cyprus_height_builder = HeightChartBuilder(self.version_customizations, MIN_HEIGHT_CLUSTER_SIZE)
        cyprus_height_builder.add_heights(cyprus_node_descriptors)
        cyprus_height_builder.add_finalized_heights(cyprus_node_descriptors)
        return cyprus_height_builder.create_chart()

    @staticmethod
    def _version_to_css_class(version):
        tag = 'danger'
        if not version:
            tag = 'warning'
        if version.startswith('1.0.3.'):
            tag = 'success'

        return tag


# endregion

# region app

def create_app():
    # pylint: disable=too-many-locals

    app = Flask(__name__)
    app.config.from_envvar('NODEWATCH_SETTINGS')

    resources_path = Path(app.config.get('RESOURCES_PATH'))
    log.info('loading resources from {}'.format(resources_path))

    nem_routes_facade = NemRoutesFacade()
    symbol_routes_facade = SymbolRoutesFacade()

    @app.route('/')
    def index():  # pylint: disable=unused-variable
        return redirect(url_for('nem_summary'))

    @app.route('/nem/harvesters')
    def nem_harvesters():  # pylint: disable=unused-variable
        return nem_routes_facade.html_harvesters()

    @app.route('/nem/nodes')
    def nem_nodes():  # pylint: disable=unused-variable
        return nem_routes_facade.html_nodes()

    @app.route('/nem/summary')
    def nem_summary():  # pylint: disable=unused-variable
        return nem_routes_facade.html_summary()

    @app.route('/nem/chart/height')
    def nem_chart_height():  # pylint: disable=unused-variable
        return nem_routes_facade.json_height_chart_with_metadata()

    @app.route('/nem/height')
    def nem_height():  # pylint: disable=unused-variable
        return nem_routes_facade.json_height()

    @app.route('/symbol/voters')
    def symbol_voters():  # pylint: disable=unused-variable
        return symbol_routes_facade.html_voters()

    @app.route('/symbol/harvesters')
    def symbol_harvesters():  # pylint: disable=unused-variable
        return symbol_routes_facade.html_harvesters()

    @app.route('/symbol/nodes')
    def symbol_nodes():  # pylint: disable=unused-variable
        return symbol_routes_facade.html_nodes()

    @app.route('/symbol/summary')
    def symbol_summary():  # pylint: disable=unused-variable
        return symbol_routes_facade.html_summary()

    @app.route('/symbol/chart/height-cyprus')
    def symbol_chart_height_cyprus():  # pylint: disable=unused-variable
        return symbol_routes_facade.json_height_chart_cyprus()

    @app.route('/symbol/chart/height')
    def symbol_chart_height():  # pylint: disable=unused-variable
        return symbol_routes_facade.json_height_chart_with_metadata()

    @app.route('/symbol/height')
    def symbol_height():  # pylint: disable=unused-variable
        return symbol_routes_facade.json_height()

    @app.context_processor
    def inject_timestamps():  # pylint: disable=unused-variable
        routes_facade = nem_routes_facade if request.path.startswith('/nem') else symbol_routes_facade
        return dict(
            last_reload_time=routes_facade.last_reload_time.strftime(TIMESTAMP_FORMAT),
            last_refresh_time=routes_facade.last_refresh_time.strftime(TIMESTAMP_FORMAT))

    def reload_all():
        log.debug('reloading all data')
        nem_routes_facade.reload_all(resources_path)
        symbol_routes_facade.reload_all(resources_path)

    def refresh_heights():
        log.debug('refreshing heights')
        nem_routes_facade.refresh_heights()
        symbol_routes_facade.refresh_heights()

    reload_all()

    scheduler = BackgroundScheduler()
    scheduler.add_job(func=reload_all, trigger='interval', seconds=300)
    scheduler.add_job(func=refresh_heights, trigger='interval', seconds=30)
    scheduler.start()

    return app

# endregion
