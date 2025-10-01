import tempfile
import unittest
from pathlib import Path

from bridge.models.BridgeConfiguration import (
	parse_bridge_configuration,
	parse_machine_configuration,
	parse_network_configuration,
	parse_price_oracle_configuration,
	parse_strategy_configuration
)


class BridgeConfigurationTest(unittest.TestCase):
	# region configuration templates

	VALID_MACHINE_CONFIGURATION = {
		'databaseDirectory': '_temp',
		'logFilename': 'alpha.log',
		'logBackupCount': '7',
		'maxLogSize': '12345'
	}

	VALID_PRICE_ORACLE_CONFIGURATION = {
		'url': 'https:/oracle.foo/price/v3',
		'accessToken': 'D864696403D4DED92F2C82C3BEE33C41E90304B521F86E6CD37A7C808C9BDF80'
	}

	VALID_STRATEGY_CONFIGURATION = {
		'mode': 'staked'
	}

	VALID_NETWORK_CONFIGURATION = {
		'blockchain': 'foo',
		'network': 'bar',
		'endpoint': 'http://foo.bar.net:1234',
		'bridgeAddress': 'MY_CUSTOM_ADDRESS',
		'mosaicId': 'cool coupons'
	}

	VALID_NETWORK_CONFIGURATION_2 = {
		'blockchain': 'cat',
		'network': 'baz',
		'endpoint': 'https://cat.baz:8888',
		'bridgeAddress': 'cat_baz_address',
		'mosaicId': 'zbaz tokens'
	}

	# endregion

	# region test_utils

	def _assert_cannot_parse_incomplete_configuration(self, parser, config_template):
		# Arrange:
		for key in config_template:
			incomplete_config = {**config_template}
			del incomplete_config[key]

			# Act + Assert:
			with self.assertRaises(KeyError):
				parser(incomplete_config)

	# endregion

	# region machine configuration

	def test_can_parse_valid_machine_configuration(self):
		# Act:
		machine_config = parse_machine_configuration(self.VALID_MACHINE_CONFIGURATION)

		# Assert:
		self.assertEqual('_temp', machine_config.database_directory)
		self.assertEqual('alpha.log', machine_config.log_filename)
		self.assertEqual(7, machine_config.log_backup_count)
		self.assertEqual(12345, machine_config.max_log_size)

	def test_cannot_parse_machine_configuration_incomplete(self):
		self._assert_cannot_parse_incomplete_configuration(parse_machine_configuration, self.VALID_MACHINE_CONFIGURATION)

	# endregion

	# region price oracle configuration

	def test_can_parse_valid_price_oracle_configuration(self):
		# Act:
		price_oracle_config = parse_price_oracle_configuration(self.VALID_PRICE_ORACLE_CONFIGURATION)

		# Assert:
		self.assertEqual('https:/oracle.foo/price/v3', price_oracle_config.url)
		self.assertEqual('D864696403D4DED92F2C82C3BEE33C41E90304B521F86E6CD37A7C808C9BDF80', price_oracle_config.access_token)

	def test_cannot_parse_price_oracle_configuration_incomplete(self):
		self._assert_cannot_parse_incomplete_configuration(parse_price_oracle_configuration, self.VALID_PRICE_ORACLE_CONFIGURATION)

	# endregion

	# region strategy configuration

	def test_can_parse_valid_strategy_configuration(self):
		# Arrange:
		for mode in ('staked', 'wrapped', 'native'):
			# Act:
			strategy_config = parse_strategy_configuration({'mode': mode})

			# Assert:
			self.assertEqual(mode, strategy_config.mode)

	def test_cannot_parse_strategy_configuration_incomplete(self):
		self._assert_cannot_parse_incomplete_configuration(parse_strategy_configuration, self.VALID_STRATEGY_CONFIGURATION)

	def test_cannot_parse_strategy_configuration_invalid(self):
		for mode in ('foo', 'bar'):
			with self.assertRaisesRegex(ValueError, f'mode "{mode}" is not supported'):
				parse_strategy_configuration({'mode': mode})

	# endregion

	# region network configuration

	def test_can_parse_valid_network_configuration(self):
		# Act:
		network_config = parse_network_configuration(self.VALID_NETWORK_CONFIGURATION)

		# Assert:
		self.assertEqual('foo', network_config.blockchain)
		self.assertEqual('bar', network_config.network)
		self.assertEqual('http://foo.bar.net:1234', network_config.endpoint)
		self.assertEqual('MY_CUSTOM_ADDRESS', network_config.bridge_address)
		self.assertEqual('cool coupons', network_config.mosaic_id)
		self.assertEqual({}, network_config.extensions)

	def test_can_parse_valid_network_configuration_with_custom_extensions(self):
		# Act:
		network_config = parse_network_configuration({
			**self.VALID_NETWORK_CONFIGURATION,
			'alpha': 'custom variable',
			'betaGamma': 'another custom variable'
		})

		# Assert:
		self.assertEqual('foo', network_config.blockchain)
		self.assertEqual('bar', network_config.network)
		self.assertEqual('http://foo.bar.net:1234', network_config.endpoint)
		self.assertEqual('MY_CUSTOM_ADDRESS', network_config.bridge_address)
		self.assertEqual('cool coupons', network_config.mosaic_id)
		self.assertEqual({
			'alpha': 'custom variable',
			'beta_gamma': 'another custom variable'
		}, network_config.extensions)

	def test_cannot_parse_network_configuration_incomplete(self):
		self._assert_cannot_parse_incomplete_configuration(parse_network_configuration, self.VALID_NETWORK_CONFIGURATION)

	# endregion

	# region parse_bridge_configuration

	@staticmethod
	def _write_section(outfile, header, pairs):
		outfile.write(f'{header}\n')
		for key, value in pairs.items():
			outfile.write(f'{key} = {value}\n')

	def test_can_parse_bridge_configuration(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as temp_directory:
			configuration_file = Path(temp_directory) / 'foo.properties'

			with open(configuration_file, 'wt', encoding='utf8') as outfile:
				self._write_section(outfile, '[machine]', self.VALID_MACHINE_CONFIGURATION)
				self._write_section(outfile, '\n[price_oracle]', self.VALID_PRICE_ORACLE_CONFIGURATION)
				self._write_section(outfile, '\n[strategy]', self.VALID_STRATEGY_CONFIGURATION)
				self._write_section(outfile, '\n[native_network]', self.VALID_NETWORK_CONFIGURATION)
				self._write_section(outfile, '\n[wrapped_network]', self.VALID_NETWORK_CONFIGURATION_2)

			# Act:
			config = parse_bridge_configuration(configuration_file)

			# Assert:
			self.assertEqual('_temp', config.machine.database_directory)
			self.assertEqual('alpha.log', config.machine.log_filename)
			self.assertEqual(7, config.machine.log_backup_count)
			self.assertEqual(12345, config.machine.max_log_size)

			self.assertEqual('https:/oracle.foo/price/v3', config.price_oracle.url)
			self.assertEqual('D864696403D4DED92F2C82C3BEE33C41E90304B521F86E6CD37A7C808C9BDF80', config.price_oracle.access_token)

			self.assertEqual('staked', config.strategy.mode)

			self.assertEqual('foo', config.native_network.blockchain)
			self.assertEqual('bar', config.native_network.network)
			self.assertEqual('http://foo.bar.net:1234', config.native_network.endpoint)
			self.assertEqual('MY_CUSTOM_ADDRESS', config.native_network.bridge_address)
			self.assertEqual('cool coupons', config.native_network.mosaic_id)
			self.assertEqual({}, config.native_network.extensions)

			self.assertEqual('cat', config.wrapped_network.blockchain)
			self.assertEqual('baz', config.wrapped_network.network)
			self.assertEqual('https://cat.baz:8888', config.wrapped_network.endpoint)
			self.assertEqual('cat_baz_address', config.wrapped_network.bridge_address)
			self.assertEqual('zbaz tokens', config.wrapped_network.mosaic_id)

	def test_cannot_parse_bridge_configuration_incomplete(self):
		# Arrange:
		for section_id in range(3):
			with tempfile.TemporaryDirectory() as temp_directory:
				configuration_file = Path(temp_directory) / 'foo.properties'

				with open(configuration_file, 'wt', encoding='utf8') as outfile:
					if 0 != section_id:
						self._write_section(outfile, '[machine]', self.VALID_MACHINE_CONFIGURATION)

					if 1 != section_id:
						self._write_section(outfile, '\n[native_network]', self.VALID_NETWORK_CONFIGURATION)

					if 2 != section_id:
						self._write_section(outfile, '\n[wrapped_network]', self.VALID_NETWORK_CONFIGURATION_2)

				# Act + Assert:
				with self.assertRaises(KeyError):
					parse_bridge_configuration(configuration_file)

	# endregion
