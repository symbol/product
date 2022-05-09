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
            f'{self.network_name}_nodes.html',
            title=f'{self.title_network_name} Recent Harvesters',
            descriptors=self.repository.harvester_descriptors,
            version_to_css_class=self.version_to_css_class)

    def html_nodes(self):
        return render_template(
            f'{self.network_name}_nodes.html',
            title=f'{self.title_network_name} Nodes',
            descriptors=self.repository.node_descriptors,
            version_to_css_class=self.version_to_css_class)

    def json_height_chart(self):
        compatible_node_descriptors = [
            descriptor for descriptor in self.repository.node_descriptors if 'success' == self.version_to_css_class(descriptor.version)
        ]
        height_builder = HeightChartBuilder(self.version_customizations, MIN_HEIGHT_CLUSTER_SIZE)
        height_builder.add_heights(compatible_node_descriptors)
        height_builder.add_finalized_heights(compatible_node_descriptors)
        return height_builder.create_chart()

    def json_height_chart_with_metadata(self):
        return json.dumps({
            'chart_json': self.json_height_chart(),
            'last_refresh_time':  self.last_refresh_time.strftime(TIMESTAMP_FORMAT)
        })

    def json_height(self):
        return json.dumps({'height': self.repository.estimate_height()})

    def reload_all(self, resources_path):
        nodes_filepath = resources_path / f'{self.network_name}_nodes.json'
        harvesters_filepath = resources_path / f'{self.network_name}_harvesters.csv'
        voters_filepath = resources_path / f'{self.network_name}_richlist.csv'
        all_filepaths = [nodes_filepath, harvesters_filepath, voters_filepath]

        # nodes.json is produced by the network crawl, all other files are derived from it
        last_crawl_timestamp = nodes_filepath.stat().st_mtime
        last_crawl_time = datetime.datetime.utcfromtimestamp(last_crawl_timestamp)
        if self.last_reload_time >= last_crawl_time:
            log.debug(f'skipping update because crawl ({last_crawl_time}) is not newer than reload ({self.last_reload_time})')
            return

        if any(filepath.exists() and filepath.stat().st_mtime < last_crawl_timestamp for filepath in all_filepaths):
            log.debug(f'skipping update because some files have not been updated on disk (last crawl {last_crawl_time},'
                      f' last reload {self.last_reload_time})')
            return

        log.info(f'reloading files with crawl data from {last_crawl_time} (previous reload {self.last_reload_time})')

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
            '0.6.100': ('#008500', 7),
            'delegating / updating': ('#FFFF6B', 6),
            '0.6.99': ('#FF6B6B', 5),
            '0.6.98': ('#FF5252', 4),
            '0.6.97-BETA': ('#FF3838', 3),
            '0.6.96-BETA': ('#FF1F1F', 2),
            '0.6.95-BETA': ('#FF0505', 1)
        })

    def html_summary(self):
        version_builder = VersionChartBuilder(self.version_customizations)
        version_builder.add(self.repository.harvester_descriptors, 'harvesting_power', 'harvesting_count')
        version_builder.add(self.repository.node_descriptors, None, 'node_count')

        return render_template(
            f'{self.network_name}_summary.html',
            height_chart_json=self.json_height_chart(),
            harvesting_power_chart_json=version_builder.create_chart('harvesting_power', 50),
            harvesting_count_chart_json=version_builder.create_chart('harvesting_count'),
            node_count_chart_json=version_builder.create_chart('node_count'))

    @staticmethod
    def _version_to_css_class(version):
        tag = 'danger'
        if not version:
            tag = 'warning'
        if '0.6.100' in version:
            tag = 'success'

        return tag


class SymbolRoutesFacade(BasicRoutesFacade):
    def __init__(self):
        super().__init__('symbol', 'Symbol', self._version_to_css_class, {
            '1.0.3.3': ('#008A00', 7),
            '1.0.3.1': ('#00B300', 6),
            '1.0.3.0': ('#00D600', 5),
            'delegating / updating': ('#FFFF6B', 4),
            '1.0.2.0': ('#FF1F1F', 3),
            '1.0.1.0': ('#FF0505', 2),
            '0.0.0.0': ('#000000', 1)
        })

    def html_voters(self):
        return render_template(
            f'{self.network_name}_nodes.html',
            title=f'{self.title_network_name} Voters',
            descriptors=[descriptor for descriptor in self.repository.voter_descriptors if descriptor.is_voting],
            version_to_css_class=self.version_to_css_class,
            show_voting=True)

    def html_summary(self):
        version_builder = VersionChartBuilder(self.version_customizations)
        version_builder.add([descriptor for descriptor in self.repository.voter_descriptors if descriptor.is_voting], 'voting_power')
        version_builder.add(self.repository.harvester_descriptors, 'harvesting_power', 'harvesting_count')
        version_builder.add(self.repository.node_descriptors, None, 'node_count')

        return render_template(
            f'{self.network_name}_summary.html',
            height_chart_json=self.json_height_chart(),
            voting_power_chart_json=version_builder.create_chart('voting_power', 67),
            harvesting_power_chart_json=version_builder.create_chart('harvesting_power'),
            harvesting_count_chart_json=version_builder.create_chart('harvesting_count'),
            node_count_chart_json=version_builder.create_chart('node_count'))

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
    log.info(f'loading resources from {resources_path}')

    nem_routes_facade = NemRoutesFacade()
    symbol_routes_facade = SymbolRoutesFacade()

    @app.route('/')
    def index():  # pylint: disable=unused-variable
        return redirect(url_for('symbol_summary'))

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
