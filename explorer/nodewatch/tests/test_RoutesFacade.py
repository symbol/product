import datetime
import json
import re
import unittest
from pathlib import Path

from nodewatch.RoutesFacade import NemRoutesFacade, SymbolRoutesFacade


def _get_names(descriptors):
	return [descriptor.name for descriptor in descriptors]


def _map_version_to_css_class(facade_class, version):
	return facade_class._version_to_css_class(version)  # pylint: disable=protected-access


class NemRoutesFacadeTest(unittest.TestCase):
	# region reload / refresh

	def test_can_reload_all(self):
		# Arrange:
		facade = NemRoutesFacade()

		# Act:
		result = facade.reload_all(Path('tests/resources'), True)

		# Assert:
		self.assertEqual(True, result)
		self.assertEqual(facade.last_reload_time, facade.last_refresh_time)

		self.assertEqual(4, len(facade.repository.node_descriptors))
		self.assertEqual(4, len(facade.repository.harvester_descriptors))
		self.assertEqual(None, facade.repository.voter_descriptors)

	def test_can_skip_reload_when_noop(self):
		# Arrange:
		facade = NemRoutesFacade()

		# Act:
		result1 = facade.reload_all(Path('tests/resources'), True)
		result2 = facade.reload_all(Path('tests/resources'), True)
		result3 = facade.reload_all(Path('tests/resources'))

		# Assert:
		self.assertEqual([True, False, False], [result1, result2, result3])
		self.assertEqual(facade.last_reload_time, facade.last_refresh_time)

		self.assertEqual(4, len(facade.repository.node_descriptors))
		self.assertEqual(4, len(facade.repository.harvester_descriptors))
		self.assertEqual(None, facade.repository.voter_descriptors)

	def test_can_reset_refresh_time(self):
		# Arrange:
		facade = NemRoutesFacade()
		facade.last_refresh_time = None

		# Act:
		facade.reset_refresh_time()

		# Assert:
		now = datetime.datetime.utcnow()
		self.assertGreaterEqual(1, (now - facade.last_refresh_time).seconds)

	# endregion

	# region html

	def test_can_render_harvesters_html(self):
		# Arrange:
		facade = NemRoutesFacade()
		facade.reload_all(Path('tests/resources'), True)

		# Act:
		template_name, context = facade.html_harvesters()

		# Assert:
		self.assertEqual('nem_nodes.html', template_name)
		self.assertEqual(3, len(context))
		self.assertEqual('NEM Recent Harvesters', context['title'])
		self.assertEqual(['Allnodes21', 'TIME', '', 'Hi, I am Alice7'], _get_names(context['descriptors']))
		self.assertIsNotNone(context['version_to_css_class'])

	def test_can_render_nodes_html(self):
		# Arrange:
		facade = NemRoutesFacade()
		facade.reload_all(Path('tests/resources'), True)

		# Act:
		template_name, context = facade.html_nodes()

		# Assert:
		self.assertEqual('nem_nodes.html', template_name)
		self.assertEqual(3, len(context))
		self.assertEqual('NEM Nodes', context['title'])
		self.assertEqual(['August', '[c=#e9c086]jusan[/c]', 'cobalt', 'silicon'], _get_names(context['descriptors']))
		self.assertIsNotNone(context['version_to_css_class'])

	def test_can_render_summary_html(self):
		# Arrange:
		facade = NemRoutesFacade(1)
		facade.reload_all(Path('tests/resources'), True)

		# Act:
		template_name, context = facade.html_summary()

		# Assert:
		self.assertEqual('nem_summary.html', template_name)
		self.assertEqual(4, len(context))
		self.assertEqual(1, len(json.loads(context['height_chart_json'])['data']))  # { height } x { 0.6.100 }
		self.assertEqual(3, len(json.loads(context['harvesting_power_chart_json'])['data']))  # 0.6.100, '', 0.6.99
		self.assertEqual(3, len(json.loads(context['harvesting_count_chart_json'])['data']))  # 0.6.100, '', 0.6.99
		self.assertEqual(3, len(json.loads(context['node_count_chart_json'])['data']))  # 0.6.100, '', 0.6.99

	# endregion

	# region json

	def test_can_generate_nodes_json(self):
		# Arrange:
		facade = NemRoutesFacade()
		facade.reload_all(Path('tests/resources'), True)

		# Act:
		node_descriptors = json.loads(facade.json_nodes(1))

		# Assert: spot check names and roles
		self.assertEqual(4, len(node_descriptors))
		self.assertEqual(
			['August', '[c=#e9c086]jusan[/c]', 'cobalt', 'silicon'],
			list(map(lambda descriptor: descriptor['name'], node_descriptors)))
		self.assertEqual(
			[0xFF, 0xFF, 0xFF, 0xFF],
			list(map(lambda descriptor: descriptor['roles'], node_descriptors)))

	def test_can_generate_height_chart_json(self):
		# Arrange:
		facade = NemRoutesFacade(1)
		facade.reload_all(Path('tests/resources'), True)

		# Act:
		chart_json = json.loads(facade.json_height_chart())

		# Assert: { height } x { 0.6.100 }
		self.assertEqual(1, len(chart_json['data']))

	def test_can_generate_height_chart_with_metadata_json(self):
		# Arrange:
		facade = NemRoutesFacade(1)
		facade.reload_all(Path('tests/resources'), True)

		# Act:
		chart_with_metadata_json = json.loads(facade.json_height_chart_with_metadata())
		chart_json = json.loads(chart_with_metadata_json['chartJson'])

		# Assert: { height } x { 0.6.100 }
		self.assertEqual(2, len(chart_with_metadata_json))
		self.assertEqual(1, len(chart_json['data']))
		self.assertTrue(re.match(r'\d\d:\d\d', chart_with_metadata_json['lastRefreshTime']))

	def test_can_retrieve_estimated_network_height_json(self):
		# Arrange:
		facade = NemRoutesFacade()
		facade.reload_all(Path('tests/resources'), True)

		# Act:
		height_json = json.loads(facade.json_height())

		# Assert:
		self.assertEqual(1, len(height_json))
		self.assertEqual(3850057, height_json['height'])

	# endregion

	# region utils

	def test_can_map_version_to_css_class(self):
		self.assertEqual('success', _map_version_to_css_class(NemRoutesFacade, '0.6.100'))
		self.assertEqual('warning', _map_version_to_css_class(NemRoutesFacade, ''))
		for version in ['0.6.99', '0.6.98', '0.6.97-BETA', '0.6.96-BETA', '0.6.95-BETA']:
			self.assertEqual('danger', _map_version_to_css_class(NemRoutesFacade, version))

	# endregion


class SymbolRoutesFacadeTest(unittest.TestCase):
	# region reload / refresh

	def test_can_reload_all(self):
		# Arrange:
		facade = SymbolRoutesFacade()

		# Act:
		result = facade.reload_all(Path('tests/resources'), True)

		# Assert:
		self.assertEqual(True, result)
		self.assertEqual(facade.last_reload_time, facade.last_refresh_time)

		self.assertEqual(5, len(facade.repository.node_descriptors))
		self.assertEqual(4, len(facade.repository.harvester_descriptors))
		self.assertEqual(4, len(facade.repository.voter_descriptors))

	def test_can_skip_reload_when_noop(self):
		# Arrange:
		facade = SymbolRoutesFacade()

		# Act:
		result1 = facade.reload_all(Path('tests/resources'), True)
		result2 = facade.reload_all(Path('tests/resources'), True)
		result3 = facade.reload_all(Path('tests/resources'))

		# Assert:
		self.assertEqual([True, False, False], [result1, result2, result3])
		self.assertEqual(facade.last_reload_time, facade.last_refresh_time)

		self.assertEqual(5, len(facade.repository.node_descriptors))
		self.assertEqual(4, len(facade.repository.harvester_descriptors))
		self.assertEqual(4, len(facade.repository.voter_descriptors))

	def test_can_reset_refresh_time(self):
		# Arrange:
		facade = SymbolRoutesFacade()
		facade.last_refresh_time = None

		# Act:
		facade.reset_refresh_time()

		# Assert:
		now = datetime.datetime.utcnow()
		self.assertGreaterEqual(1, (now - facade.last_refresh_time).seconds)

	# endregion

	# region html

	def test_can_render_harvesters_html(self):
		# Arrange:
		facade = SymbolRoutesFacade()
		facade.reload_all(Path('tests/resources'), True)

		# Act:
		template_name, context = facade.html_harvesters()

		# Assert:
		self.assertEqual('symbol_nodes.html', template_name)
		self.assertEqual(3, len(context))
		self.assertEqual('Symbol Recent Harvesters', context['title'])
		self.assertEqual(['jaguar', '(Max50)SN1.MSUS', '', 'Allnodes900'], _get_names(context['descriptors']))
		self.assertIsNotNone(context['version_to_css_class'])

	def test_can_render_nodes_html(self):
		# Arrange:
		facade = SymbolRoutesFacade()
		facade.reload_all(Path('tests/resources'), True)

		# Act:
		template_name, context = facade.html_nodes()

		# Assert:
		self.assertEqual('symbol_nodes.html', template_name)
		self.assertEqual(3, len(context))
		self.assertEqual('Symbol Nodes', context['title'])
		self.assertEqual(
			['Allnodes250', 'Shin-Kuma-Node', 'ibone74', 'jaguar', 'symbol.ooo maxUnlockedAccounts:100'],
			_get_names(context['descriptors']))
		self.assertIsNotNone(context['version_to_css_class'])

	def test_can_render_voters_html(self):
		# Arrange:
		facade = SymbolRoutesFacade()
		facade.reload_all(Path('tests/resources'), True)

		# Act:
		template_name, context = facade.html_voters()

		# Assert:
		self.assertEqual('symbol_nodes.html', template_name)
		self.assertEqual(4, len(context))
		self.assertEqual('Symbol Voters', context['title'])
		self.assertEqual(['59026DB', 'Allnodes34'], _get_names(context['descriptors']))
		self.assertIsNotNone(context['version_to_css_class'])
		self.assertTrue(context['show_voting'])

	def test_can_render_summary_html(self):
		# Arrange:
		facade = SymbolRoutesFacade(1)
		facade.reload_all(Path('tests/resources'), True)

		# Act:
		template_name, context = facade.html_summary()

		# Assert:
		self.assertEqual('symbol_summary.html', template_name)
		self.assertEqual(5, len(context))
		self.assertEqual(4, len(json.loads(context['height_chart_json'])['data']))  # { height, finalized_height } x { 1.0.3.5, 1.0.3.4 }
		self.assertEqual(3, len(json.loads(context['voting_power_chart_json'])['data']))  # 1.0.3.5, 1.0.3.4, ''
		self.assertEqual(3, len(json.loads(context['harvesting_power_chart_json'])['data']))  # 1.0.3.5, 1.0.3.4, ''
		self.assertEqual(3, len(json.loads(context['harvesting_count_chart_json'])['data']))  # 1.0.3.5, 1.0.3.4, ''
		self.assertEqual(3, len(json.loads(context['node_count_chart_json'])['data']))  # 1.0.3.5, 1.0.3.4, ''

	# endregion

	# region json

	def test_can_generate_nodes_json(self):
		# Arrange:
		facade = SymbolRoutesFacade()
		facade.reload_all(Path('tests/resources'), True)

		# Act:
		node_descriptors = json.loads(facade.json_nodes(1))

		# Assert: spot check names and roles
		self.assertEqual(4, len(node_descriptors))
		self.assertEqual(
			['Shin-Kuma-Node', 'ibone74', 'jaguar', 'symbol.ooo maxUnlockedAccounts:100'],
			list(map(lambda descriptor: descriptor['name'], node_descriptors)))
		self.assertEqual(
			[3, 3, 5, 3],
			list(map(lambda descriptor: descriptor['roles'], node_descriptors)))

	def test_can_generate_nodes_json_filtered(self):
		# Arrange:
		facade = SymbolRoutesFacade()
		facade.reload_all(Path('tests/resources'), True)

		# Act: select nodes with api role (role 2)
		node_descriptors = json.loads(facade.json_nodes(2))

		# Assert: spot check names and roles
		self.assertEqual(4, len(node_descriptors))
		self.assertEqual(
			['Allnodes250', 'Shin-Kuma-Node', 'ibone74', 'symbol.ooo maxUnlockedAccounts:100'],
			list(map(lambda descriptor: descriptor['name'], node_descriptors)))
		self.assertEqual(
			[2, 3, 3, 3],
			list(map(lambda descriptor: descriptor['roles'], node_descriptors)))

	def test_can_generate_nodes_json_filtered_exact_match(self):
		# Arrange:
		facade = SymbolRoutesFacade()
		facade.reload_all(Path('tests/resources'), True)

		# Act: select nodes with only api role (role 2)
		node_descriptors = json.loads(facade.json_nodes(2, True))

		# Assert: spot check names and roles
		self.assertEqual(1, len(node_descriptors))
		self.assertEqual(
			['Allnodes250'],
			list(map(lambda descriptor: descriptor['name'], node_descriptors)))
		self.assertEqual(
			[2],
			list(map(lambda descriptor: descriptor['roles'], node_descriptors)))

	def test_can_generate_height_chart_json(self):
		# Arrange:
		facade = SymbolRoutesFacade(1)
		facade.reload_all(Path('tests/resources'), True)

		# Act:
		chart_json = json.loads(facade.json_height_chart())

		# Assert: { height, finalized_height } x { 1.0.3.4, 1.0.3.5 }
		self.assertEqual(4, len(chart_json['data']))

	def test_can_generate_height_chart_with_metadata_json(self):
		# Arrange:
		facade = SymbolRoutesFacade(1)
		facade.reload_all(Path('tests/resources'), True)

		# Act:
		chart_with_metadata_json = json.loads(facade.json_height_chart_with_metadata())
		chart_json = json.loads(chart_with_metadata_json['chartJson'])

		# Assert: { height, finalized_height } x { 1.0.3.4, 1.0.3.5 }
		self.assertEqual(2, len(chart_with_metadata_json))
		self.assertEqual(4, len(chart_json['data']))
		self.assertTrue(re.match(r'\d\d:\d\d', chart_with_metadata_json['lastRefreshTime']))

	def test_can_retrieve_estimated_network_height_json(self):
		# Arrange:
		facade = SymbolRoutesFacade()
		facade.reload_all(Path('tests/resources'), True)

		# Act:
		height_json = json.loads(facade.json_height())

		# Assert:
		self.assertEqual(1, len(height_json))
		self.assertEqual(1486760, height_json['height'])

	# endregion

	# region utils

	def test_can_map_version_to_css_class(self):
		for version in ['1.0.3.6', '1.0.3.5', '1.0.3.4']:
			self.assertEqual('success', _map_version_to_css_class(SymbolRoutesFacade, version))

		self.assertEqual('warning', _map_version_to_css_class(SymbolRoutesFacade, ''))

		for version in ['1.0.3.3', '1.0.3.1', '1.0.3.0', '1.0.2.0', '1.0.1.0', '0.0.0.0']:
			self.assertEqual('danger', _map_version_to_css_class(SymbolRoutesFacade, version))

	# endregion
