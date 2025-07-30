from binascii import unhexlify


def make_rpc_request_json(method, params, identifier=1):
	"""Makes an Ethereum RPC request JSON."""

	return {
		'id': identifier,
		'jsonrpc': '2.0',
		'method': method,
		'params': params
	}


def parse_rpc_response_hex_value(hex_value):
	"""Parses a hex value representing an integer in an Ethereum RPC response."""

	hex_value = hex_value[2:]
	if 1 == len(hex_value) % 2:
		hex_value = f'0{hex_value}'

	result_bytes = unhexlify(hex_value)
	return int.from_bytes(result_bytes, 'big')


def parse_rpc_response_hex_bytes(hex_value):
	"""Parses a hex value representing a byte array in an Ethereum RPC response."""

	return unhexlify(hex_value[2:])
