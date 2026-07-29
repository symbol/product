# pylint: disable=too-many-lines

import asyncio
import configparser
import uuid
from collections import defaultdict, namedtuple
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

from common.symbol.NodeConfiguration import SymbolNodeConfiguration
from symbolchain.facade.SymbolFacade import SymbolFacade
from symbolchain.sc import TransactionType
from symbolchain.symbol.Network import Address, Network
from symbollightapi.connector.SymbolConnector import SymbolConnector
from symbollightapi.model.Exceptions import NodeException
from zenlog import log

from puller.db.SymbolDatabase import RollbackRefreshEntries, SymbolDatabase
from puller.facade.RequestRateLimiter import RequestRateLimiter
from puller.model.symbol.Account import HARVESTING_ACTIVE_WINDOW_DAYS, create_account_row, create_multisig_row
from puller.model.symbol.Block import create_block_row
from puller.model.symbol.Lock import (
	RollbackLockKeys,
	create_hash_lock_key_from_hex,
	create_hash_lock_row,
	create_secret_lock_row,
	create_secret_lock_search_key_from_hex_secret,
	lock_hash_algorithm_label
)
from puller.model.symbol.Metadata import METADATA_TRANSACTION_TYPE_LABELS, METADATA_TYPE_NUMBERS, create_metadata_row
from puller.model.symbol.Mosaic import create_mosaic_row
from puller.model.symbol.Namespace import create_alias_name_rows, create_namespace_row
from puller.model.symbol.Receipt import (
	INFLATION_RECEIPT_TYPE,
	MOSAIC_EXPIRED_RECEIPT_TYPE,
	NAMESPACE_DELETED_RECEIPT_TYPE,
	NAMESPACE_EXPIRED_RECEIPT_TYPE,
	create_receipt_rows
)
from puller.model.symbol.Resolution import is_alias_mosaic_id, select_resolution_entry
from puller.model.symbol.Transaction import create_transaction_row, unique_address_rows

DatabaseConfiguration = namedtuple('DatabaseConfiguration', ['database', 'user', 'password', 'host', 'port'])
NativeMosaicInfo = namedtuple('NativeMosaicInfo', ['id', 'divisibility'])
TransactionSource = namedtuple('TransactionSource', ['primary_id', 'secondary_id'])
ResolutionStatements = namedtuple('ResolutionStatements', ['address', 'mosaic'])
ResolutionRequest = namedtuple('ResolutionRequest', ['height', 'kind'])
MAX_PAGE_SIZE = 100
ACCOUNT_BATCH_FETCH_SIZE = MAX_PAGE_SIZE
BLOCK_PAGE_FETCH_CONCURRENCY = 10
RESOLUTION_FETCH_CONCURRENCY = 10
METADATA_FETCH_CONCURRENCY = 10
LOCK_FETCH_CONCURRENCY = 10
DEFAULT_MAX_REQUESTS_PER_SECOND = 20
ACCOUNT_PAGE_SIZE = 100


def _get_symbol_network(network_type):
	if 'mainnet' == network_type:
		return Network.MAINNET
	if 'testnet' == network_type:
		return Network.TESTNET

	raise ValueError(f'Unsupported Symbol network "{network_type}". Supported values: mainnet, testnet')


class SymbolRollbackError(RuntimeError):
	"""Raised when Symbol rollback repair is outside the safe Backend2 scope."""


def _raise_if_node_error(response, allow_not_found=False):
	if isinstance(response, dict) and 'code' in response and 'message' in response:
		if allow_not_found and 'ResourceNotFound' == response.get('code'):
			return

		raise NodeException(f'{response["code"]}: {response["message"]}')


def _is_not_found_response(response):
	return isinstance(response, dict) and 'ResourceNotFound' == response.get('code')


class SymbolPuller:
	"""Facade for pulling data from Symbol network."""

	def __init__(  # pylint: disable=too-many-arguments,too-many-positional-arguments
		self,
		node_url,
		config_file,
		network_type='mainnet',
		node_config=None,
		connector=None,
		max_requests_per_second=DEFAULT_MAX_REQUESTS_PER_SECOND,
		rate_limiter=None
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
		self._rate_limiter = rate_limiter or RequestRateLimiter(max_requests_per_second)
		self._native_mosaic_info = None
		self._network_properties = None

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

	async def _retry_operation(self, operation, description, retries=3, not_found_as_error=True):
		"""Retries a Symbol node operation with exponential backoff."""

		for attempt_index in range(retries):
			try:
				await self._rate_limiter.wait_for_turn()
				response = await operation()
				_raise_if_node_error(response, allow_not_found=not not_found_as_error)
				return response
			except NodeException as error:
				attempt = attempt_index + 1
				if retries == attempt:
					log.error(f'Failed {description} after {retries} attempts: {error}')
					raise

				wait_time = self._retry_delay * (2 ** attempt_index)
				log.warning(f'Error {description} (attempt {attempt}/{retries}): {error}. Retrying in {wait_time}s...')
				await asyncio.sleep(wait_time)

	async def get_symbol_node(self, url_path, property_name=None, not_found_as_error=True):
		"""Validates and dispatches a Symbol node GET request."""

		normalized_path = self._validate_symbol_node_path(url_path)
		return await self._retry_operation(
			lambda: self._symbol_connector.get(normalized_path, property_name, not_found_as_error),
			f'fetching Symbol node path {normalized_path}',
			not_found_as_error=not_found_as_error
		)

	async def post_symbol_node(self, url_path, request_payload, property_name=None, not_found_as_error=True):
		"""Validates and dispatches a Symbol node POST request."""

		normalized_path = self._validate_symbol_node_path(url_path)
		return await self._retry_operation(
			lambda: self._symbol_connector.post(normalized_path, request_payload, property_name, not_found_as_error),
			f'posting Symbol node path {normalized_path}',
			not_found_as_error=not_found_as_error
		)

	async def sync_block_headers(self, max_height=None):  # pylint: disable=too-many-locals
		"""Synchronizes Symbol block headers from the configured node."""

		chain_info = await self.get_symbol_node('/chain/info')
		network_properties = await self._get_network_properties()
		chain_height = self._get_sync_chain_height(int(chain_info['height']), max_height)
		finalized_height, finalized_hash, finalized_epoch, finalized_point, is_finalization_capped = (
			self._get_finalized_watermark(chain_info, chain_height)
		)
		epoch_adjustment_seconds = self._parse_epoch_adjustment(network_properties)
		native_mosaic_info = await self._get_native_mosaic_info()
		sync_state = self._get_bounded_sync_state(self.symbol_db.get_sync_state(), chain_height)
		if is_finalization_capped and sync_state and sync_state['last_synced_height'] >= finalized_height:
			finalized_hash = self.symbol_db.get_block_hash(finalized_height)

		start_height = await self._repair_unfinalized_rollback(sync_state, finalized_height, finalized_hash)
		if not start_height:
			start_height = (sync_state['last_synced_height'] + 1) if sync_state and sync_state['last_synced_height'] else 1

		last_synced_height, last_synced_block_hash = await self._sync_block_pages(
			start_height,
			chain_height,
			epoch_adjustment_seconds,
			native_mosaic_info)
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
				return await self._repair_from_height(expected_height, sync_state)

			remote_block = await self.get_symbol_node(f'/blocks/{height}')
			if bytes(local_hash) != bytes.fromhex(remote_block['meta']['hash']):
				return await self._repair_from_height(height, sync_state)
			expected_height += 1

		if expected_height <= sync_state['last_synced_height']:
			return await self._repair_from_height(expected_height, sync_state)

		return None

	async def _repair_from_height(self, height, sync_state):
		# Unlike account/multisig rows (deleted by the repair and repopulated by the next dirty-key touch or
		# refresh snapshot run), namespaces, mosaics, and metadata have no broad re-dirty signal: only
		# registration, alias, supply, expiry, or metadata events touch their keys, and none may recur after a
		# fork. Re-fetch node state before the repair write and apply it in the same transaction, deleting an
		# artifact only when the node confirms it is gone.
		namespace_ids = self.symbol_db.get_namespace_ids_updated_from_height(height)
		namespace_entries = await self._fetch_dirty_namespaces(namespace_ids, height - 1)
		mosaic_ids = self.symbol_db.get_mosaic_ids_updated_from_height(height)
		mosaic_entries = await self._fetch_dirty_mosaics(mosaic_ids, height - 1)
		metadata_keys = self.symbol_db.get_metadata_keys_updated_from_height(height)
		metadata_entries = await self._fetch_dirty_metadata(metadata_keys, height - 1)
		rollback_transaction_keys = self.symbol_db.get_lock_keys_from_confirmed_transactions_from_height(height)
		hash_lock_keys = self._union_hash_lock_keys(
			self.symbol_db.get_hash_lock_hashes_updated_from_height(height),
			rollback_transaction_keys.hash_keys)
		secret_lock_keys = self._union_secret_lock_keys(
			self.symbol_db.get_secret_lock_search_keys_updated_from_height(height),
			rollback_transaction_keys.secret_keys)
		hash_lock_entries = await self._fetch_dirty_hash_locks(hash_lock_keys, height - 1)
		secret_lock_entries = await self._fetch_dirty_secret_locks(secret_lock_keys, height - 1)
		self.symbol_db.repair_rollback_from_height(height, {
			**sync_state,
			'status': 'repairing',
			'last_synced_height': height - 1,
			'last_synced_block_hash': self.symbol_db.get_block_hash(height - 1)
		}, RollbackRefreshEntries(
			namespace_entries,
			mosaic_entries,
			metadata_entries,
			hash_lock_entries,
			secret_lock_entries))
		return height

	async def _sync_block_pages(  # pylint: disable=too-many-locals
		self,
		start_height,
		chain_height,
		epoch_adjustment_seconds,
		native_mosaic_info
	):
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
					await self._sync_block_batch_with_dirty_state(
						batch_rows, epoch_adjustment_seconds, native_mosaic_info)
					return last_synced_height, last_synced_block_hash

			await self._sync_block_batch_with_dirty_state(
				batch_rows, epoch_adjustment_seconds, native_mosaic_info)

		return last_synced_height, last_synced_block_hash

	async def _sync_block_batch_with_dirty_state(  # pylint: disable=too-many-locals
		self,
		batch_rows,
		epoch_adjustment_seconds,
		native_mosaic_info
	):
		transaction_rows_by_height = await self._get_transaction_rows_by_height(
			batch_rows[0]['height'],
			batch_rows[-1]['height'],
			epoch_adjustment_seconds
		)
		receipt_rows_by_height = await self._get_receipt_rows_by_height(batch_rows[0]['height'], batch_rows[-1]['height'])
		await self._resolve_transaction_rows_for_batch(transaction_rows_by_height)
		dirty_addresses = self._collect_dirty_addresses_for_batch(
			batch_rows,
			transaction_rows_by_height,
			receipt_rows_by_height)
		observed_height = max(row['height'] for row in batch_rows)
		dirty_account_rows = await self._fetch_dirty_accounts_for_batch(
			dirty_addresses,
			observed_height,
			native_mosaic_info)
		dirty_namespace_ids = self._expand_dirty_namespace_ids(
			self._collect_dirty_namespace_ids_for_batch(transaction_rows_by_height, receipt_rows_by_height))
		dirty_namespace_entries = await self._fetch_dirty_namespaces(dirty_namespace_ids, observed_height)
		dirty_mosaic_ids = self._collect_dirty_mosaic_ids_for_batch(transaction_rows_by_height, receipt_rows_by_height)
		dirty_mosaic_entries = await self._fetch_dirty_mosaics(dirty_mosaic_ids, observed_height)
		dirty_metadata_keys = self._collect_dirty_metadata_keys_for_batch(transaction_rows_by_height)
		dirty_metadata_entries = await self._fetch_dirty_metadata(dirty_metadata_keys, observed_height)
		dirty_lock_keys = self._collect_dirty_lock_keys_for_batch(
			batch_rows,
			transaction_rows_by_height)
		dirty_hash_lock_entries = await self._fetch_dirty_hash_locks(dirty_lock_keys.hash_keys, observed_height)
		dirty_secret_lock_entries = await self._fetch_dirty_secret_locks(dirty_lock_keys.secret_keys, observed_height)
		self._sync_block_batch(batch_rows, transaction_rows_by_height, receipt_rows_by_height)
		self._write_dirty_accounts_for_batch(dirty_account_rows)
		self.symbol_db.apply_namespace_entries(dirty_namespace_entries)
		self._write_dirty_mosaics(dirty_mosaic_entries)
		self._write_dirty_metadata(dirty_metadata_entries)
		self._write_dirty_hash_locks(dirty_hash_lock_entries)
		self._write_dirty_secret_locks(dirty_secret_lock_entries)

	def _sync_block_batch(self, batch_rows, transaction_rows_by_height, receipt_rows_by_height):
		"""Writes previously-fetched block, transaction, and receipt rows for one batch.

		Takes already-fetched rows rather than fetching them itself so all of a batch's network
		fetches complete before any of its writes begin — a mid-batch failure leaves no partial writes.
		"""

		self.symbol_db.upsert_blocks(batch_rows)
		self._upsert_transactions_for_batch(batch_rows, transaction_rows_by_height)
		self._upsert_receipts_for_batch(batch_rows, receipt_rows_by_height)

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
			items = self._get_node_page_data(response, 'Malformed Symbol transaction page response')
			for item in items:
				row = create_transaction_row(item, self.symbol_facade.network, epoch_adjustment_seconds)
				rows_by_height.setdefault(row['height'], []).append(row)

			if len(items) < MAX_PAGE_SIZE:
				return rows_by_height

			page_number += 1

	async def _get_block_page(self, offset):
		response = await self.get_symbol_node(f'/blocks?pageSize={MAX_PAGE_SIZE}&offset={offset}&orderBy=height')
		return self._get_node_page_data(response, 'Malformed Symbol block page response')

	async def _get_receipt_rows_by_height(self, start_height, end_height):
		statement_items = []
		page_number = 1
		while True:
			response = await self.get_symbol_node(
				f'/statements/transaction?fromHeight={start_height}&toHeight={end_height}'
				f'&pageSize={MAX_PAGE_SIZE}&pageNumber={page_number}'
			)
			items = self._get_node_page_data(response, 'Malformed Symbol statement page response')
			statement_items.extend(items)
			if len(items) < MAX_PAGE_SIZE:
				break

			page_number += 1

		rows_by_height = defaultdict(list)
		for statement_item in statement_items:
			for row in create_receipt_rows(statement_item):
				rows_by_height[row['height']].append(row)

		return dict(rows_by_height)

	async def _get_resolution_statements(self, request):
		resolution_entries_by_unresolved = {}
		page_number = 1
		while True:
			response = await self.get_symbol_node(
				f'/statements/resolutions/{request.kind}?height={request.height}&pageSize={MAX_PAGE_SIZE}&pageNumber={page_number}'
			)
			items = self._get_node_page_data(response, f'Malformed Symbol {request.kind} resolution page response')
			for item in items:
				statement = item['statement']
				resolution_entries_by_unresolved[statement['unresolved'].upper()] = statement['resolutionEntries']

			if len(items) < MAX_PAGE_SIZE:
				return resolution_entries_by_unresolved

			page_number += 1

	@staticmethod
	def _get_node_page_data(response, error_message):
		if not isinstance(response, dict) or 'data' not in response:
			raise ValueError(error_message)

		return response['data']

	@staticmethod
	def _transaction_resolution_source(row, top_level_rows_by_hash):
		if not row['is_embedded']:
			return TransactionSource(row['block_index'] + 1, 0)

		parent_row = top_level_rows_by_hash.get(row['aggregate_hash'])
		if parent_row is None:
			raise ValueError(f'Missing aggregate transaction for embedded transaction at height {row["height"]}')

		return TransactionSource(parent_row['block_index'] + 1, row['embedded_index'] + 1)

	@staticmethod
	def _resolve_transaction_alias(statements, unresolved_hex, source, kind, height):
		if unresolved_hex not in statements:
			raise ValueError(f'Missing Symbol {kind} resolution at height {height} for unresolved {unresolved_hex}')

		resolved = select_resolution_entry(statements[unresolved_hex], source.primary_id, source.secondary_id)
		if resolved is None:
			raise ValueError(f'Missing Symbol {kind} resolution entry at height {height} for unresolved {unresolved_hex}')

		return resolved

	@staticmethod
	def _alias_values_for_transaction_row(row):
		addresses = [
			*(address_row['address'] for address_row in row['address_rows']),
			row['recipient_address'],
			row['target_address']
		]
		alias_addresses = {
			address
			for address in addresses
			if address is not None and Address(address).is_alias()
		}
		alias_mosaic_ids = {
			mosaic_row['mosaic_id']
			for mosaic_row in row['mosaic_rows']
			if is_alias_mosaic_id(mosaic_row['mosaic_id'])
		}
		mosaic_metadata_target_id = row['mosaic_metadata_target_id']
		if mosaic_metadata_target_id is not None and is_alias_mosaic_id(mosaic_metadata_target_id):
			alias_mosaic_ids.add(mosaic_metadata_target_id)
		return alias_addresses, alias_mosaic_ids

	@classmethod
	def _alias_values_for_transaction_rows(cls, transaction_rows):
		alias_addresses = set()
		alias_mosaic_ids = set()
		for row in transaction_rows:
			row_alias_addresses, row_alias_mosaic_ids = cls._alias_values_for_transaction_row(row)
			alias_addresses.update(row_alias_addresses)
			alias_mosaic_ids.update(row_alias_mosaic_ids)

		return alias_addresses, alias_mosaic_ids

	def _resolve_transaction_row(self, row, top_level_rows_by_hash, resolution_statements, height):
		alias_addresses, alias_mosaic_ids = self._alias_values_for_transaction_row(row)
		if not alias_addresses and not alias_mosaic_ids:
			return

		source = self._transaction_resolution_source(row, top_level_rows_by_hash)
		if alias_addresses:
			def _resolve_transaction_alias_address(address):
				resolved_hex = self._resolve_transaction_alias(
					resolution_statements.address,
					address.hex().upper(),
					source,
					'address',
					height)
				return bytes.fromhex(resolved_hex)

			for address_row in row['address_rows']:
				if address_row['address'] in alias_addresses:
					address_row['address'] = _resolve_transaction_alias_address(address_row['address'])
			row['address_rows'] = unique_address_rows(row['address_rows'])
			for field_name in ('recipient_address', 'target_address'):
				address = row[field_name]
				if address in alias_addresses:
					row[field_name] = _resolve_transaction_alias_address(address)

		if alias_mosaic_ids:
			def _resolve_transaction_alias_mosaic(mosaic_id):
				return self._resolve_transaction_alias(
					resolution_statements.mosaic,
					mosaic_id.upper(),
					source,
					'mosaic',
					height)

			for mosaic_row in row['mosaic_rows']:
				if mosaic_row['mosaic_id'] in alias_mosaic_ids:
					mosaic_row['mosaic_id'] = _resolve_transaction_alias_mosaic(mosaic_row['mosaic_id'])
			if row['mosaic_metadata_target_id'] in alias_mosaic_ids:
				row['mosaic_metadata_target_id'] = _resolve_transaction_alias_mosaic(row['mosaic_metadata_target_id'])

	async def _resolve_transaction_rows_for_batch(self, transaction_rows_by_height):  # pylint: disable=too-many-locals
		resolution_requests = []
		resolution_statements_by_height = {}
		for height, transaction_rows in transaction_rows_by_height.items():
			alias_addresses, alias_mosaic_ids = self._alias_values_for_transaction_rows(transaction_rows)
			if not alias_addresses and not alias_mosaic_ids:
				continue

			resolution_statements_by_height[height] = ResolutionStatements({}, {})
			if alias_addresses:
				resolution_requests.append(ResolutionRequest(height, 'address'))
			if alias_mosaic_ids:
				resolution_requests.append(ResolutionRequest(height, 'mosaic'))

		for batch_start in range(0, len(resolution_requests), RESOLUTION_FETCH_CONCURRENCY):
			batch_requests = resolution_requests[batch_start:batch_start + RESOLUTION_FETCH_CONCURRENCY]
			batch_statements = await asyncio.gather(*(
				self._get_resolution_statements(request)
				for request in batch_requests
			))
			for request, statements in zip(batch_requests, batch_statements):
				resolution_statements_by_height[request.height] = resolution_statements_by_height[request.height]._replace(
					**{request.kind: statements})

		for height, transaction_rows in transaction_rows_by_height.items():
			if height not in resolution_statements_by_height:
				continue

			resolution_statements = resolution_statements_by_height[height]
			top_level_rows_by_hash = {
				row['hash']: row
				for row in transaction_rows
				if not row['is_embedded']
			}
			for row in transaction_rows:
				self._resolve_transaction_row(row, top_level_rows_by_hash, resolution_statements, height)

	@staticmethod
	def _calculate_block_reward(receipts):
		return sum(receipt['amount'] for receipt in receipts if INFLATION_RECEIPT_TYPE == receipt['receipt_type'])

	def _upsert_receipts_for_batch(self, block_rows, rows_by_height):
		for row in block_rows:
			receipt_rows = rows_by_height.get(row['height'], [])
			block_reward = self._calculate_block_reward(receipt_rows)
			self.symbol_db.upsert_receipts_for_height(row['height'], receipt_rows, block_reward)

	@staticmethod
	def _parse_epoch_adjustment(network_properties):
		raw_epoch_adjustment = network_properties['network']['epochAdjustment']
		raw_epoch_adjustment = str(raw_epoch_adjustment)
		return int(raw_epoch_adjustment[:-1] if raw_epoch_adjustment.endswith('s') else raw_epoch_adjustment)

	async def _get_network_properties(self):
		"""Gets and memoizes Symbol network properties for this puller instance."""

		if self._network_properties is None:
			self._network_properties = await self.get_symbol_node('/network/properties')

		return self._network_properties

	async def _get_native_mosaic_info(self):
		"""Gets and memoizes the native mosaic id and divisibility for this puller instance."""

		if self._native_mosaic_info:
			return self._native_mosaic_info

		network_properties = await self._get_network_properties()
		native_mosaic_id = network_properties['chain']['currencyMosaicId'].replace('0x', '').replace("'", '').upper()
		mosaic_definition = await self.get_symbol_node(f'/mosaics/{native_mosaic_id}')
		self._native_mosaic_info = NativeMosaicInfo(native_mosaic_id, int(mosaic_definition['mosaic']['divisibility']))

		return self._native_mosaic_info

	@staticmethod
	def _collect_dirty_addresses_for_batch(  # pylint: disable=too-many-branches
		block_rows,
		transaction_rows_by_height,
		receipt_rows_by_height
	):
		"""Collects unique dirty addresses touched by synced block, transaction, and receipt rows."""

		dirty_addresses = {}
		latest_block_by_beneficiary = {}
		for row in block_rows:
			current_row = latest_block_by_beneficiary.get(row['beneficiary_address'])
			if not current_row or (row['timestamp'], row['height']) > (current_row['timestamp'], current_row['height']):
				latest_block_by_beneficiary[row['beneficiary_address']] = row

		for address, block_row in latest_block_by_beneficiary.items():
			dirty_addresses[Address(address)] = {
				'is_beneficiary': True,
				'harvested_block_timestamp': block_row['timestamp']
			}

		for transaction_rows in transaction_rows_by_height.values():
			for transaction_row in transaction_rows:
				for address_row in transaction_row['address_rows']:
					address = Address(address_row['address'])
					if address not in dirty_addresses:
						dirty_addresses[address] = {
							'is_beneficiary': False,
							'harvested_block_timestamp': None
						}

		for receipt_rows in receipt_rows_by_height.values():
			for receipt_row in receipt_rows:
				if 'balanceChange' == receipt_row['receipt_group']:
					receipt_addresses = [receipt_row['target_address']]
				elif 'balanceTransfer' == receipt_row['receipt_group']:
					receipt_addresses = [receipt_row['sender_address'], receipt_row['recipient_address']]
				else:
					continue

				for address in receipt_addresses:
					if address is not None:
						address = Address(address)
						if address not in dirty_addresses:
							dirty_addresses[address] = {
								'is_beneficiary': False,
								'harvested_block_timestamp': None
							}

		return dirty_addresses

	@staticmethod
	def _collect_dirty_namespace_ids_for_batch(transaction_rows_by_height, receipt_rows_by_height):
		"""Collects deduplicated namespace ids whose current state may have changed in a synced batch, in first-encounter order."""

		dirty_namespace_ids = {}
		for transaction_rows in transaction_rows_by_height.values():
			for transaction_row in transaction_rows:
				if TransactionType.NAMESPACE_REGISTRATION.value == transaction_row['type']:
					dirty_namespace_ids[transaction_row['body']['id']] = None
				elif transaction_row['type'] in (TransactionType.ADDRESS_ALIAS.value, TransactionType.MOSAIC_ALIAS.value):
					dirty_namespace_ids[transaction_row['body']['namespaceId']] = None

		for receipt_rows in receipt_rows_by_height.values():
			for receipt_row in receipt_rows:
				if receipt_row['receipt_type'] in (NAMESPACE_EXPIRED_RECEIPT_TYPE, NAMESPACE_DELETED_RECEIPT_TYPE):
					dirty_namespace_ids[receipt_row['artifact_id']] = None

		return list(dirty_namespace_ids)

	def _expand_dirty_namespace_ids(self, direct_namespace_ids):
		"""Preserves direct dirty first-encounter order and appends newly discovered root descendants.

		Namespace state is order-independent, but carrying transaction/receipt scan order through root expansion
		keeps namespace detail request chunks deterministic. A set would make request order implementation-dependent,
		while sorting would impose an unrelated namespace-ID priority.
		"""

		descendant_ids_by_root = self.symbol_db.get_namespace_ids_by_root_ids(direct_namespace_ids)
		namespace_ids = dict.fromkeys(direct_namespace_ids)
		for root_id in direct_namespace_ids:
			for namespace_id in descendant_ids_by_root.get(root_id, []):
				namespace_ids.setdefault(namespace_id, None)

		return list(namespace_ids)

	async def _fetch_dirty_namespaces(self, namespace_ids, observed_height):
		"""Fetches current namespace state and names for dirty namespace ids, processing ids in the given order."""

		if not namespace_ids:
			return []

		found_items_by_namespace_id = {}
		for chunk_start in range(0, len(namespace_ids), MAX_PAGE_SIZE):
			chunk = namespace_ids[chunk_start:chunk_start + MAX_PAGE_SIZE]
			for namespace_id, item in zip(chunk, await asyncio.gather(*(
				self.get_symbol_node(f'/namespaces/{namespace_id}', not_found_as_error=False)
				for namespace_id in chunk
			))):
				if not _is_not_found_response(item):
					found_items_by_namespace_id[namespace_id] = item

		level_ids = {}
		for item in found_items_by_namespace_id.values():
			for level_index in range(int(item['namespace']['depth'])):
				level_ids[item['namespace'][f'level{level_index}']] = None
		level_ids = list(level_ids)
		names_by_id = {}
		for chunk_start in range(0, len(level_ids), MAX_PAGE_SIZE):
			response = await self.post_symbol_node('/namespaces/names', {'namespaceIds': level_ids[chunk_start:chunk_start + MAX_PAGE_SIZE]})
			if not isinstance(response, list):
				raise ValueError('Malformed Symbol namespace names response')
			for name_entry in response:
				names_by_id[name_entry['id']] = name_entry['name']

		entries = []
		for namespace_id in namespace_ids:
			if namespace_id not in found_items_by_namespace_id:
				entries.append({'namespace_id': namespace_id})
				continue

			item = found_items_by_namespace_id[namespace_id]
			row = create_namespace_row(item, names_by_id, observed_height)
			entries.append({
				'row': row,
				'alias_rows': create_alias_name_rows(row)
			})

		return entries

	@staticmethod
	def _collect_dirty_mosaic_ids_for_batch(transaction_rows_by_height, receipt_rows_by_height):
		"""Collects deduplicated mosaic ids whose current state may have changed in a synced batch."""

		dirty_mosaic_ids = {}
		for transaction_rows in transaction_rows_by_height.values():
			for transaction_row in transaction_rows:
				if transaction_row['type'] == TransactionType.MOSAIC_DEFINITION.value:
					dirty_mosaic_ids[transaction_row['body']['id']] = None
				elif transaction_row['type'] == TransactionType.MOSAIC_SUPPLY_CHANGE.value:
					dirty_mosaic_ids[transaction_row['mosaic_rows'][0]['mosaic_id']] = None

		for receipt_rows in receipt_rows_by_height.values():
			for receipt_row in receipt_rows:
				if receipt_row['receipt_type'] == MOSAIC_EXPIRED_RECEIPT_TYPE:
					dirty_mosaic_ids[receipt_row['artifact_id']] = None

		return list(dirty_mosaic_ids)

	async def _fetch_dirty_mosaics(self, mosaic_ids, observed_height):
		"""Fetches current mosaic state in batches and returns ordered upsert/delete entries."""

		if not mosaic_ids:
			return []

		found_items_by_mosaic_id = {}
		for chunk_start in range(0, len(mosaic_ids), MAX_PAGE_SIZE):
			chunk = mosaic_ids[chunk_start:chunk_start + MAX_PAGE_SIZE]
			response = await self.post_symbol_node('/mosaics', {'mosaicIds': chunk})
			if not isinstance(response, list):
				raise ValueError('Malformed Symbol mosaics batch response')
			for item in response:
				found_items_by_mosaic_id[item['mosaic']['id']] = item

		entries = []
		for mosaic_id in mosaic_ids:
			if mosaic_id not in found_items_by_mosaic_id:
				entries.append({'mosaic_id': mosaic_id})
			else:
				entries.append({'row': create_mosaic_row(found_items_by_mosaic_id[mosaic_id], observed_height)})

		return entries

	def _write_dirty_mosaics(self, entries):
		"""Writes fetched mosaic current-state changes after namespace rows are persisted."""

		for entry in entries:
			if 'mosaic_id' in entry:
				self.symbol_db.delete_mosaic(entry['mosaic_id'])
			else:
				self.symbol_db.upsert_mosaic(entry['row'])

	@staticmethod
	def _collect_dirty_metadata_keys_for_batch(transaction_rows_by_height):
		"""Collects natural keys for exact-key metadata searches and deduplication.

		Empty exact-key searches must delete the local row, but supply no composite hash from the node.
		"""

		dirty_metadata_keys = {}
		for transaction_rows in transaction_rows_by_height.values():
			for transaction_row in transaction_rows:
				metadata_type = METADATA_TRANSACTION_TYPE_LABELS.get(transaction_row['type'])
				if metadata_type is None:
					continue

				body = transaction_row['body']
				if 'mosaic' == metadata_type:
					target_id = transaction_row['mosaic_metadata_target_id']
				elif 'namespace' == metadata_type:
					target_id = body['targetNamespaceId']
				else:
					target_id = None

				key = {
					'metadata_type': metadata_type,
					'source_address': transaction_row['signer_address'],
					'target_address': transaction_row['target_address'],
					'scoped_metadata_key': body['scopedMetadataKey'],
					'target_id': target_id
				}
				key_identity = (
					key['metadata_type'],
					key['source_address'],
					key['target_address'],
					key['scoped_metadata_key'],
					key['target_id'])
				dirty_metadata_keys[key_identity] = key

		return list(dirty_metadata_keys.values())

	async def _fetch_dirty_metadata(self, metadata_keys, observed_height):
		"""Fetches metadata by exact natural key in bounded concurrent batches."""

		if not metadata_keys:
			return []

		async def fetch_entry(metadata_key):
			address = Address(metadata_key['source_address'])
			target_address = Address(metadata_key['target_address'])
			metadata_number = METADATA_TYPE_NUMBERS[metadata_key['metadata_type']]
			path = (
				f'/metadata?sourceAddress={address}&targetAddress={target_address}'
				f'&scopedMetadataKey={metadata_key["scoped_metadata_key"]}&metadataType={metadata_number}'
			)
			if metadata_key['target_id'] is not None:
				path += f'&targetId={metadata_key["target_id"]}'

			response = await self.get_symbol_node(path)
			items = self._get_node_page_data(response, 'Malformed Symbol metadata search response')
			if not isinstance(items, list):
				raise ValueError('Malformed Symbol metadata search data')
			if len(items) > 1:
				raise ValueError('Symbol metadata exact-key search returned multiple entries')
			if not items:
				return {'key': metadata_key}

			return {'row': create_metadata_row(items[0], observed_height)}

		entries = []
		for chunk_start in range(0, len(metadata_keys), METADATA_FETCH_CONCURRENCY):
			chunk = metadata_keys[chunk_start:chunk_start + METADATA_FETCH_CONCURRENCY]
			entries.extend(await asyncio.gather(*(fetch_entry(metadata_key) for metadata_key in chunk)))

		return entries

	def _write_dirty_metadata(self, entries):
		"""Writes fetched metadata current-state changes after all batch fetches complete."""

		for entry in entries:
			if 'key' in entry:
				self.symbol_db.delete_metadata_by_key(entry['key'])
			else:
				self.symbol_db.upsert_metadata(entry['row'])

	@staticmethod
	def _assert_resolved_transaction_address(address, field_name):
		if address is not None and Address(address).is_alias():
			raise ValueError(f'Unresolved Symbol transaction {field_name} reached Lock dirty-key collection')

	@staticmethod
	def _union_hash_lock_keys(*key_lists):
		keys = {}
		for key_list in key_lists:
			for key in key_list:
				keys[key] = None

		return list(keys)

	@staticmethod
	def _union_secret_lock_keys(*key_lists):
		keys = {}
		for key_list in key_lists:
			for key in key_list:
				keys[key] = None

		return list(keys)

	def _collect_dirty_lock_keys_for_batch(self, block_rows, transaction_rows_by_height):
		"""Collects Hash and Secret Lock dirty keys from transactions and expiring current rows."""

		hash_keys = {}
		secret_keys = {}
		for transaction_rows in transaction_rows_by_height.values():
			for transaction_row in transaction_rows:
				transaction_type = transaction_row['type']
				body = transaction_row['body']
				if TransactionType.HASH_LOCK.value == transaction_type:
					hash_keys[create_hash_lock_key_from_hex(body['hash'])] = None
				elif TransactionType.AGGREGATE_BONDED.value == transaction_type and not transaction_row['is_embedded']:
					hash_keys[create_hash_lock_key_from_hex(transaction_row['hash'].hex())] = None
				elif transaction_type in (TransactionType.SECRET_LOCK.value, TransactionType.SECRET_PROOF.value):
					self._assert_resolved_transaction_address(transaction_row['recipient_address'], 'recipient_address')
					owner_address = transaction_row['signer_address'] if TransactionType.SECRET_LOCK.value == transaction_type else None
					self._assert_resolved_transaction_address(owner_address, 'signer_address')
					secret_key = create_secret_lock_search_key_from_hex_secret(
						owner_address,
						transaction_row['recipient_address'],
						body['secret'],
						lock_hash_algorithm_label(body['hashAlgorithm']))
					secret_keys[secret_key] = None

		start_height = block_rows[0]['height']
		end_height = block_rows[-1]['height']
		hash_keys.update({key: None for key in self.symbol_db.get_hash_lock_hashes_expiring_between(start_height, end_height)})
		secret_keys.update({
			key: None
			for key in self.symbol_db.get_secret_lock_search_keys_expiring_between(start_height, end_height)
		})

		return RollbackLockKeys(list(hash_keys), list(secret_keys))

	async def _fetch_dirty_hash_locks(self, hash_keys, observed_height):
		"""Fetches Hash Lock detail state in bounded concurrent batches."""

		async def fetch_entry(hash_key):
			path = f'/lock/hash/{hash_key.hash.hex().upper()}'
			response = await self.get_symbol_node(path, not_found_as_error=False)
			if _is_not_found_response(response):
				return {'hash': hash_key}

			row = create_hash_lock_row(response, observed_height)
			if row['hash'] != hash_key.hash:
				raise ValueError('Symbol Hash Lock response hash does not match dirty key')

			return {'row': row}

		entries = []
		for chunk_start in range(0, len(hash_keys), LOCK_FETCH_CONCURRENCY):
			chunk = hash_keys[chunk_start:chunk_start + LOCK_FETCH_CONCURRENCY]
			entries.extend(await asyncio.gather(*(fetch_entry(hash_key) for hash_key in chunk)))

		return entries

	async def _fetch_dirty_secret_locks(self, search_keys, observed_height):
		"""Fetches and exactly filters paginated Secret Lock search results in bounded concurrent batches."""

		async def fetch_entry(search_key):
			page_number = 1
			matching_rows = []
			composite_hashes = set()
			while True:
				path = '/lock/secret?'
				if search_key.owner_address is not None:
					path += f'address={Address(search_key.owner_address)}&'
				path += f'secret={search_key.secret.hex().upper()}&pageSize={MAX_PAGE_SIZE}&pageNumber={page_number}'
				response = await self.get_symbol_node(path, not_found_as_error=False)
				if _is_not_found_response(response):
					items = []
				else:
					if not isinstance(response, dict) or not isinstance(response.get('data'), list):
						raise ValueError('Malformed Symbol Secret Lock search response')
					items = response['data']

				for item in items:
					row = create_secret_lock_row(item, observed_height)
					if row['composite_hash'] in composite_hashes:
						raise ValueError('Duplicate Symbol Secret Lock composite hash')
					composite_hashes.add(row['composite_hash'])
					if search_key.owner_address is not None and row['owner_address'] != search_key.owner_address:
						continue
					if row['recipient_address'] != search_key.recipient_address:
						continue
					if row['secret'] != search_key.secret:
						continue
					if row['hash_algorithm'] != search_key.hash_algorithm:
						continue
					matching_rows.append(row)

				if len(items) < MAX_PAGE_SIZE:
					return {'key': search_key, 'rows': matching_rows}

				page_number += 1

		entries = []
		for chunk_start in range(0, len(search_keys), LOCK_FETCH_CONCURRENCY):
			chunk = search_keys[chunk_start:chunk_start + LOCK_FETCH_CONCURRENCY]
			entries.extend(await asyncio.gather(*(fetch_entry(search_key) for search_key in chunk)))

		return entries

	def _write_dirty_hash_locks(self, entries):
		"""Writes fetched Hash Lock current-state changes after all batch fetches complete."""

		for entry in entries:
			if 'hash' in entry:
				self.symbol_db.delete_hash_lock(entry['hash'])
			else:
				self.symbol_db.upsert_hash_lock(entry['row'])

	def _write_dirty_secret_locks(self, entries):
		"""Replaces fetched Secret Lock logical keys after all batch fetches complete."""

		for entry in entries:
			self.symbol_db.replace_secret_locks(entry['key'], entry['rows'])

	async def _fetch_dirty_accounts_for_batch(  # pylint: disable=too-many-locals
		self,
		dirty_addresses,
		observed_height,
		native_mosaic_info
	):
		"""Fetches current-state account and multisig rows touched by a synced block batch."""

		addresses = list(dirty_addresses.keys())

		dirty_account_rows = []
		for chunk_start in range(0, len(addresses), ACCOUNT_BATCH_FETCH_SIZE):
			chunk = addresses[chunk_start:chunk_start + ACCOUNT_BATCH_FETCH_SIZE]
			accounts_response = await self.post_symbol_node('/accounts', {
				'addresses': [str(address) for address in chunk]
			})
			if not isinstance(accounts_response, list):
				raise ValueError('Malformed Symbol accounts batch response')
			account_items_by_address = {
				Address(bytes.fromhex(item['account']['address'])): item
				for item in accounts_response
			}

			multisig_responses = await asyncio.gather(*(
				self.get_symbol_node(f'/account/{address}/multisig', not_found_as_error=False)
				for address in chunk
			))

			for address, multisig_response in zip(chunk, multisig_responses):
				if address not in account_items_by_address:
					raise ValueError(f'Missing Symbol accounts batch item for address {address}')

				item = account_items_by_address[address]
				account_row, mosaic_rows = create_account_row(
					item,
					self.symbol_facade.network,
					observed_height,
					native_mosaic_info.id,
					native_mosaic_info.divisibility)

				dirty_info = dirty_addresses[address]
				overwrite_is_harvesting_active = dirty_info['is_beneficiary'] and self._is_harvested_block_within_active_window(
					dirty_info['harvested_block_timestamp'])
				if overwrite_is_harvesting_active:
					account_row['is_harvesting_active'] = True

				address_bytes = address.bytes
				dirty_account_rows.append({
					'address': address_bytes,
					'account_row': account_row,
					'mosaic_rows': mosaic_rows,
					'overwrite_is_harvesting_active': overwrite_is_harvesting_active,
					'multisig_row': None if _is_not_found_response(multisig_response) else create_multisig_row(
						address_bytes,
						multisig_response['multisig'],
						observed_height)
				})

		return dirty_account_rows

	def _write_dirty_accounts_for_batch(self, dirty_account_rows):
		"""Writes fetched dirty account current-state rows after block rows are persisted."""

		for dirty_account_row in dirty_account_rows:
			self.symbol_db.upsert_account_current_state(
				dirty_account_row['account_row'],
				dirty_account_row['mosaic_rows'],
				overwrite_is_harvesting_active=dirty_account_row['overwrite_is_harvesting_active'])
			self.symbol_db.upsert_multisig(
				dirty_account_row['address'],
				dirty_account_row['multisig_row'])

	@staticmethod
	def _is_harvested_block_within_active_window(harvested_block_timestamp):
		cutoff_timestamp = datetime.now(timezone.utc) - timedelta(days=HARVESTING_ACTIVE_WINDOW_DAYS)
		return harvested_block_timestamp >= cutoff_timestamp

	async def refresh_accounts(self):  # pylint: disable=too-many-locals
		"""Refresh the full account population; scheduler must keep it non-overlapping with rollback repair.

		The external scheduler owns exclusion between this command and ``sync-block`` rollback repair.
		Manual execution must also not run both operations at the same time.
		"""

		try:
			refresh_run_id = str(uuid.uuid4())
			started_at = datetime.now(timezone.utc)
			chain_info = await self.get_symbol_node('/chain/info')
			snapshot_height = int(chain_info['height'])
			native_mosaic_id, native_mosaic_divisibility = await self._get_native_mosaic_info()
			cutoff_timestamp = started_at - timedelta(days=HARVESTING_ACTIVE_WINDOW_DAYS)
			recently_harvesting_addresses = self.symbol_db.get_recently_harvesting_addresses(cutoff_timestamp)
			self.symbol_db.upsert_account_refresh_state({
				'status': 'refreshing',
				'last_started_at': started_at,
				'last_scanned_page': None,
				'last_error': None
			})

			account_search_order = 0
			page_number = 1
			while True:
				response = await self.get_symbol_node(
					f'/accounts?pageSize={ACCOUNT_PAGE_SIZE}&pageNumber={page_number}&orderBy=id&order=desc')
				items = self._get_node_page_data(response, 'Malformed Symbol accounts page response')
				account_entries = []
				for item in items:
					account_row, mosaic_rows = create_account_row(
						item,
						self.symbol_facade.network,
						snapshot_height,
						native_mosaic_id,
						native_mosaic_divisibility)
					account_row['is_harvesting_active'] = account_row['address'] in recently_harvesting_addresses
					account_entries.append({
						'refresh_run_id': refresh_run_id,
						'account_search_order': account_search_order,
						'account_row': account_row,
						'mosaic_rows': mosaic_rows,
						'snapshot_height': snapshot_height,
						'snapshot_at': started_at
					})
					account_search_order += 1

				self.symbol_db.upsert_account_refresh_page(account_entries, page_number)
				if len(items) < ACCOUNT_PAGE_SIZE:
					break

				page_number += 1

			self.symbol_db.finalize_account_refresh(
				refresh_run_id,
				native_mosaic_id,
				snapshot_height,
				datetime.now(timezone.utc))
		except Exception as exception:
			try:
				self.symbol_db.mark_account_refresh_failed(str(exception))
			except Exception as state_error:  # pylint: disable=broad-exception-caught
				# Preserve the original refresh failure when failure-state persistence also fails.
				log.error(f'Failed to record Symbol account refresh failure: {state_error}')
			raise

	@staticmethod
	def _validate_block_page(rows, expected_start_height):
		for index, row in enumerate(rows):
			expected_height = expected_start_height + index
			if row['height'] != expected_height:
				raise ValueError(f'Unexpected Symbol block height {row["height"]}; expected {expected_height}')
