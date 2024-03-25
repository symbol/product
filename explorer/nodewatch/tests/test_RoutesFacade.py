import datetime
import json
import re
import unittest
from pathlib import Path

from symbolchain.nem.Network import Network as NemNetwork
from symbolchain.symbol.Network import Network as SymbolNetwork

from nodewatch.RoutesFacade import NemRoutesFacade, SymbolRoutesFacade


def _get_names(descriptors):
	return [descriptor.name for descriptor in descriptors]


def _get_network_bytes(descriptors):
	return [descriptor.main_address.bytes[0] for descriptor in descriptors]


def _map_version_to_css_class(facade_class, version):
	return facade_class._version_to_css_class(version)  # pylint: disable=protected-access


class NemRoutesFacadeTest(unittest.TestCase):
	# region reload / refresh

	def test_can_reload_all(self):
		# Arrange:
		facade = NemRoutesFacade(NemNetwork.MAINNET, '<nem_explorer>')

		# Act:
		result = facade.reload_all(Path('tests/resources'), True)

		# Assert:
		self.assertEqual(True, result)
		self.assertEqual(facade.last_reload_time, facade.last_refresh_time)

		self.assertEqual(4, len(facade.repository.node_descriptors))
		self.assertEqual(4, len(facade.repository.harvester_descriptors))
		self.assertEqual(0, len(facade.repository.voter_descriptors))

	def test_can_skip_reload_when_noop(self):
		# Arrange:
		facade = NemRoutesFacade(NemNetwork.MAINNET, '<nem_explorer>')

		# Act:
		result1 = facade.reload_all(Path('tests/resources'), True)
		result2 = facade.reload_all(Path('tests/resources'), True)
		result3 = facade.reload_all(Path('tests/resources'))

		# Assert:
		self.assertEqual([True, False, False], [result1, result2, result3])
		self.assertEqual(facade.last_reload_time, facade.last_refresh_time)

		self.assertEqual(4, len(facade.repository.node_descriptors))
		self.assertEqual(4, len(facade.repository.harvester_descriptors))
		self.assertEqual(0, len(facade.repository.voter_descriptors))

	def test_can_reset_refresh_time(self):
		# Arrange:
		facade = NemRoutesFacade(NemNetwork.MAINNET, '<nem_explorer>')
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
		facade = NemRoutesFacade(NemNetwork.MAINNET, '<nem_explorer>')
		facade.reload_all(Path('tests/resources'), True)

		# Act:
		template_name, context = facade.html_harvesters()

		# Assert:
		self.assertEqual('nem_nodes.html', template_name)
		self.assertEqual(4, len(context))
		self.assertEqual('NEM Recent Harvesters', context['title'])
		self.assertEqual(['Allnodes21', 'TIME', '', 'Hi, I am Alice7'], _get_names(context['descriptors']))
		self.assertEqual([104] * 4, _get_network_bytes(context['descriptors']))
		self.assertIsNotNone(context['version_to_css_class'])
		self.assertEqual('<nem_explorer>', context['explorer_endpoint'])

	def test_can_render_nodes_html(self):
		# Arrange:
		facade = NemRoutesFacade(NemNetwork.MAINNET, '<nem_explorer>')
		facade.reload_all(Path('tests/resources'), True)

		# Act:
		template_name, context = facade.html_nodes()

		# Assert:
		self.assertEqual('nem_nodes.html', template_name)
		self.assertEqual(4, len(context))
		self.assertEqual('NEM Nodes', context['title'])
		self.assertEqual(['August', '[c=#e9c086]jusan[/c]', 'cobalt', 'silicon'], _get_names(context['descriptors']))
		self.assertEqual([104] * 4, _get_network_bytes(context['descriptors']))
		self.assertIsNotNone(context['version_to_css_class'])
		self.assertEqual('<nem_explorer>', context['explorer_endpoint'])

	def test_can_render_summary_html(self):
		# Arrange:
		facade = NemRoutesFacade(NemNetwork.MAINNET, '<nem_explorer>', 1)
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

	def test_can_render_nodes_html_testnet(self):
		# Arrange:
		facade = NemRoutesFacade(NemNetwork.TESTNET, '<nem_explorer>')
		facade.reload_all(Path('tests/resources'), True)

		# Act:
		template_name, context = facade.html_nodes()

		# Assert:
		self.assertEqual('nem_nodes.html', template_name)
		self.assertEqual(4, len(context))
		self.assertEqual('NEM (TESTNET) Nodes', context['title'])
		self.assertEqual(['ol-test'], _get_names(context['descriptors']))
		self.assertEqual([152], _get_network_bytes(context['descriptors']))
		self.assertIsNotNone(context['version_to_css_class'])
		self.assertEqual('<nem_explorer>', context['explorer_endpoint'])

	# endregion

	# region json

	def test_can_generate_nodes_json(self):
		# Arrange:
		facade = NemRoutesFacade(NemNetwork.MAINNET, '<nem_explorer>')
		facade.reload_all(Path('tests/resources'), True)

		# Act:
		node_descriptors = facade.json_nodes(role=1)

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
		facade = NemRoutesFacade(NemNetwork.MAINNET, '<nem_explorer>', 1)
		facade.reload_all(Path('tests/resources'), True)

		# Act:
		chart_json = json.loads(facade.json_height_chart())

		# Assert: { height } x { 0.6.100 }
		self.assertEqual(1, len(chart_json['data']))

	def test_can_generate_height_chart_with_metadata_json(self):
		# Arrange:
		facade = NemRoutesFacade(NemNetwork.MAINNET, '<nem_explorer>', 1)
		facade.reload_all(Path('tests/resources'), True)

		# Act:
		chart_with_metadata_json = facade.json_height_chart_with_metadata()
		chart_json = json.loads(chart_with_metadata_json['chartJson'])

		# Assert: { height } x { 0.6.100 }
		self.assertEqual(2, len(chart_with_metadata_json))
		self.assertEqual(1, len(chart_json['data']))
		self.assertTrue(re.match(r'\d\d:\d\d', chart_with_metadata_json['lastRefreshTime']))

	def test_can_retrieve_estimated_network_height_json(self):
		# Arrange:
		facade = NemRoutesFacade(NemNetwork.MAINNET, '<nem_explorer>')
		facade.reload_all(Path('tests/resources'), True)

		# Act:
		height_json = facade.json_height()

		# Assert:
		self.assertEqual(2, len(height_json))
		self.assertEqual(3850057, height_json['height'])
		self.assertEqual(3850057 - 360, height_json['finalizedHeight'])

	# endregion

	# region utils

	def test_can_map_version_to_css_class(self):
		self.assertEqual('success', _map_version_to_css_class(NemRoutesFacade, '0.6.101'))
		self.assertEqual('warning', _map_version_to_css_class(NemRoutesFacade, ''))
		for version in ['0.6.100', '0.6.99', '0.6.98', '0.6.97-BETA', '0.6.96-BETA', '0.6.95-BETA']:
			self.assertEqual('danger', _map_version_to_css_class(NemRoutesFacade, version))

	# endregion


class SymbolRoutesFacadeTest(unittest.TestCase):  # pylint: disable=too-many-public-methods
	# region reload / refresh

	def test_can_reload_all(self):
		# Arrange:
		facade = SymbolRoutesFacade(SymbolNetwork.MAINNET, '<symbol_explorer>')

		# Act:
		result = facade.reload_all(Path('tests/resources'), True)

		# Assert:
		self.assertEqual(True, result)
		self.assertEqual(facade.last_reload_time, facade.last_refresh_time)

		# loaded all mainnet (104) nodes, skipping testnet (152) nodes
		self.assertEqual(9, len(facade.repository.node_descriptors))
		self.assertEqual(4, len(facade.repository.harvester_descriptors))
		self.assertEqual(4, len(facade.repository.voter_descriptors))

	def test_can_skip_reload_when_noop(self):
		# Arrange:
		facade = SymbolRoutesFacade(SymbolNetwork.MAINNET, '<symbol_explorer>')

		# Act:
		result1 = facade.reload_all(Path('tests/resources'), True)
		result2 = facade.reload_all(Path('tests/resources'), True)
		result3 = facade.reload_all(Path('tests/resources'))

		# Assert:
		self.assertEqual([True, False, False], [result1, result2, result3])
		self.assertEqual(facade.last_reload_time, facade.last_refresh_time)

		self.assertEqual(9, len(facade.repository.node_descriptors))
		self.assertEqual(4, len(facade.repository.harvester_descriptors))
		self.assertEqual(4, len(facade.repository.voter_descriptors))

	def test_can_reset_refresh_time(self):
		# Arrange:
		facade = SymbolRoutesFacade(SymbolNetwork.MAINNET, '<symbol_explorer>')
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
		facade = SymbolRoutesFacade(SymbolNetwork.MAINNET, '<symbol_explorer>')
		facade.reload_all(Path('tests/resources'), True)

		# Act:
		template_name, context = facade.html_harvesters()

		# Assert:
		self.assertEqual('symbol_nodes.html', template_name)
		self.assertEqual(4, len(context))
		self.assertEqual('Symbol Recent Harvesters', context['title'])
		self.assertEqual(['jaguar', '(Max50)SN1.MSUS', '', 'Allnodes900'], _get_names(context['descriptors']))
		self.assertEqual([104] * 4, _get_network_bytes(context['descriptors']))
		self.assertIsNotNone(context['version_to_css_class'])
		self.assertEqual('<symbol_explorer>', context['explorer_endpoint'])

	def test_can_render_nodes_html(self):
		# Arrange:
		facade = SymbolRoutesFacade(SymbolNetwork.MAINNET, '<symbol_explorer>')
		facade.reload_all(Path('tests/resources'), True)

		# Act:
		template_name, context = facade.html_nodes()

		# Assert:
		self.assertEqual('symbol_nodes.html', template_name)
		self.assertEqual(4, len(context))
		self.assertEqual('Symbol Nodes', context['title'])
		self.assertEqual(
			[
				'Allnodes250',
				'Allnodes251',
				'Apple',
				'Shin-Kuma-Node',
				'ibone74',
				'jaguar',
				'symbol.ooo maxUnlockedAccounts:100',
				'xym pool',
				'yasmine farm'
			],
			_get_names(context['descriptors']))
		self.assertEqual([104] * 9, _get_network_bytes(context['descriptors']))
		self.assertIsNotNone(context['version_to_css_class'])
		self.assertEqual('<symbol_explorer>', context['explorer_endpoint'])

	def test_can_render_voters_html(self):
		# Arrange:
		facade = SymbolRoutesFacade(SymbolNetwork.MAINNET, '<symbol_explorer>')
		facade.reload_all(Path('tests/resources'), True)

		# Act:
		template_name, context = facade.html_voters()

		# Assert:
		self.assertEqual('symbol_nodes.html', template_name)
		self.assertEqual(5, len(context))
		self.assertEqual('Symbol Voters', context['title'])
		self.assertEqual(['59026DB', 'Allnodes34'], _get_names(context['descriptors']))
		self.assertEqual([104] * 2, _get_network_bytes(context['descriptors']))
		self.assertIsNotNone(context['version_to_css_class'])
		self.assertTrue(context['show_voting'])
		self.assertEqual('<symbol_explorer>', context['explorer_endpoint'])

	def test_can_render_summary_html(self):
		# Arrange:
		facade = SymbolRoutesFacade(SymbolNetwork.MAINNET, '<symbol_explorer>', 1)
		facade.reload_all(Path('tests/resources'), True)

		# Act:
		template_name, context = facade.html_summary()

		# Assert:
		self.assertEqual('symbol_summary.html', template_name)
		self.assertEqual(5, len(context))
		self.assertEqual(6, len(json.loads(context['height_chart_json'])['data']))  # { height, finalized_height } x { 1.0.3.5, 1.0.3.4, 1.0.3.3 }
		self.assertEqual(4, len(json.loads(context['voting_power_chart_json'])['data']))  # 1.0.3.5, 1.0.3.4, 1.0.3.3, ''
		self.assertEqual(4, len(json.loads(context['harvesting_power_chart_json'])['data']))  # 1.0.3.5, 1.0.3.4, 1.0.3.3, ''
		self.assertEqual(4, len(json.loads(context['harvesting_count_chart_json'])['data']))  # 1.0.3.5, 1.0.3.4, 1.0.3.3, ''
		self.assertEqual(4, len(json.loads(context['node_count_chart_json'])['data']))  # 1.0.3.5, 1.0.3.4, 1.0.3.3, ''

	def test_can_render_nodes_html_testnet(self):
		# Arrange:
		facade = SymbolRoutesFacade(SymbolNetwork.TESTNET, '<symbol_explorer>')
		facade.reload_all(Path('tests/resources'), True)

		# Act:
		template_name, context = facade.html_nodes()

		# Assert:
		self.assertEqual('symbol_nodes.html', template_name)
		self.assertEqual(4, len(context))
		self.assertEqual('Symbol (TESTNET) Nodes', context['title'])
		self.assertEqual(['ignored because testnet node'], _get_names(context['descriptors']))
		self.assertEqual([152], _get_network_bytes(context['descriptors']))
		self.assertIsNotNone(context['version_to_css_class'])
		self.assertEqual('<symbol_explorer>', context['explorer_endpoint'])

	# endregion

	# region json

	def test_can_generate_nodes_json(self):
		# Arrange:
		facade = SymbolRoutesFacade(SymbolNetwork.MAINNET, '<symbol_explorer>')
		facade.reload_all(Path('tests/resources'), True)

		# Act:
		node_descriptors = facade.json_nodes()

		# Assert: spot check names and roles
		self.assertEqual(9, len(node_descriptors))
		self.assertEqual(
			[
				'Allnodes250',
				'Allnodes251',
				'Apple',
				'Shin-Kuma-Node',
				'ibone74',
				'jaguar',
				'symbol.ooo maxUnlockedAccounts:100',
				'xym pool',
				'yasmine farm'
			],
			list(map(lambda descriptor: descriptor['name'], node_descriptors)))
		self.assertEqual(
			[2, 2, 7, 3, 3, 5, 3, 3, 3],
			list(map(lambda descriptor: descriptor['roles'], node_descriptors)))

	def test_can_generate_nodes_json_filtered_by_role(self):
		# Arrange:
		facade = SymbolRoutesFacade(SymbolNetwork.MAINNET, '<symbol_explorer>')
		facade.reload_all(Path('tests/resources'), True)

		# Act: select nodes with api role (role 2)
		node_descriptors = facade.json_nodes(role=2)

		# Assert: spot check names and roles
		self.assertEqual(8, len(node_descriptors))
		self.assertEqual(
			['Allnodes250', 'Allnodes251', 'Apple', 'Shin-Kuma-Node', 'ibone74', 'symbol.ooo maxUnlockedAccounts:100', 'xym pool', 'yasmine farm'],
			list(map(lambda descriptor: descriptor['name'], node_descriptors)))
		self.assertEqual(
			[2, 2, 7, 3, 3, 3, 3, 3],
			list(map(lambda descriptor: descriptor['roles'], node_descriptors)))

	def test_can_generate_nodes_json_filtered_exact_match(self):
		# Arrange:
		facade = SymbolRoutesFacade(SymbolNetwork.MAINNET, '<symbol_explorer>')
		facade.reload_all(Path('tests/resources'), True)

		# Act: select nodes with only api role (role 2)
		node_descriptors = facade.json_nodes(role=2, exact_match=True)

		# Assert: spot check names and roles
		self.assertEqual(2, len(node_descriptors))
		self.assertEqual(
			['Allnodes250', 'Allnodes251'],
			list(map(lambda descriptor: descriptor['name'], node_descriptors)))
		self.assertEqual(
			[2, 2],
			list(map(lambda descriptor: descriptor['roles'], node_descriptors)))

	def test_can_generate_nodes_json_filtered_only_ssl(self):
		# Arrange:
		facade = SymbolRoutesFacade(SymbolNetwork.MAINNET, '<symbol_explorer>')
		facade.reload_all(Path('tests/resources'), True)

		# Act: select nodes with only ssl enabled
		node_descriptors = facade.json_nodes(only_ssl=True)

		# Assert: spot check names and roles
		self.assertEqual(2, len(node_descriptors))
		self.assertEqual(
			['Allnodes251', 'xym pool'],
			list(map(lambda descriptor: descriptor['name'], node_descriptors)))
		self.assertEqual(
			[2, 3],
			list(map(lambda descriptor: descriptor['roles'], node_descriptors)))

	def test_can_generate_nodes_json_filtered_order_random_subset(self):
		# Arrange:
		facade = SymbolRoutesFacade(SymbolNetwork.MAINNET, '<symbol_explorer>')
		facade.reload_all(Path('tests/resources'), True)

		# Act: select 2 nodes with order random
		node_descriptors = facade.json_nodes(limit=2, order='random')

		# Assert:
		all_node_descriptors = facade.json_nodes()

		full_node_names = list(map(lambda descriptor: descriptor['name'], all_node_descriptors))
		random_node_names = list(map(lambda descriptor: descriptor['name'], node_descriptors))

		self.assertEqual(2, len(node_descriptors))
		self.assertEqual(2, len(set(random_node_names)))
		for name in random_node_names:
			self.assertIn(name, full_node_names)

	def test_can_generate_nodes_json_filtered_limit_5(self):
		# Arrange:
		facade = SymbolRoutesFacade(SymbolNetwork.MAINNET, '<symbol_explorer>')
		facade.reload_all(Path('tests/resources'), True)

		# Act:
		node_descriptors = facade.json_nodes(limit=5)

		# Assert: spot check names
		self.assertEqual(5, len(node_descriptors))
		self.assertEqual(
			['Allnodes250', 'Allnodes251', 'Apple', 'Shin-Kuma-Node', 'ibone74'],
			list(map(lambda descriptor: descriptor['name'], node_descriptors)))
		self.assertEqual(
			[2, 2, 7, 3, 3],
			list(map(lambda descriptor: descriptor['roles'], node_descriptors)))

	def test_can_find_known_node_by_main_public_key(self):  # pylint: disable=invalid-name
		# Arrange:
		facade = SymbolRoutesFacade(SymbolNetwork.MAINNET, '<symbol_explorer>')
		facade.reload_all(Path('tests/resources'), True)

		# Act: select a node match with main public key
		node_descriptors = facade.json_node(
			filter_field='main_public_key',
			public_key='A0AA48B6417BDB1845EB55FB0B1E13255EA8BD0D8FA29AD2D8A906E220571F21'
		)
		expected_node = {
			'mainPublicKey': 'A0AA48B6417BDB1845EB55FB0B1E13255EA8BD0D8FA29AD2D8A906E220571F21',
			'nodePublicKey': '403D890915B68E290B3F519A602A13B17C58499A077D77DB7CCC6327761C84DC',
			'endpoint': '',
			'name':
			'Allnodes250',
			'version': '1.0.3.4',
			'height': 1486762,
			'finalizedHeight': 1486740,
			'balance': 3155632.471994,
			'isHealthy': None,
			'isHttpsEnabled': None,
			'isWssEnabled': None,
			'restVersion': None,
			'roles': 2
		}

		# Assert:
		self.assertEqual(node_descriptors, expected_node)

	def test_can_find_known_node_by_node_public_key(self):  # pylint: disable=invalid-name
		# Arrange:
		facade = SymbolRoutesFacade(SymbolNetwork.MAINNET, '<symbol_explorer>')
		facade.reload_all(Path('tests/resources'), True)

		# Act: select a node match with node public key
		node_descriptors = facade.json_node(
			filter_field='node_public_key',
			public_key='D05BE3101F2916AA34839DDC1199BE45092103A9B66172FA3D05911DC041AADA'
		)
		expected_node = {
			'mainPublicKey': '5B20F8F228FF0E064DB0DE7951155F6F41EF449D0EC10960067C2BF2DCD61874',
			'nodePublicKey': 'D05BE3101F2916AA34839DDC1199BE45092103A9B66172FA3D05911DC041AADA',
			'endpoint': 'http://yasmine.farm.tokyo:3000',
			'name': 'yasmine farm',
			'version': '1.0.3.4',
			'height': 1486760,
			'finalizedHeight': 1486740,
			'balance': 99.98108,
			'isHealthy': True,
			'isHttpsEnabled': False,
			'isWssEnabled': False,
			'restVersion': '2.4.2',
			'roles': 3
		}

		# Assert:
		self.assertEqual(node_descriptors, expected_node)

	def _assert_unknown_node_not_found(self, public_key):
		# Arrange:
		facade = SymbolRoutesFacade(SymbolNetwork.MAINNET, '<symbol_explorer>')
		facade.reload_all(Path('tests/resources'), True)

		# Act:
		node_descriptors = facade.json_node(filter_field=public_key, public_key='invalidKey')

		# Assert:
		self.assertIsNone(node_descriptors)

	def test_cannot_find_unknown_node_by_main_public_key(self):  # pylint: disable=invalid-name
		self._assert_unknown_node_not_found('main_public_key')

	def test_cannot_find_unknown_node_by_node_public_key(self):  # pylint: disable=invalid-name
		self._assert_unknown_node_not_found('node_public_key')

	def test_can_generate_height_chart_json(self):
		# Arrange:
		facade = SymbolRoutesFacade(SymbolNetwork.MAINNET, '<symbol_explorer>', 1)
		facade.reload_all(Path('tests/resources'), True)

		# Act:
		chart_json = json.loads(facade.json_height_chart())

		# Assert: { height, finalized_height } x { 1.0.3.3, 1.0.3.4, 1.0.3.5 }
		self.assertEqual(6, len(chart_json['data']))

	def test_can_generate_height_chart_with_metadata_json(self):
		# Arrange:
		facade = SymbolRoutesFacade(SymbolNetwork.MAINNET, '<symbol_explorer>', 1)
		facade.reload_all(Path('tests/resources'), True)

		# Act:
		chart_with_metadata_json = facade.json_height_chart_with_metadata()
		chart_json = json.loads(chart_with_metadata_json['chartJson'])

		# Assert: { height, finalized_height } x { 1.0.3.3, 1.0.3.4, 1.0.3.5 }
		self.assertEqual(2, len(chart_with_metadata_json))
		self.assertEqual(6, len(chart_json['data']))
		self.assertTrue(re.match(r'\d\d:\d\d', chart_with_metadata_json['lastRefreshTime']))

	def test_can_retrieve_estimated_network_height_json(self):
		# Arrange:
		facade = SymbolRoutesFacade(SymbolNetwork.MAINNET, '<symbol_explorer>')
		facade.reload_all(Path('tests/resources'), True)

		# Act:
		height_json = facade.json_height()

		# Assert:
		self.assertEqual(2, len(height_json))
		self.assertEqual(1486760, height_json['height'])
		self.assertEqual(1486740, height_json['finalizedHeight'])

	# endregion

	# region utils

	def test_can_map_version_to_css_class(self):
		for version in ['1.0.3.6', '1.0.3.5', '1.0.3.4']:
			self.assertEqual('success', _map_version_to_css_class(SymbolRoutesFacade, version))

		self.assertEqual('warning', _map_version_to_css_class(SymbolRoutesFacade, ''))

		for version in ['1.0.3.3', '1.0.3.1', '1.0.3.0', '1.0.2.0', '1.0.1.0', '0.0.0.0']:
			self.assertEqual('danger', _map_version_to_css_class(SymbolRoutesFacade, version))

	# endregion
