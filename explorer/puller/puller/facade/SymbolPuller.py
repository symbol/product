import asyncio
import configparser
from collections import defaultdict, namedtuple
from urllib.parse import urlparse

from common.symbol.NodeConfiguration import SymbolNodeConfiguration
from symbolchain.facade.SymbolFacade import SymbolFacade
from symbolchain.symbol.Network import Network
from symbollightapi.connector.SymbolConnector import SymbolConnector
from symbollightapi.model.Exceptions import NodeException
from zenlog import log

from puller.db.SymbolDatabase import SymbolDatabase
from puller.model.symbol.Block import create_block_row
from puller.model.symbol.Receipt import INFLATION_RECEIPT_TYPE, create_receipt_rows
from puller.model.symbol.Transaction import create_transaction_row

DatabaseConfiguration = namedtuple('DatabaseConfiguration', ['database', 'user', 'password', 'host', 'port'])
MAX_PAGE_SIZE = 100
BLOCK_PAGE_FETCH_CONCURRENCY = 10


def _get_symbol_network(network_type):
	if 'mainnet' == network_type:
		return Network.MAINNET
	if 'testnet' == network_type:
		return Network.TESTNET

	raise ValueError(f'Unsupported Symbol network "{network_type}". Supported values: mainnet, testnet')


class SymbolRollbackError(RuntimeError):
	"""Raised when Symbol rollback repair is outside the safe Backend2 scope."""


def _raise_if_node_error(response):
	if isinstance(response, dict) and 'code' in response and 'message' in response:
		raise NodeException(f'{response["code"]}: {response["message"]}')


class SymbolPuller:
	"""Facade for pulling data from Symbol network."""

	def __init__(  # pylint: disable=too-many-arguments,too-many-positional-arguments
		self,
		node_url,
		config_file,
		network_type='mainnet',
		node_config=None,
		connector=None
	):
		"""Creates a Symbol puller facade object."""

		config = configparser.ConfigParser()
		config.read(config_file)

		db_config = config['symbol_db']

		network = _get_symbol_network(network_type)

		self.symbol_db = SymbolDatabase(DatabaseConfiguration(**db_config))
		self.node_config = node_config or SymbolNodeConfiguration.from_url(node_url)
		symbol_node_endpoint = self.node_config.assert_request_allowed(self.node_config.base_url)
		self._symbol_connector = connector or SymbolConnector(symbol_node_endpoint)
		self._symbol_connector.timeout_seconds = self.node_config.timeout_seconds
		self.symbol_facade = SymbolFacade(network)
		self._retry_delay = 2

	def __enter__(self):
		self.symbol_db.__enter__()
		return self

	def __exit__(self, *args):
		self.symbol_db.__exit__(*args)

	def _validate_symbol_node_path(self, url_path):
		parsed_url = urlparse(url_path)
		if parsed_url.scheme or parsed_url.netloc:
			raise ValueError('Symbol node connector paths must be relative')
		if parsed_url.fragment:
			raise ValueError('Symbol node connector paths must not include fragments')

		normalized_path = url_path.lstrip('/')
		self.node_config.assert_request_allowed(self.node_config.base_url)

		return normalized_path

	@staticmethod
	async def _retry_operation(operation, description, retries=3, delay=2):
		"""Retries a Symbol node operation with exponential backoff."""

		for attempt_index in range(retries):
			try:
				response = await operation()
				_raise_if_node_error(response)
				return response
			except NodeException as error:
				attempt = attempt_index + 1
				if retries == attempt:
					log.error(f'Failed {description} after {retries} attempts: {error}')
					raise

				wait_time = delay * (2 ** attempt_index)
				log.warning(f'Error {description} (attempt {attempt}/{retries}): {error}. Retrying in {wait_time}s...')
				await asyncio.sleep(wait_time)

	async def get_symbol_node(self, url_path, property_name=None, not_found_as_error=True):
		"""Validates and dispatches a Symbol node GET request."""

		normalized_path = self._validate_symbol_node_path(url_path)
		return await self._retry_operation(
			lambda: self._symbol_connector.get(normalized_path, property_name, not_found_as_error),
			f'fetching Symbol node path {normalized_path}',
			delay=self._retry_delay
		)

	async def post_symbol_node(self, url_path, request_payload, property_name=None, not_found_as_error=True):
		"""Validates and dispatches a Symbol node POST request."""

		normalized_path = self._validate_symbol_node_path(url_path)
		return await self._retry_operation(
			lambda: self._symbol_connector.post(normalized_path, request_payload, property_name, not_found_as_error),
			f'posting Symbol node path {normalized_path}',
			delay=self._retry_delay
		)

	async def sync_block_headers(self, max_height=None):
		"""Synchronizes Symbol block headers from the configured node."""

		chain_info = await self.get_symbol_node('/chain/info')
		network_properties = await self.get_symbol_node('/network/properties')
		chain_height = self._get_sync_chain_height(int(chain_info['height']), max_height)
		finalized_height, finalized_hash, finalized_epoch, finalized_point, is_finalization_capped = (
			self._get_finalized_watermark(chain_info, chain_height)
		)
		epoch_adjustment_seconds = self._parse_epoch_adjustment(network_properties)
		sync_state = self._get_bounded_sync_state(self.symbol_db.get_sync_state(), chain_height)
		if is_finalization_capped and sync_state and sync_state['last_synced_height'] >= finalized_height:
			finalized_hash = self.symbol_db.get_block_hash(finalized_height)

		start_height = await self._repair_unfinalized_rollback(sync_state, finalized_height, finalized_hash)
		if not start_height:
			start_height = (sync_state['last_synced_height'] + 1) if sync_state and sync_state['last_synced_height'] else 1

		last_synced_height, last_synced_block_hash = await self._sync_block_pages(start_height, chain_height, epoch_adjustment_seconds)
		if last_synced_height is None and sync_state:
			last_synced_height = sync_state['last_synced_height']
			last_synced_block_hash = sync_state['last_synced_block_hash']
		if is_finalization_capped:
			finalized_hash = last_synced_block_hash if finalized_height == last_synced_height else self.symbol_db.get_block_hash(finalized_height)
			if not finalized_hash:
				raise ValueError(f'Unable to determine finalized hash for height {finalized_height}')

		self.symbol_db.upsert_sync_state({
			'status': 'healthy',
			'chain_height': chain_height,
			'finalized_height': finalized_height,
			'finalized_hash': finalized_hash,
			'finalized_epoch': finalized_epoch,
			'finalized_point': finalized_point,
			'last_synced_height': last_synced_height,
			'last_synced_block_hash': last_synced_block_hash
		})

	@staticmethod
	def _get_sync_chain_height(node_chain_height, max_height):
		if max_height is None:
			return node_chain_height
		if max_height < 1:
			raise ValueError('max_height must be greater than or equal to 1')

		return min(node_chain_height, max_height)

	@staticmethod
	def _get_finalized_watermark(chain_info, chain_height):
		finalized_block = chain_info['latestFinalizedBlock']
		node_finalized_height = int(finalized_block['height'])
		if node_finalized_height > chain_height:
			return chain_height, None, None, None, True

		return (
			node_finalized_height,
			bytes.fromhex(finalized_block['hash']),
			finalized_block['finalizationEpoch'],
			finalized_block['finalizationPoint'],
			False
		)

	def _get_bounded_sync_state(self, sync_state, chain_height):
		if not sync_state or not sync_state['last_synced_height'] or sync_state['last_synced_height'] <= chain_height:
			return sync_state

		return {
			**sync_state,
			'chain_height': chain_height,
			'last_synced_height': chain_height,
			'last_synced_block_hash': self.symbol_db.get_block_hash(chain_height)
		}

	async def _repair_unfinalized_rollback(self, sync_state, finalized_height, finalized_hash):
		if not sync_state or not sync_state['last_synced_height']:
			return None

		db_finalized_hash = self.symbol_db.get_block_hash(finalized_height)
		if 0 < finalized_height <= sync_state['last_synced_height'] and not db_finalized_hash:
			self.symbol_db.upsert_sync_state({
				**sync_state,
				'status': 'unhealthy',
				'finalized_height': finalized_height,
				'finalized_hash': finalized_hash
			})
			raise SymbolRollbackError('Finalized block is missing from local database')
		if db_finalized_hash and bytes(db_finalized_hash) != bytes(finalized_hash):
			self.symbol_db.upsert_sync_state({
				**sync_state,
				'status': 'unhealthy',
				'finalized_height': finalized_height,
				'finalized_hash': finalized_hash
			})
			raise SymbolRollbackError('Finalized block hash does not match local database')

		verify_start_height = finalized_height + 1
		if verify_start_height > sync_state['last_synced_height']:
			return None

		expected_height = verify_start_height
		for height, local_hash in self.symbol_db.get_block_hashes(verify_start_height, sync_state['last_synced_height']):
			if height != expected_height:
				return self._repair_from_height(expected_height, sync_state)

			remote_block = await self.get_symbol_node(f'/blocks/{height}')
			if bytes(local_hash) != bytes.fromhex(remote_block['meta']['hash']):
				return self._repair_from_height(height, sync_state)
			expected_height += 1

		if expected_height <= sync_state['last_synced_height']:
			return self._repair_from_height(expected_height, sync_state)

		return None

	def _repair_from_height(self, height, sync_state):
		self.symbol_db.repair_rollback_from_height(height, {
			**sync_state,
			'status': 'repairing',
			'last_synced_height': height - 1,
			'last_synced_block_hash': self.symbol_db.get_block_hash(height - 1)
		})
		return height

	async def _sync_block_pages(self, start_height, chain_height, epoch_adjustment_seconds):
		last_synced_height = None
		last_synced_block_hash = None
		all_offsets = range(start_height - 1, chain_height, MAX_PAGE_SIZE)

		for batch_start in range(0, len(all_offsets), BLOCK_PAGE_FETCH_CONCURRENCY):
			batch_offsets = all_offsets[batch_start:batch_start + BLOCK_PAGE_FETCH_CONCURRENCY]
			pages = await asyncio.gather(*[self._get_block_page(offset) for offset in batch_offsets])

			batch_rows = []
			for offset, blocks in zip(batch_offsets, pages):
				if not blocks:
					raise ValueError(f'Expected Symbol blocks at offset {offset} before chain height {chain_height}')

				rows = [
					create_block_row(block, epoch_adjustment_seconds, self.symbol_facade.network)
					for block in blocks
					if int(block['block']['height']) <= chain_height
				]
				if not rows:
					raise ValueError(f'Symbol block page at offset {offset} does not contain blocks at or below chain height {chain_height}')

				self._validate_block_page(rows, offset + 1)
				last_row = rows[-1]
				if len(blocks) < MAX_PAGE_SIZE and last_row['height'] < chain_height:
					raise ValueError(f'Short Symbol block page ended at height {last_row["height"]} before chain height {chain_height}')

				batch_rows.extend(rows)
				last_synced_height = last_row['height']
				last_synced_block_hash = last_row['hash']

				if len(blocks) < MAX_PAGE_SIZE:
					await self._sync_block_batch(batch_rows, epoch_adjustment_seconds)
					await self._sync_receipts_for_batch(batch_rows)
					return last_synced_height, last_synced_block_hash

			await self._sync_block_batch(batch_rows, epoch_adjustment_seconds)
			await self._sync_receipts_for_batch(batch_rows)

		return last_synced_height, last_synced_block_hash

	async def _sync_block_batch(self, batch_rows, epoch_adjustment_seconds):
		transaction_rows_by_height = await self._get_transaction_rows_by_height(
			batch_rows[0]['height'],
			batch_rows[-1]['height'],
			epoch_adjustment_seconds
		)
		self.symbol_db.upsert_blocks(batch_rows)
		self._upsert_transactions_for_batch(batch_rows, transaction_rows_by_height)

	def _upsert_transactions_for_batch(self, block_rows, rows_by_height):
		for row in block_rows:
			self.symbol_db.upsert_transactions_for_height(row['height'], rows_by_height.get(row['height'], []))

	async def _get_transaction_rows_by_height(self, start_height, end_height, epoch_adjustment_seconds):
		rows_by_height = {}
		page_number = 1
		while True:
			response = await self.get_symbol_node(
				f'/transactions/confirmed?fromHeight={start_height}&toHeight={end_height}'
				f'&pageSize={MAX_PAGE_SIZE}&pageNumber={page_number}&order=asc&embedded=true'
			)
			if not isinstance(response, dict) or 'data' not in response:
				raise ValueError('Malformed Symbol transaction page response')

			items = response['data']
			for item in items:
				row = create_transaction_row(item, self.symbol_facade.network, epoch_adjustment_seconds)
				rows_by_height.setdefault(row['height'], []).append(row)

			if len(items) < MAX_PAGE_SIZE:
				return rows_by_height

			page_number += 1

	async def _get_block_page(self, offset):
		response = await self.get_symbol_node(f'/blocks?pageSize={MAX_PAGE_SIZE}&offset={offset}&orderBy=height')
		if not isinstance(response, dict) or 'data' not in response:
			raise ValueError('Malformed Symbol block page response')

		return response['data']

	async def _get_receipt_rows_by_height(self, start_height, end_height):
		statement_items = []
		page_number = 1
		while True:
			response = await self.get_symbol_node(
				f'/statements/transaction?fromHeight={start_height}&toHeight={end_height}'
				f'&pageSize={MAX_PAGE_SIZE}&pageNumber={page_number}'
			)
			items = response['data']
			statement_items.extend(items)
			if len(items) < MAX_PAGE_SIZE:
				break

			page_number += 1

		rows_by_height = defaultdict(list)
		for statement_item in statement_items:
			for row in create_receipt_rows(statement_item):
				rows_by_height[row['height']].append(row)

		return dict(rows_by_height)

	@staticmethod
	def _calculate_block_reward(receipts):
		return sum(receipt['amount'] for receipt in receipts if INFLATION_RECEIPT_TYPE == receipt['receipt_type'])

	async def _sync_receipts_for_batch(self, block_rows):
		rows_by_height = await self._get_receipt_rows_by_height(block_rows[0]['height'], block_rows[-1]['height'])
		for row in block_rows:
			receipt_rows = rows_by_height.get(row['height'], [])
			block_reward = self._calculate_block_reward(receipt_rows)
			self.symbol_db.upsert_receipts_for_height(row['height'], receipt_rows, block_reward)

	@staticmethod
	def _parse_epoch_adjustment(network_properties):
		raw_epoch_adjustment = network_properties['network']['epochAdjustment']
		raw_epoch_adjustment = str(raw_epoch_adjustment)
		return int(raw_epoch_adjustment[:-1] if raw_epoch_adjustment.endswith('s') else raw_epoch_adjustment)

	@staticmethod
	def _validate_block_page(rows, expected_start_height):
		for index, row in enumerate(rows):
			expected_height = expected_start_height + index
			if row['height'] != expected_height:
				raise ValueError(f'Unexpected Symbol block height {row["height"]}; expected {expected_height}')
