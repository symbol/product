import unittest

from bridge.ethereum.RpcUtils import make_rpc_request_json, parse_rpc_response_hex_bytes, parse_rpc_response_hex_value


class RpcUtilsTest(unittest.TestCase):
	# region make_rpc_request_json

	def test_can_make_rpc_request_json_with_default_identifier(self):
		# Act:
		request_json = make_rpc_request_json('eth_getBlockByNumber', ['finalized', False])

		# Assert:
		self.assertEqual({
			'id': 1,
			'jsonrpc': '2.0',
			'method': 'eth_getBlockByNumber',
			'params': ['finalized', False]
		}, request_json)

	def test_can_make_rpc_request_json_with_custom_identifier(self):
		# Act:
		request_json = make_rpc_request_json('eth_getBlockByNumber', ['finalized', False], 123)

		# Assert:
		self.assertEqual({
			'id': 123,
			'jsonrpc': '2.0',
			'method': 'eth_getBlockByNumber',
			'params': ['finalized', False]
		}, request_json)

	# endregion

	# region parse_rpc_response_hex_value

	def _assert_can_parse_rpc_response_hex_value(self, hex_value, expected_parsed_value):
		# Act:
		parsed_value = parse_rpc_response_hex_value(hex_value)

		# Assert:
		self.assertEqual(expected_parsed_value, parsed_value)

	def test_can_parse_rpc_response_hex_value_with_even_significant_digits(self):
		for separator in ('x', 'X'):
			self._assert_can_parse_rpc_response_hex_value(f'0{separator}AB1234', 0xAB1234)

	def test_can_parse_rpc_response_hex_value_with_odd_significant_digits(self):
		for separator in ('x', 'X'):
			self._assert_can_parse_rpc_response_hex_value(f'0{separator}AB123', 0xAB123)

	def test_can_parse_rpc_response_hex_value_without_hex_prefix(self):
		self._assert_can_parse_rpc_response_hex_value('AB1234', 0xAB1234)

	# endregion

	# region parse_rpc_response_hex_bytes

	def _assert_can_parse_rpc_response_hex_bytes(self, hex_value, expected_parsed_value):
		# Act:
		parsed_value = parse_rpc_response_hex_bytes(hex_value)

		# Assert:
		self.assertEqual(expected_parsed_value, parsed_value)

	def test_can_parse_rpc_response_hex_bytes(self):
		for separator in ('x', 'X'):
			self._assert_can_parse_rpc_response_hex_bytes(
				f'0{separator}67b1d87101671b127f5f8714789c7192f7ad340e',
				bytes([
					0x67, 0xB1, 0xD8, 0x71, 0x01, 0x67, 0x1B, 0x12,
					0x7F, 0x5F, 0x87, 0x14, 0x78, 0x9C, 0x71, 0x92,
					0xF7, 0xAD, 0x34, 0x0E
				]))

	def test_can_parse_rpc_response_hex_bytes_empty(self):
		for separator in ('x', 'X'):
			self._assert_can_parse_rpc_response_hex_bytes(f'0{separator}', bytes())

	def test_can_parse_rpc_response_hex_bytes_without_hex_prefix(self):
		self._assert_can_parse_rpc_response_hex_bytes(
			'67b1d87101671b127f5f8714789c7192f7ad340e',
			bytes([
				0x67, 0xB1, 0xD8, 0x71, 0x01, 0x67, 0x1B, 0x12,
				0x7F, 0x5F, 0x87, 0x14, 0x78, 0x9C, 0x71, 0x92,
				0xF7, 0xAD, 0x34, 0x0E
			]))

	def test_can_parse_rpc_response_hex_bytes_empty_without_hex_prefix(self):
		self._assert_can_parse_rpc_response_hex_bytes('', bytes())

	# endregion
