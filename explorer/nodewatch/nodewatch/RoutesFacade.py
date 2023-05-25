import asyncio
import datetime
import random

from zenlog import log

from .chart_utils import VersionCustomizations
from .HeightChartBuilder import HeightChartBuilder
from .NetworkConnector import NetworkConnector
from .NetworkRepository import NetworkRepository
from .VersionChartBuilder import VersionChartBuilder

MIN_HEIGHT_CLUSTER_SIZE = 3
TIMESTAMP_FORMAT = '%H:%M'


class BasicRoutesFacade:
	"""Routes facade common to NEM and Symbol."""

	# pylint: disable=too-many-instance-attributes

	def __init__(
		self,
		network,
		explorer_endpoint,
		blockchain_name,
		title_blockchain_name,
		version_to_css_class,
		version_customizations,
		min_cluster_size):
		"""Creates a facade."""

		# pylint: disable=too-many-arguments

		self.explorer_endpoint = explorer_endpoint
		self.blockchain_name = blockchain_name
		self.title_name = title_blockchain_name
		if 'mainnet' != network.name:
			self.title_name += f' ({network.name.upper()})'

		self.version_to_css_class = version_to_css_class
		self.version_customizations = VersionCustomizations(version_customizations)
		self.min_cluster_size = min_cluster_size

		self.repository = NetworkRepository(network, self.blockchain_name)
		self.last_reload_time = datetime.datetime(2021, 1, 1)
		self.last_refresh_time = None

	def html_harvesters(self):
		"""Gets information for generating a harvesters HTML page."""

		return (f'{self.blockchain_name}_nodes.html', {
			'title': f'{self.title_name} Recent Harvesters',
			'descriptors': self.repository.harvester_descriptors,
			'version_to_css_class': self.version_to_css_class,
			'explorer_endpoint': self.explorer_endpoint
		})

	def html_nodes(self):
		"""Gets information for generating a nodes HTML page."""

		return (f'{self.blockchain_name}_nodes.html', {
			'title': f'{self.title_name} Nodes',
			'descriptors': self.repository.node_descriptors,
			'version_to_css_class': self.version_to_css_class,
			'explorer_endpoint': self.explorer_endpoint
		})

	def json_nodes(self, **kwargs):
		"""Returns all nodes with condition."""

		role = kwargs.get('role')
		exact_match = kwargs.get('exact_match')
		limit = kwargs.get('limit')
		only_ssl = kwargs.get('only_ssl')
		order = kwargs.get('order')

		def custom_filter(descriptor):
			role_condition = True

			if role is not None:
				role_condition = role == descriptor.roles if exact_match else role == (role & descriptor.roles)

			if only_ssl:
				ssl_condition = (descriptor.is_https_enabled and descriptor.is_wss_enabled)
				return role_condition and ssl_condition

			return role_condition

		nodes = list(map(
			lambda descriptor: descriptor.to_json(),
			filter(custom_filter, self.repository.node_descriptors)))

		if order == 'random':
			random.shuffle(nodes)

		return nodes if limit == 0 else nodes[:limit]

	def json_node(self, filter_field, public_key):
		"""Returns a node with matching public key."""

		matching_items = [item for item in self.repository.node_descriptors if str(getattr(item, filter_field)) == public_key]

		return next((item.to_json() for item in matching_items), None)

	def json_height_chart(self):
		"""Builds a JSON height chart."""

		compatible_node_descriptors = self.repository.node_descriptors
		height_builder = HeightChartBuilder(self.version_customizations, self.min_cluster_size)
		height_builder.add_heights(compatible_node_descriptors)
		height_builder.add_finalized_heights(compatible_node_descriptors)
		return height_builder.create_chart()

	def json_height_chart_with_metadata(self):
		"""Builds a JSON height chart with metadata."""

		return {
			'chartJson': self.json_height_chart(),
			'lastRefreshTime': self.last_refresh_time.strftime(TIMESTAMP_FORMAT)
		}

	def json_height(self):
		"""Gets the estimated network height."""

		return {
			'height': self.repository.estimate_height(),
			'finalizedHeight': self.repository.estimate_finalized_height()
		}

	def reload_all(self, resources_path, force=False):
		"""Reloads all descriptor files."""

		nodes_filepath = resources_path / f'{self.blockchain_name}_nodes.json'
		harvesters_filepath = resources_path / f'{self.blockchain_name}_harvesters.csv'
		voters_filepath = resources_path / f'{self.blockchain_name}_richlist.csv'
		all_filepaths = [nodes_filepath, harvesters_filepath, voters_filepath]

		# nodes.json is produced first by the network crawl, all other files are derived from it
		last_crawl_timestamp = nodes_filepath.stat().st_mtime
		last_crawl_time = datetime.datetime.utcfromtimestamp(last_crawl_timestamp)
		if self.last_reload_time >= last_crawl_time:
			log.debug(f'skipping update because crawl ({last_crawl_time}) is not newer than reload ({self.last_reload_time})')
			return False

		if not force and any(filepath.exists() and filepath.stat().st_mtime < last_crawl_timestamp for filepath in all_filepaths):
			log.debug(
				f'skipping update because some files have not been updated on disk (last crawl {last_crawl_time},'
				f' last reload {self.last_reload_time})')
			return False

		log.info(f'reloading files with crawl data from {last_crawl_time} (previous reload {self.last_reload_time})')

		self.repository.load_node_descriptors(nodes_filepath)
		self.repository.load_harvester_descriptors(harvesters_filepath)
		if voters_filepath.exists():
			self.repository.load_voter_descriptors(voters_filepath)

		self.last_reload_time = last_crawl_time
		self.last_refresh_time = self.last_reload_time
		return True

	def refresh_heights(self):
		"""Refreshes node heights from the network."""

		asyncio.run(NetworkConnector(self.blockchain_name).update_heights(self.repository.node_descriptors))
		self.reset_refresh_time()

	def reset_refresh_time(self):
		"""Sets the last refresh time to now."""

		self.last_refresh_time = datetime.datetime.utcnow()


class NemRoutesFacade(BasicRoutesFacade):
	"""NEM routes facade."""

	def __init__(self, network, explorer_endpoint, min_cluster_size=MIN_HEIGHT_CLUSTER_SIZE):
		"""Creates a facade."""

		super().__init__(network, explorer_endpoint, 'nem', 'NEM', self._version_to_css_class, {
			'0.6.101': ('#008500', 8),
			'0.6.100': ('#FF8484', 7),
			'delegating / updating': ('#FFFF6B', 6),
			'0.6.99': ('#FF6B6B', 5),
			'0.6.98': ('#FF5252', 4),
			'0.6.97-BETA': ('#FF3838', 3),
			'0.6.96-BETA': ('#FF1F1F', 2),
			'0.6.95-BETA': ('#FF0505', 1)
		}, min_cluster_size)

	def html_summary(self):
		"""Gets information for generating an HTML summary page."""

		version_builder = VersionChartBuilder(self.version_customizations)
		version_builder.add(self.repository.harvester_descriptors, 'harvesting_power', 'harvesting_count')
		version_builder.add(self.repository.node_descriptors, None, 'node_count')

		return (f'{self.blockchain_name}_summary.html', {
			'height_chart_json': self.json_height_chart(),
			'harvesting_power_chart_json': version_builder.create_chart('harvesting_power', 50),
			'harvesting_count_chart_json': version_builder.create_chart('harvesting_count'),
			'node_count_chart_json': version_builder.create_chart('node_count')
		})

	@staticmethod
	def _version_to_css_class(version):
		tag = 'danger'
		if not version:
			tag = 'warning'
		if '0.6.101' in version:
			tag = 'success'

		return tag


class SymbolRoutesFacade(BasicRoutesFacade):
	"""Symbol routes facade."""

	def __init__(self, network, explorer_endpoint, min_cluster_size=MIN_HEIGHT_CLUSTER_SIZE):
		"""Creates a facade."""

		super().__init__(network, explorer_endpoint, 'symbol', 'Symbol', self._version_to_css_class, {
			'1.0.3.5': ('#008A00', 10),
			'1.0.3.4': ('#00B300', 9),
			'delegating / updating': ('#FFFF6B', 8),
			'1.0.3.3': ('#FF0505', 7),
			'1.0.3.1': ('#EB0000', 6),
			'1.0.3.0': ('#EB0000', 5),
			'1.0.2.0': ('#D10000', 3),
			'1.0.1.0': ('#B80000', 2),
			'0.0.0.0': ('#000000', 1)
		}, min_cluster_size)

	def html_voters(self):
		"""Gets information for generating a voters HTML page."""

		return (f'{self.blockchain_name}_nodes.html', {
			'title': f'{self.title_name} Voters',
			'descriptors': [descriptor for descriptor in self.repository.voter_descriptors if descriptor.is_voting],
			'version_to_css_class': self.version_to_css_class,
			'show_voting': True,
			'explorer_endpoint': self.explorer_endpoint
		})

	def html_summary(self):
		"""Gets information for generating an HTML summary page."""

		version_builder = VersionChartBuilder(self.version_customizations)
		version_builder.add([descriptor for descriptor in self.repository.voter_descriptors if descriptor.is_voting], 'voting_power')
		version_builder.add(self.repository.harvester_descriptors, 'harvesting_power', 'harvesting_count')
		version_builder.add(self.repository.node_descriptors, None, 'node_count')

		return (f'{self.blockchain_name}_summary.html', {
			'voting_power_chart_json': version_builder.create_chart('voting_power', 67),
			'height_chart_json': self.json_height_chart(),
			'harvesting_power_chart_json': version_builder.create_chart('harvesting_power', 50),
			'harvesting_count_chart_json': version_builder.create_chart('harvesting_count'),
			'node_count_chart_json': version_builder.create_chart('node_count')
		})

	@staticmethod
	def _version_to_css_class(version):
		tag = 'danger'
		if not version:
			tag = 'warning'
		if version.startswith('1.0.3.') and not any(version.endswith(f'.{build}') for build in (0, 1, 2, 3)):
			tag = 'success'

		return tag
