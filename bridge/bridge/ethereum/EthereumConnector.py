import asyncio
from binascii import hexlify
from collections import namedtuple
from statistics import median_high

import sha3
from aiolimiter import AsyncLimiter
from symbollightapi.connector.BasicConnector import BasicConnector
from symbollightapi.model.Constants import DEFAULT_ASYNC_LIMITER_ARGUMENTS, TransactionStatus
from symbollightapi.model.Exceptions import NodeException

from .EthereumAdapters import EthereumNetworkTimestamp
from .RpcUtils import make_rpc_request_json, parse_rpc_response_hex_value

FeeInformation = namedtuple('FeeInformation', ['base_fee', 'priority_fee'])


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

	# region utils

	async def _post_rpc(self, request_json):
		response_json = await self.post('', request_json)
		if 'error' in response_json:
			raise NodeException(f'{request_json["method"]} RPC call failed: {response_json["error"]["message"]}')

		return response_json['result']

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

		result_json = await self._post_rpc(request_json)
		return parse_rpc_response_hex_value(result_json)

	# endregion

	# region chain_height, finalized_chain_height, network_time

	async def chain_height(self):
		"""Gets chain height."""

		request_json = make_rpc_request_json('eth_blockNumber', [])
		result_json = await self._post_rpc(request_json)
		return parse_rpc_response_hex_value(result_json)

	async def finalized_chain_height(self):
		"""Gets finalized chain height."""

		block_identifier = 'finalized' if self.is_finalization_supported else 'latest'
		request_json = make_rpc_request_json('eth_getBlockByNumber', [block_identifier, False])
		result_json = await self._post_rpc(request_json)
		return parse_rpc_response_hex_value(result_json['number'])

	async def network_time(self):
		"""Gets network time."""

		request_json = make_rpc_request_json('eth_getBlockByNumber', ['latest', False])
		result_json = await self._post_rpc(request_json)
		timestamp = parse_rpc_response_hex_value(result_json['timestamp'])
		return EthereumNetworkTimestamp(timestamp)

	# endregion

	# region block_headers

	async def block_headers(self, height):
		"""Gets block headers."""

		request_json = make_rpc_request_json('eth_getBlockByNumber', [hex(height), False])
		result_json = await self._post_rpc(request_json)
		return result_json

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
		result_json = await self._post_rpc(request_json)
		return parse_rpc_response_hex_value(result_json)

	# endregion

	# region token_precision

	async def token_precision(self, token_contract_address, block_identifier='latest'):
		"""Gets the precision of the specified token."""

		precision = await self._make_eth_call('decimals()', None, token_contract_address, block_identifier)
		return precision

	# endregion

	# region gas_price, estimate_gas, estimate_fees_from_history

	async def gas_price(self):
		"""Gets the current estimated gas price."""

		request_json = make_rpc_request_json('eth_gasPrice', [])
		result_json = await self._post_rpc(request_json)
		return parse_rpc_response_hex_value(result_json)

	async def estimate_gas(self, transaction_object):
		"""Gets the current estimated amount of gas for the specified transaction."""

		request_json = make_rpc_request_json('eth_estimateGas', [transaction_object])
		result_json = await self._post_rpc(request_json)
		return parse_rpc_response_hex_value(result_json)

	async def estimate_fees_from_history(self, blocks_count):
		"""Gets the estimated gas prices from history."""

		request_json = make_rpc_request_json('eth_feeHistory', [blocks_count, 'latest', [50]])
		result_json = await self._post_rpc(request_json)

		median_priority_fees = [parse_rpc_response_hex_value(reward[0]) for reward in result_json['reward']]
		median_priority_fee = median_high(median_priority_fees)

		next_base_fee = parse_rpc_response_hex_value(result_json['baseFeePerGas'][-1])

		return FeeInformation(next_base_fee, median_priority_fee)

	# endregion

	# region filter_confirmed_transactions

	async def _transaction_status_and_height_by_hash(self, transaction_hash):
		request_json = make_rpc_request_json('eth_getTransactionByHash', [f'0x{transaction_hash}'])
		transaction_json = await self._post_rpc(request_json)
		if not transaction_json:
			return (None, 0)

		block_number = transaction_json.get('blockNumber', None)
		if block_number is None:
			return (TransactionStatus.UNCONFIRMED, None)

		return (TransactionStatus.CONFIRMED, parse_rpc_response_hex_value(block_number))

	async def filter_confirmed_transactions(self, transaction_hashes, async_limiter_arguments=DEFAULT_ASYNC_LIMITER_ARGUMENTS):
		"""Filters transaction hashes and returns only confirmed ones with (confirmed) heights."""

		limiter = AsyncLimiter(*async_limiter_arguments)

		async def get_transaction_hash_height_pair(transaction_hash):
			async with limiter:
				(status, height) = await self._transaction_status_and_height_by_hash(transaction_hash)
				return (transaction_hash if TransactionStatus.CONFIRMED == status else None, height)

		tasks = [get_transaction_hash_height_pair(transaction_hash) for transaction_hash in transaction_hashes]
		transaction_hash_height_pairs = await asyncio.gather(*tasks)

		return [
			transaction_hash_height_pair
			for transaction_hash_height_pair in transaction_hash_height_pairs
			if transaction_hash_height_pair[0]
		]

	# endregion

	# region incoming_transactions

	async def incoming_transactions(self, account_address, start_id=None):
		"""Gets incoming transactions for the specified account."""

		request_json = make_rpc_request_json('ots_searchTransactionsBefore', [str(account_address), start_id or 0, 25])
		result_json = await self._post_rpc(request_json)

		transaction_hash_to_status = {
			receipt_json['transactionHash']: 1 == parse_rpc_response_hex_value(receipt_json['status'])
			for receipt_json in result_json['receipts']
		}

		return [
			{
				'meta': {
					'height': parse_rpc_response_hex_value(transaction_json['blockNumber']),
					'isSuccess': transaction_hash_to_status.get(transaction_json['hash'], False)  # map unknown hashes to failure
				},
				'transaction': transaction_json
			} for transaction_json in result_json['txs']
		]

	# endregion

	# region announce_transaction

	async def announce_transaction(self, transaction_payload):
		"""Announces a transaction to the network."""

		raw_transaction_hex = hexlify(transaction_payload['signature'].raw_transaction).decode('utf8')
		request_json = make_rpc_request_json('eth_sendRawTransaction', [f'0x{raw_transaction_hex}'])
		await self._post_rpc(request_json)

	# endregion

	# region try_wait_for_announced_transaction

	async def try_wait_for_announced_transaction(self, transaction_hash, desired_status, timeout_settings):
		"""Tries to wait for a previously announced transaction to transition to a desired status."""

		for _ in range(timeout_settings.retry_count):
			try:
				(status, _) = await self._transaction_status_and_height_by_hash(transaction_hash)
				if status and status.value >= desired_status.value:
					return True
			except NodeException:
				# ignore 400 not found errors (not_found_as_error will not work because these are not 404)
				await asyncio.sleep(timeout_settings.interval)

		return False

	# endregion
