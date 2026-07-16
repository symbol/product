import asyncio
import configparser
import uuid
from collections import defaultdict, namedtuple
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

from common.symbol.NodeConfiguration import SymbolNodeConfiguration
from symbolchain.facade.SymbolFacade import SymbolFacade
from symbolchain.symbol.Network import Address, Network
from symbollightapi.connector.SymbolConnector import SymbolConnector
from symbollightapi.model.Exceptions import NodeException
from zenlog import log

from puller.db.SymbolDatabase import SymbolDatabase
from puller.facade.RequestRateLimiter import RequestRateLimiter
from puller.model.symbol.Account import HARVESTING_ACTIVE_WINDOW_DAYS, create_account_row, create_multisig_row
from puller.model.symbol.Block import create_block_row
from puller.model.symbol.Receipt import INFLATION_RECEIPT_TYPE, create_receipt_rows
from puller.model.symbol.Transaction import create_transaction_row

DatabaseConfiguration = namedtuple('DatabaseConfiguration', ['database', 'user', 'password', 'host', 'port'])
NativeMosaicInfo = namedtuple('NativeMosaicInfo', ['id', 'divisibility'])
MAX_PAGE_SIZE = 100
ACCOUNT_BATCH_FETCH_SIZE = MAX_PAGE_SIZE
BLOCK_PAGE_FETCH_CONCURRENCY = 10
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
					await self._sync_block_batch_with_dirty_accounts(
						batch_rows, epoch_adjustment_seconds, native_mosaic_info)
					return last_synced_height, last_synced_block_hash

			await self._sync_block_batch_with_dirty_accounts(
				batch_rows, epoch_adjustment_seconds, native_mosaic_info)

		return last_synced_height, last_synced_block_hash

	async def _sync_block_batch_with_dirty_accounts(
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
		dirty_addresses = self._collect_dirty_addresses_for_batch(
			batch_rows,
			transaction_rows_by_height,
			receipt_rows_by_height)
		observed_height = max(row['height'] for row in batch_rows)
		dirty_account_rows = await self._fetch_dirty_accounts_for_batch(
			dirty_addresses,
			observed_height,
			native_mosaic_info)
		self._sync_block_batch(batch_rows, transaction_rows_by_height, receipt_rows_by_height)
		self._write_dirty_accounts_for_batch(dirty_account_rows)

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
			if not isinstance(response, dict) or 'data' not in response:
				raise ValueError('Malformed Symbol statement page response')

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
					if address not in dirty_addresses and not address.is_alias():
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
				if not isinstance(response, dict) or 'data' not in response:
					raise ValueError('Malformed Symbol accounts page response')

				items = response['data']
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
