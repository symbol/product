from binascii import hexlify

import sha3
from symbollightapi.connector.BasicConnector import BasicConnector

from .EthereumAdapters import EthereumNetworkTimestamp
from .RpcUtils import make_rpc_request_json, parse_rpc_response_hex_value


class EthereumConnector(BasicConnector):
	"""Async connector for interacting with an Ethereum node."""

	def __init__(self, endpoint, is_finalization_supported=True):
		"""Creates an Ethereum async connector."""

		super().__init__(endpoint)
		self.is_finalization_supported = is_finalization_supported

	# region extract_transaction_id, extract_block_timestamp

	@staticmethod
	def extract_transaction_id(transaction):
		"""Extracts the transaction id from a REST transaction JSON object."""

		# this is only used for indexing and doesn't need to be unique
		return transaction['meta']['height']

	@staticmethod
	def extract_block_timestamp(block):
		"""Extracts the block timestamp from a REST block header JSON object."""

		return parse_rpc_response_hex_value(block['timestamp'])

	# endregion

	# region _format_block_identifier, _make_eth_call

	@staticmethod
	def _format_block_identifier(block_identifier):
		return f'0x{block_identifier:X}' if isinstance(block_identifier, int) else block_identifier

	async def _make_eth_call(self, function_name, account_address, token_contract_address, block_identifier):
		function_hash = hexlify(sha3.keccak_256(function_name.encode('utf8')).digest()).decode('utf8')

		data_param = f'0x{function_hash[:8]}'
		if account_address:
			data_param = f'{data_param}{"0" * 24}{str(account_address)[2:]}'

		request_json = make_rpc_request_json('eth_call', [
			{
				'data': data_param,
				'to': token_contract_address
			},
			self._format_block_identifier(block_identifier)
		])

		result_json = await self.post('', request_json)
		return parse_rpc_response_hex_value(result_json['result'])

	# endregion

	# region chain_height, finalized_chain_height, network_time

	async def chain_height(self):
		"""Gets chain height."""

		request_json = make_rpc_request_json('eth_blockNumber', [])
		result_json = await self.post('', request_json)
		return parse_rpc_response_hex_value(result_json['result'])

	async def finalized_chain_height(self):
		"""Gets finalized chain height."""

		block_identifier = 'finalized' if self.is_finalization_supported else 'latest'
		request_json = make_rpc_request_json('eth_getBlockByNumber', [block_identifier, False])
		result_json = await self.post('', request_json)
		return parse_rpc_response_hex_value(result_json['result']['number'])

	async def network_time(self):
		"""Gets network time."""

		request_json = make_rpc_request_json('eth_getBlockByNumber', ['latest', False])
		result_json = await self.post('', request_json)
		timestamp = parse_rpc_response_hex_value(result_json['result']['timestamp'])
		return EthereumNetworkTimestamp(timestamp)

	# endregion

	# region block_headers

	async def block_headers(self, height):
		"""Gets block headers."""

		request_json = make_rpc_request_json('eth_getBlockByNumber', [hex(height), False])
		result_json = await self.post('', request_json)
		return result_json['result']

	# endregion

	# region balance

	async def balance(self, account_address, token_contract_address, block_identifier='latest'):
		"""Gets account balance for specified token."""

		balance = await self._make_eth_call('balanceOf(address)', account_address, token_contract_address, block_identifier)
		return balance

	# endregion

	# region nonce

	async def nonce(self, account_address, block_identifier='latest'):
		"""Gets account nonce."""

		request_json = make_rpc_request_json('eth_getTransactionCount', [
			str(account_address),
			self._format_block_identifier(block_identifier)
		])
		result_json = await self.post('', request_json)
		return parse_rpc_response_hex_value(result_json['result'])

	# endregion

	# region token_precision

	async def token_precision(self, token_contract_address, block_identifier='latest'):
		"""Gets the precision of the specified token."""

		precision = await self._make_eth_call('decimals()', None, token_contract_address, block_identifier)
		return precision

	# endregion

	# region incoming_transactions

	async def incoming_transactions(self, account_address, start_id=None):
		"""Gets incoming transactions for the specified account."""

		request_json = make_rpc_request_json('ots_searchTransactionsBefore', [str(account_address), start_id or 0, 25])
		result_json = await self.post('', request_json)
		return [
			{
				'meta': {'height': parse_rpc_response_hex_value(transaction_json['blockNumber'])},
				'transaction': transaction_json
			} for transaction_json in result_json['result']['txs']
		]

	# endregion
