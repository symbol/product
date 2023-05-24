import datetime
import tempfile
import unittest
from pathlib import Path

from symbolchain.CryptoTypes import Hash256

from shoestring.internal.NodeFeatures import NodeFeatures
from shoestring.internal.ShoestringConfiguration import (
	parse_images,
	parse_network,
	parse_node,
	parse_services,
	parse_shoestring_configuration
)


class ShoestringConfigurationTest(unittest.TestCase):
	# region configuration templates

	GENERATION_HASH_SEED = Hash256('EA35CFA79B68B2EB2F9EC8041399C1869663F3FC06ED93AEB2EFF8075B21C39B')

	VALID_NETWORK_CONFIGURATION = {
		'name': 'foo',
		'identifier': '123',
		'epochAdjustment': '1684853921',
		'generationHashSeed': str(GENERATION_HASH_SEED)
	}

	VALID_IMAGES_CONFIGURATION = {
		'client': 'symbolplatform/symbol-server:gcc-0.0.0.0',
		'rest': 'symbolplatform/symbol-rest:1.1.1'
	}

	VALID_SERVICES_CONFIGURATION = {
		'nodewatch': 'https://nodewatch.symbol.tools/foo'
	}

	VALID_NODE_CONFIGURATION = {
		'features': 'API | PEER | VOTER',
		'userId': '1234',
		'groupId': '9876',
		'caPassword': 'pass:abc123',
		'apiHttps': 'false'
	}

	# endregion

	# region network configuration

	def test_can_parse_valid_network_configuration(self):
		# Act:
		network = parse_network(self.VALID_NETWORK_CONFIGURATION)

		# Assert:
		self.assertEqual('foo', network.name)
		self.assertEqual(123, network.identifier)
		self.assertEqual(datetime.datetime(2023, 5, 23, 14, 58, 41), network.datetime_converter.to_datetime(0))
		self.assertEqual(self.GENERATION_HASH_SEED, network.generation_hash_seed)

	def test_cannot_parse_network_configuration_incomplete(self):
		# Arrange:
		for key in self.VALID_NETWORK_CONFIGURATION:
			incomplete_config = {**self.VALID_NETWORK_CONFIGURATION}
			del incomplete_config[key]

			# Act + Assert:
			with self.assertRaises(KeyError):
				parse_network(incomplete_config)

	def test_cannot_parse_network_configuration_corrupt(self):
		# Arrange:
		corrupt_overrides = {
			'identifier': 'not an int',
			'generationHashSeed': 'not a hash',
			'epochAdjustment': 'not an int',
		}

		for key, value in corrupt_overrides.items():
			corrupt_config = {**self.VALID_NETWORK_CONFIGURATION}
			corrupt_config[key] = value

			# Act + Assert:
			with self.assertRaises(ValueError):
				parse_network(corrupt_config)

	# endregion

	# region images configuration

	def test_can_parse_valid_images_configuration(self):
		# Act:
		images = parse_images(self.VALID_IMAGES_CONFIGURATION)

		# Assert:
		self.assertEqual('symbolplatform/symbol-server:gcc-0.0.0.0', images.client)
		self.assertEqual('symbolplatform/symbol-rest:1.1.1', images.rest)

	def test_cannot_parse_images_configuration_incomplete(self):
		# Arrange:
		for key in self.VALID_IMAGES_CONFIGURATION:
			incomplete_config = {**self.VALID_IMAGES_CONFIGURATION}
			del incomplete_config[key]

			# Act + Assert:
			with self.assertRaises(KeyError):
				parse_images(incomplete_config)

	# endregion

	# region services configuration

	def test_can_parse_valid_services_configuration(self):
		# Act:
		services = parse_services(self.VALID_SERVICES_CONFIGURATION)

		# Assert:
		self.assertEqual('https://nodewatch.symbol.tools/foo', services.nodewatch)

	def test_cannot_parse_services_configuration_incomplete(self):
		# Arrange:
		for key in self.VALID_SERVICES_CONFIGURATION:
			incomplete_config = {**self.VALID_SERVICES_CONFIGURATION}
			del incomplete_config[key]

			# Act + Assert:
			with self.assertRaises(KeyError):
				parse_services(incomplete_config)

	# endregion

	# region node configuration

	def test_can_parse_valid_node_configuration_single_value(self):
		# Arrange:
		config = {**self.VALID_NODE_CONFIGURATION}
		config['features'] = 'PEER'

		# Act:
		node = parse_node(config)

		# Assert:
		self.assertEqual(NodeFeatures.PEER, node.features)
		self.assertEqual(1234, node.user_id)
		self.assertEqual(9876, node.group_id)
		self.assertEqual('pass:abc123', node.ca_password)
		self.assertEqual(False, node.api_https)

	def test_can_parse_valid_node_configuration_multiple_values(self):
		# Act:
		node = parse_node(self.VALID_NODE_CONFIGURATION)

		# Assert:
		self.assertEqual(NodeFeatures.API | NodeFeatures.PEER | NodeFeatures.VOTER, node.features)
		self.assertEqual(1234, node.user_id)
		self.assertEqual(9876, node.group_id)
		self.assertEqual('pass:abc123', node.ca_password)
		self.assertEqual(False, node.api_https)

	def test_cannot_parse_node_configuration_incomplete(self):
		# Arrange:
		for key in self.VALID_NODE_CONFIGURATION:
			incomplete_config = {**self.VALID_NODE_CONFIGURATION}
			del incomplete_config[key]

			# Act + Assert:
			with self.assertRaises(KeyError):
				parse_node(incomplete_config)

	def test_cannot_parse_node_configuration_corrupt(self):
		# Arrange:
		corrupt_overrides = {
			'features': 'API | OTHER | VOTER',
			'userId': 'not an int',
			'groupId': 'not an int'
		}

		for key, value in corrupt_overrides.items():
			corrupt_config = {**self.VALID_NODE_CONFIGURATION}
			corrupt_config[key] = value

			# Act + Assert:
			with self.assertRaises(ValueError):
				parse_node(corrupt_config)

	# endregion

	# region parse_shoestring_configuration

	@staticmethod
	def _write_section(outfile, header, pairs):
		outfile.write(f'{header}\n')
		for key, value in pairs.items():
			outfile.write(f'{key} = {value}\n')

	def test_can_parse_shoestring_configuration(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as temp_directory:
			configuration_file = Path(temp_directory) / 'foo.properties'

			with open(configuration_file, 'wt', encoding='utf8') as outfile:
				self._write_section(outfile, '[network]', self.VALID_NETWORK_CONFIGURATION)
				self._write_section(outfile, '\n[images]', self.VALID_IMAGES_CONFIGURATION)
				self._write_section(outfile, '\n[services]', self.VALID_SERVICES_CONFIGURATION)
				self._write_section(outfile, '\n[node]', self.VALID_NODE_CONFIGURATION)

			# Act:
			config = parse_shoestring_configuration(configuration_file)

			# Assert:
			self.assertEqual('foo', config.network.name)
			self.assertEqual(123, config.network.identifier)
			self.assertEqual(datetime.datetime(2023, 5, 23, 14, 58, 41), config.network.datetime_converter.to_datetime(0))
			self.assertEqual(self.GENERATION_HASH_SEED, config.network.generation_hash_seed)

			self.assertEqual('symbolplatform/symbol-server:gcc-0.0.0.0', config.images.client)
			self.assertEqual('symbolplatform/symbol-rest:1.1.1', config.images.rest)

			self.assertEqual('https://nodewatch.symbol.tools/foo', config.services.nodewatch)

			self.assertEqual(NodeFeatures.API | NodeFeatures.PEER | NodeFeatures.VOTER, config.node.features)
			self.assertEqual(1234, config.node.user_id)
			self.assertEqual(9876, config.node.group_id)
			self.assertEqual('pass:abc123', config.node.ca_password)
			self.assertEqual(False, config.node.api_https)

	def test_cannot_parse_shoestring_configuration_incomplete(self):
		# Arrange:
		for section_id in range(4):
			with tempfile.TemporaryDirectory() as temp_directory:
				configuration_file = Path(temp_directory) / 'foo.properties'

				with open(configuration_file, 'wt', encoding='utf8') as outfile:
					if 0 != section_id:
						self._write_section(outfile, '[network]', self.VALID_NETWORK_CONFIGURATION)

					if 1 != section_id:
						self._write_section(outfile, '\n[images]', self.VALID_IMAGES_CONFIGURATION)

					if 2 != section_id:
						self._write_section(outfile, '\n[services]', self.VALID_SERVICES_CONFIGURATION)

					if 3 != section_id:
						self._write_section(outfile, '\n[node]', self.VALID_NODE_CONFIGURATION)

				# Act + Assert:
				with self.assertRaises(KeyError):
					parse_shoestring_configuration(configuration_file)

	# endregion
