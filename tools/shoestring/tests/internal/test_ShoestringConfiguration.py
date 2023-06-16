import datetime
import tempfile
import unittest
from pathlib import Path

from symbolchain.CryptoTypes import Hash256

from shoestring.internal.NodeFeatures import NodeFeatures
from shoestring.internal.ShoestringConfiguration import (
	parse_images_configuration,
	parse_imports_configuration,
	parse_network_configuration,
	parse_node_configuration,
	parse_services_configuration,
	parse_shoestring_configuration,
	parse_transaction_configuration
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

	VALID_TRANSACTION_CONFIGURATION = {
		'feeMultiplier': '234',
		'timeoutHours': '3',
		'minCosignaturesCount': '2',
		'hashLockDuration': '1440',
		'currencyMosaicId': '0x72C0212E67A08BCE',
		'lockedFundsPerAggregate': '10000000'
	}

	VALID_IMPORTS_CONFIGURATION = {
		'harvester': 'path/to/config-harvesting.properties',
		'voter': 'path/to/private_key_tree_directory'
	}

	VALID_NODE_CONFIGURATION = {
		'features': 'API | PEER | VOTER',
		'userId': '1234',
		'groupId': '9876',
		'caPassword': 'pass:abc123',
		'apiHttps': 'false',
		'caCommonName': 'my CA name',
		'nodeCommonName': 'my Node name'
	}

	# endregion

	# region network configuration

	def test_can_parse_valid_network_configuration(self):
		# Act:
		network_config = parse_network_configuration(self.VALID_NETWORK_CONFIGURATION)

		# Assert:
		self.assertEqual('foo', network_config.name)
		self.assertEqual(123, network_config.identifier)
		self.assertEqual(datetime.datetime(2023, 5, 23, 14, 58, 41), network_config.datetime_converter.to_datetime(0))
		self.assertEqual(self.GENERATION_HASH_SEED, network_config.generation_hash_seed)

	def test_cannot_parse_network_configuration_incomplete(self):
		# Arrange:
		for key in self.VALID_NETWORK_CONFIGURATION:
			incomplete_config = {**self.VALID_NETWORK_CONFIGURATION}
			del incomplete_config[key]

			# Act + Assert:
			with self.assertRaises(KeyError):
				parse_network_configuration(incomplete_config)

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
				parse_network_configuration(corrupt_config)

	# endregion

	# region images configuration

	def test_can_parse_valid_images_configuration(self):
		# Act:
		images_config = parse_images_configuration(self.VALID_IMAGES_CONFIGURATION)

		# Assert:
		self.assertEqual('symbolplatform/symbol-server:gcc-0.0.0.0', images_config.client)
		self.assertEqual('symbolplatform/symbol-rest:1.1.1', images_config.rest)

	def test_cannot_parse_images_configuration_incomplete(self):
		# Arrange:
		for key in self.VALID_IMAGES_CONFIGURATION:
			incomplete_config = {**self.VALID_IMAGES_CONFIGURATION}
			del incomplete_config[key]

			# Act + Assert:
			with self.assertRaises(KeyError):
				parse_images_configuration(incomplete_config)

	# endregion

	# region services configuration

	def test_can_parse_valid_services_configuration(self):
		# Act:
		services_config = parse_services_configuration(self.VALID_SERVICES_CONFIGURATION)

		# Assert:
		self.assertEqual('https://nodewatch.symbol.tools/foo', services_config.nodewatch)

	def test_cannot_parse_services_configuration_incomplete(self):
		# Arrange:
		for key in self.VALID_SERVICES_CONFIGURATION:
			incomplete_config = {**self.VALID_SERVICES_CONFIGURATION}
			del incomplete_config[key]

			# Act + Assert:
			with self.assertRaises(KeyError):
				parse_services_configuration(incomplete_config)

	# endregion

	# region transaction configuration

	def test_can_parse_valid_transaction_configuration(self):
		# Act:
		transaction_config = parse_transaction_configuration(self.VALID_TRANSACTION_CONFIGURATION)

		# Assert:
		self.assertEqual(234, transaction_config.fee_multiplier)
		self.assertEqual(3, transaction_config.timeout_hours)
		self.assertEqual(2, transaction_config.min_cosignatures_count)
		self.assertEqual(1440, transaction_config.hash_lock_duration)
		self.assertEqual(0x72C0212E67A08BCE, transaction_config.currency_mosaic_id)
		self.assertEqual(10000000, transaction_config.locked_funds_per_aggregate)

	def test_cannot_parse_transaction_configuration_incomplete(self):
		# Arrange:
		for key in self.VALID_TRANSACTION_CONFIGURATION:
			incomplete_config = {**self.VALID_TRANSACTION_CONFIGURATION}
			del incomplete_config[key]

			# Act + Assert:
			with self.assertRaises(KeyError):
				parse_transaction_configuration(incomplete_config)

	def test_cannot_parse_transaction_configuration_corrupt(self):
		# Arrange:
		corrupt_overrides = {
			'feeMultiplier': 'not an int',
			'timeoutHours': 'not an int',
			'minCosignaturesCount': 'not an int',
			'hashLockDuration': 'not an int',
			'currencyMosaicId': 'not an int',
			'lockedFundsPerAggregate': 'not an int'
		}

		for key, value in corrupt_overrides.items():
			corrupt_config = {**self.VALID_TRANSACTION_CONFIGURATION}
			corrupt_config[key] = value

			# Act + Assert:
			with self.assertRaises(ValueError):
				parse_transaction_configuration(corrupt_config)

	# endregion

	# region imports configuration

	def test_can_parse_valid_imports_configuration(self):
		# Act:
		imports_config = parse_imports_configuration(self.VALID_IMPORTS_CONFIGURATION)

		# Assert:
		self.assertEqual('path/to/config-harvesting.properties', imports_config.harvester)
		self.assertEqual('path/to/private_key_tree_directory', imports_config.voter)

	def test_cannot_parse_imports_configuration_incomplete(self):
		# Arrange:
		for key in self.VALID_IMPORTS_CONFIGURATION:
			incomplete_config = {**self.VALID_IMPORTS_CONFIGURATION}
			del incomplete_config[key]

			# Act + Assert:
			with self.assertRaises(KeyError):
				parse_imports_configuration(incomplete_config)

	# endregion

	# region node configuration

	def test_can_parse_valid_node_configuration_single_value(self):
		# Arrange:
		config = {**self.VALID_NODE_CONFIGURATION}
		config['features'] = 'PEER'

		# Act:
		node_config = parse_node_configuration(config)

		# Assert:
		self.assertEqual(NodeFeatures.PEER, node_config.features)
		self.assertEqual(1234, node_config.user_id)
		self.assertEqual(9876, node_config.group_id)
		self.assertEqual('pass:abc123', node_config.ca_password)
		self.assertEqual(False, node_config.api_https)
		self.assertEqual('my CA name', node_config.ca_common_name)
		self.assertEqual('my Node name', node_config.node_common_name)

	def test_can_parse_valid_node_configuration_multiple_values(self):
		# Act:
		node_config = parse_node_configuration(self.VALID_NODE_CONFIGURATION)

		# Assert:
		self.assertEqual(NodeFeatures.API | NodeFeatures.PEER | NodeFeatures.VOTER, node_config.features)
		self.assertEqual(1234, node_config.user_id)
		self.assertEqual(9876, node_config.group_id)
		self.assertEqual('pass:abc123', node_config.ca_password)
		self.assertEqual(False, node_config.api_https)
		self.assertEqual('my CA name', node_config.ca_common_name)
		self.assertEqual('my Node name', node_config.node_common_name)

	def test_cannot_parse_node_configuration_incomplete(self):
		# Arrange:
		for key in self.VALID_NODE_CONFIGURATION:
			incomplete_config = {**self.VALID_NODE_CONFIGURATION}
			del incomplete_config[key]

			# Act + Assert:
			with self.assertRaises(KeyError):
				parse_node_configuration(incomplete_config)

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
				parse_node_configuration(corrupt_config)

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
				self._write_section(outfile, '\n[transaction]', self.VALID_TRANSACTION_CONFIGURATION)
				self._write_section(outfile, '\n[imports]', self.VALID_IMPORTS_CONFIGURATION)
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

			self.assertEqual(234, config.transaction.fee_multiplier)
			self.assertEqual(3, config.transaction.timeout_hours)
			self.assertEqual(2, config.transaction.min_cosignatures_count)
			self.assertEqual(1440, config.transaction.hash_lock_duration)
			self.assertEqual(0x72C0212E67A08BCE, config.transaction.currency_mosaic_id)
			self.assertEqual(10000000, config.transaction.locked_funds_per_aggregate)

			self.assertEqual('path/to/config-harvesting.properties', config.imports.harvester)
			self.assertEqual('path/to/private_key_tree_directory', config.imports.voter)

			self.assertEqual(NodeFeatures.API | NodeFeatures.PEER | NodeFeatures.VOTER, config.node.features)
			self.assertEqual(1234, config.node.user_id)
			self.assertEqual(9876, config.node.group_id)
			self.assertEqual('pass:abc123', config.node.ca_password)
			self.assertEqual(False, config.node.api_https)
			self.assertEqual('my CA name', config.node.ca_common_name)
			self.assertEqual('my Node name', config.node.node_common_name)

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
