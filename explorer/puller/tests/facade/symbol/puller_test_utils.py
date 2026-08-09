import asyncio
import re
import tempfile
from contextlib import ExitStack, contextmanager
from pathlib import Path
from unittest import TestCase

from common.symbol.NodeConfiguration import SymbolNodeConfiguration
from common.tests.PostgresTestUtils import PostgresTestDatabase, drop_symbol_block_tables_if_present
from symbolchain.sc import ReceiptType, TransactionType
from symbolchain.symbol.Network import Address, Network

from puller.facade.SymbolPuller import MAX_PAGE_SIZE, DatabaseConfiguration, SymbolPuller
from puller.model.symbol.Block import create_block_row
from tests.test.SymbolTestConstants import BENEFICIARY_ADDRESS, RECIPIENT_ADDRESS, SIGNER_PUBLIC_KEY

NODE_URL = 'http://127.0.0.1:3000'
NATIVE_MOSAIC_ID = '72C0212E67A08BCE'
NATIVE_MOSAIC_DIVISIBILITY = 6


def create_db_config(config_dir, db_config=None, include_symbol_db=True):
	db_config = db_config or DatabaseConfiguration(
		'symbol',
		'postgres',
		'',
		'127.0.0.1',
		5433
	)
	db_config_path = Path(config_dir) / 'db_config.ini'
	with open(db_config_path, 'wt', encoding='utf8') as db_config_file:
		db_config_file.write('[nem_db]\n')
		db_config_file.write('database = nem\n')
		db_config_file.write('user = postgres\n')
		db_config_file.write('password = \n')
		db_config_file.write('host = 127.0.0.1\n')
		db_config_file.write('port = 5432\n')

		if include_symbol_db:
			db_config_file.write('[symbol_db]\n')
			db_config_file.write(f'database = {db_config.database}\n')
			db_config_file.write(f'user = {db_config.user}\n')
			db_config_file.write('password = \n')
			db_config_file.write(f'host = {db_config.host}\n')
			db_config_file.write(f'port = {db_config.port}\n')

	return db_config_path


def create_symbol_puller(  # pylint: disable=too-many-arguments,too-many-positional-arguments
	db_config_path,
	network_type='mainnet',
	request_timeout_seconds=10,
	node_url=NODE_URL,
	connector=None,
	rate_limiter=None
):
	node_config = SymbolNodeConfiguration.from_url(
		node_url,
		allow_loopback=True,
		timeout_seconds=request_timeout_seconds
	)

	puller = SymbolPuller(
		node_url,
		db_config_path,
		network_type,
		node_config,
		connector,
		max_requests_per_second=1_000_000,
		rate_limiter=rate_limiter
	)
	puller._retry_delay = 0  # pylint: disable=protected-access

	return puller


@contextmanager
def temporary_symbol_puller(
	network_type='mainnet',
	request_timeout_seconds=10,
	connector=None,
	rate_limiter=None
):
	with tempfile.TemporaryDirectory() as temp_directory:
		db_config_path = create_db_config(temp_directory)

		yield create_symbol_puller(
			db_config_path,
			network_type,
			request_timeout_seconds,
			connector=connector,
			rate_limiter=rate_limiter
		)


def set_symbol_connector(puller, connector):
	# Keep protected connector replacement in one helper so sync tests can use
	# deterministic Symbol node responses.
	puller._symbol_connector = connector  # pylint: disable=protected-access


def set_symbol_rate_limiter(puller, rate_limiter):
	# Keep injected rate-limiter replacement in one helper for deterministic request tests.
	puller._rate_limiter = rate_limiter  # pylint: disable=protected-access


def set_sync_block_pages(puller, sync_block_pages):
	# Patch the private page sync step only for hard-to-reach error branches.
	puller._sync_block_pages = sync_block_pages  # pylint: disable=protected-access


def create_node_block(
	height,
	block_hash=None,
	previous_hash=None,
	**block_overrides
):
	block_hash = block_hash or f'{height:064X}'
	previous_hash = previous_hash or f'{height - 1:064X}'

	node_block = {
		'meta': {
			'hash': block_hash,
			'totalFee': str(height * 1000),
			'totalTransactionsCount': height + 10,
			'transactionsCount': height,
			'statementsCount': height + 1,
			'stateHashSubCacheMerkleRoots': ['A' * 64]
		},
		'block': {
			'size': 100 + height,
			'signature': '1' * 128,
			'signerPublicKey': SIGNER_PUBLIC_KEY,
			'version': 1,
			'network': 152,
			'type': 32835,
			'height': str(height),
			'timestamp': str(height * 1000),
			'difficulty': str(100000 + height),
			'proofGamma': '2' * 64,
			'proofVerificationHash': '3' * 32,
			'proofScalar': '4' * 64,
			'previousBlockHash': previous_hash,
			'transactionsHash': '5' * 64,
			'receiptsHash': '6' * 64,
			'stateHash': '7' * 64,
			'beneficiaryAddress': BENEFICIARY_ADDRESS,
			'feeMultiplier': height
		},
		'id': str(height)
	}
	node_block['block'].update(block_overrides)

	return node_block


def create_node_transaction(height, transaction_hash=None, transaction_id=None, block_index=0, **transaction_overrides):
	transaction_hash = transaction_hash or f'{height:064X}'
	transaction = {
		'size': 152,
		'signature': '1' * 128,
		'signerPublicKey': SIGNER_PUBLIC_KEY,
		'version': 1,
		'network': 152,
		'type': TransactionType.TRANSFER.value,
		'maxFee': '1000',
		'deadline': '2000',
		'recipientAddress': RECIPIENT_ADDRESS,
		'mosaics': [{'id': NATIVE_MOSAIC_ID, 'amount': str(height * 1000)}]
	}
	transaction.update(transaction_overrides)

	return {
		'meta': {
			'height': str(height),
			'hash': transaction_hash,
			'merkleComponentHash': transaction_hash,
			'index': block_index,
			'timestamp': str(height * 1000),
			'feeMultiplier': 5
		},
		'transaction': transaction,
		'id': transaction_id or f'transaction-{height}'
	}


def create_embedded_node_transaction(height, aggregate_hash, embedded_index, transaction_id=None, **transaction_overrides):
	transaction = {
		'signerPublicKey': SIGNER_PUBLIC_KEY,
		'version': 1,
		'network': 152,
		'type': TransactionType.TRANSFER.value,
		'recipientAddress': RECIPIENT_ADDRESS,
		'mosaics': [{'id': NATIVE_MOSAIC_ID, 'amount': str(height * 1000)}]
	}
	transaction.update(transaction_overrides)

	return {
		'meta': {
			'height': str(height),
			'aggregateHash': aggregate_hash,
			'aggregateId': f'aggregate-{height}',
			'index': embedded_index,
			'timestamp': str(height * 1000),
			'feeMultiplier': 5
		},
		'transaction': transaction,
		'id': transaction_id or f'embedded-{height}-{embedded_index}'
	}


def create_complete_aggregate_pair(
	height,
	aggregate_hash,
	embedded_index,
	transaction_id=None,
	**embedded_transaction_overrides
):
	return [
		create_node_transaction(
			height,
			transaction_hash=aggregate_hash,
			type=TransactionType.AGGREGATE_COMPLETE.value,
			transactionsHash='9' * 64,
			cosignatures=[]),
		create_embedded_node_transaction(
			height,
			aggregate_hash,
			embedded_index,
			transaction_id=transaction_id,
			**embedded_transaction_overrides)
	]


def transaction_path(start_height, end_height, page_number=1):
	return (
		f'transactions/confirmed?fromHeight={start_height}&toHeight={end_height}'
		f'&pageSize=100&pageNumber={page_number}&order=asc&embedded=true'
	)


def statement_path(start_height, end_height, page_number=1):
	return (
		f'statements/transaction?fromHeight={start_height}&toHeight={end_height}'
		f'&pageSize={MAX_PAGE_SIZE}&pageNumber={page_number}'
	)


def resolution_path(kind, height, page_number=1):
	return f'statements/resolutions/{kind}?height={height}&pageSize={MAX_PAGE_SIZE}&pageNumber={page_number}'


def create_statement_item(height, receipt, item_id):
	"""Creates a statement envelope around the supplied receipt without changing it."""

	return {
		'statement': {
			'height': str(height),
			'source': {'primaryId': height, 'secondaryId': 0},
			'receipts': [receipt]
		},
		'id': item_id,
		'meta': {'timestamp': '0'}
	}


def create_amount_statement_item(
	height,
	amount,
	receipt_type=ReceiptType.INFLATION.value,
	item_id=None,
	**receipt_overrides
):
	"""Creates a statement item for a receipt carrying mosaic and amount fields."""

	receipt = {
		'version': 1,
		'type': receipt_type,
		'mosaicId': NATIVE_MOSAIC_ID,
		'amount': str(amount)
	}
	receipt.update(receipt_overrides)

	return create_statement_item(
		height,
		receipt,
		item_id or f'statement-{height}-{receipt_type}-{amount}')


def create_artifact_expiry_statement(height, receipt_type, artifact_id, item_id=None):
	"""Creates a statement item for a namespace or mosaic artifact-expiry receipt."""

	receipt = {
		'version': 1,
		'type': receipt_type,
		'artifactId': artifact_id
	}

	return create_statement_item(
		height,
		receipt,
		item_id or f'statement-{height}-{receipt_type}-{artifact_id}')


def create_resolution_statement(height, unresolved, entries):
	return {
		'statement': {
			'height': str(height),
			'unresolved': unresolved,
			'resolutionEntries': entries
		},
		'id': f'resolution-{height}-{unresolved}',
		'meta': {'timestamp': '0'}
	}


def create_sync_state(**overrides):
	sync_state = {
		'status': 'healthy',
		'chain_height': 3,
		'finalized_height': 1,
		'finalized_hash': bytes.fromhex(f'{1:064X}'),
		'finalized_epoch': 1,
		'finalized_point': 1,
		'last_synced_height': 3,
		'last_synced_block_hash': bytes.fromhex(f'{3:064X}')
	}
	sync_state.update(overrides)

	return sync_state


def create_chain_info(chain_height=1, finalized_height=1):
	return {
		'height': str(chain_height),
		'latestFinalizedBlock': {
			'finalizationEpoch': 4,
			'finalizationPoint': 5,
			'height': str(finalized_height),
			'hash': f'{finalized_height:064X}'
		}
	}


def create_network_properties(epoch_adjustment='100s'):
	return {
		'network': {'epochAdjustment': epoch_adjustment},
		'chain': {'currencyMosaicId': "0x72C0'212E'67A0'8BCE"}
	}


def create_mosaic_definition(divisibility=NATIVE_MOSAIC_DIVISIBILITY):
	return {'mosaic': {'divisibility': divisibility}}


def create_account_item(address_hex=BENEFICIARY_ADDRESS, item_id='account-id', **account_overrides):
	account = {
		'version': 1,
		'address': address_hex,
		'addressHeight': '7',
		'publicKey': '0' * 64,
		'publicKeyHeight': '0',
		'accountType': 0,
		'supplementalPublicKeys': {},
		'activityBuckets': [],
		'mosaics': [{'id': NATIVE_MOSAIC_ID, 'amount': str(20_000 * 10 ** NATIVE_MOSAIC_DIVISIBILITY)}],
		'importance': '100',
		'importanceHeight': '6'
	}
	account.update(account_overrides)

	return {'account': account, 'id': item_id}


class FakeConnector:  # pylint: disable=too-many-instance-attributes
	def __init__(  # pylint: disable=too-many-arguments,too-many-positional-arguments,too-many-locals
		self,
		chain_height,
		pages,
		block_by_height=None,
		finalized_height=1,
		transactions_by_path=None,
		statement_pages=None,
		account_by_address=None,
		multisig_by_address=None,
		account_pages=None,
		address_resolutions_by_height=None,
		mosaic_resolutions_by_height=None,
		namespace_by_id=None,
		namespace_names=None,
		mosaics_by_id=None,
		mosaics_response=None,
		metadata_by_query=None
	):  # pylint: disable=too-many-arguments,too-many-positional-arguments
		self.chain_height = chain_height
		self.pages = pages
		self.block_by_height = block_by_height or {}
		self.finalized_height = finalized_height
		self.transactions_by_path = transactions_by_path or {}
		self.statement_pages = statement_pages or {}
		self.account_by_address = account_by_address or {}
		self.multisig_by_address = multisig_by_address or {}
		self.account_pages = account_pages or {}
		self.address_resolutions_by_height = address_resolutions_by_height or {}
		self.mosaic_resolutions_by_height = mosaic_resolutions_by_height or {}
		self.namespace_by_id = namespace_by_id or {}
		self.namespace_names = namespace_names or {}
		self.mosaics_by_id = mosaics_by_id or {}
		self.mosaics_response = mosaics_response
		self.metadata_by_query = metadata_by_query or {}
		self.paths = []
		self.post_payloads_list = []
		self.post_requests = []

	@property
	def post_payloads(self):
		return self.post_payloads_list

	async def get(self, url_path, *_):  # pylint: disable=too-many-branches,too-many-return-statements,too-many-locals
		self.paths.append(url_path)
		if 'chain/info' == url_path:
			return create_chain_info(self.chain_height, self.finalized_height)
		if 'network/properties' == url_path:
			return create_network_properties()
		if f'mosaics/{NATIVE_MOSAIC_ID}' == url_path:
			return create_mosaic_definition()
		if url_path.startswith('blocks/'):
			height = int(url_path.removeprefix('blocks/'))
			return self.block_by_height[height]
		if url_path.startswith('blocks?pageSize=100&offset='):
			offset = int(url_path.split('offset=')[1].split('&')[0])
			return {
				'data': self.pages[offset],
				'pagination': {
					'pageSize': 100,
					'offset': offset
				}
			}
		if url_path.startswith('transactions/confirmed?'):
			response = self.transactions_by_path.get(url_path, {'data': []})
			if isinstance(response, Exception):
				raise response

			return response
		if url_path.startswith('statements/transaction?'):
			return self.statement_pages.get(url_path, {'data': []})
		resolution_match = re.fullmatch(
			rf'statements/resolutions/(address|mosaic)\?height=(\d+)&pageSize={MAX_PAGE_SIZE}&pageNumber=(\d+)',
			url_path)
		if resolution_match:
			kind, height_text, page_number_text = resolution_match.groups()
			height = int(height_text)
			page_number = int(page_number_text)
			items_by_height = self.address_resolutions_by_height if 'address' == kind else self.mosaic_resolutions_by_height
			items = items_by_height.get(height, [])
			page_start = (page_number - 1) * MAX_PAGE_SIZE
			return {
				'data': items[page_start:page_start + MAX_PAGE_SIZE],
				'pagination': {'pageNumber': page_number, 'pageSize': MAX_PAGE_SIZE}
			}
		if url_path.startswith('namespaces/'):
			namespace_id = url_path.removeprefix('namespaces/')
			response = self.namespace_by_id.get(namespace_id, {
				'code': 'ResourceNotFound',
				'message': f'no resource exists with id {namespace_id}'
			})
			if isinstance(response, Exception):
				raise response

			return response
		if url_path.startswith('account/') and url_path.endswith('/multisig'):
			address_text = url_path.removeprefix('account/').removesuffix('/multisig')
			return self.multisig_by_address.get(address_text, {
				'code': 'ResourceNotFound',
				'message': f'no resource exists with id {address_text}'
			})
		match = re.fullmatch(r'accounts\?pageSize=100&pageNumber=(\d+)&orderBy=id&order=desc', url_path)
		if match:
			page_number = int(match.group(1))
			return {
				'data': self.account_pages.get(page_number, []),
				'pagination': {
					'pageSize': 100,
					'pageNumber': page_number
				}
			}
		if url_path.startswith('metadata?'):
			response = self.metadata_by_query.get(url_path, {'data': []})
			if isinstance(response, Exception):
				raise response
			return response

		raise KeyError(url_path)

	async def post(self, url_path, request_payload, *_):
		self.paths.append(url_path)
		self.post_payloads_list.append(request_payload)
		self.post_requests.append((url_path, request_payload))
		if 'accounts' == url_path:
			return [
				self.account_by_address.get(
					address_text,
					create_account_item(address_hex=Network.TESTNET.address_class(address_text).bytes.hex().upper()))
				for address_text in request_payload['addresses']
			]
		if 'namespaces/names' == url_path:
			return [
				{'id': namespace_id, 'name': self.namespace_names[namespace_id]}
				for namespace_id in request_payload['namespaceIds']
			]
		if 'mosaics' == url_path:
			if self.mosaics_response is not None:
				return self.mosaics_response

			items = []
			for mosaic_id in request_payload['mosaicIds']:
				if mosaic_id not in self.mosaics_by_id:
					continue
				item = self.mosaics_by_id[mosaic_id]
				if isinstance(item, Exception):
					raise item
				items.append(item)

			return items

		raise KeyError(url_path)


class BoundedDetailConnector(FakeConnector):
	"""Gates detail requests so tests can observe bounded concurrent access."""

	DETAIL_PATH_PREFIX = None

	def __init__(self, *args, **kwargs):
		super().__init__(*args, **kwargs)
		self.detail_paths = []
		self.in_flight_detail_requests = 0
		self.max_in_flight_detail_requests = 0
		self._detail_requests_released = asyncio.Event()
		self._release_scheduled = False

	async def get(self, url_path, *args):
		if not url_path.startswith(self.DETAIL_PATH_PREFIX):
			return await super().get(url_path, *args)

		self.paths.append(url_path)
		self.detail_paths.append(url_path)
		self.in_flight_detail_requests += 1
		self.max_in_flight_detail_requests = max(
			self.max_in_flight_detail_requests,
			self.in_flight_detail_requests)
		try:
			if not self._release_scheduled:
				self._release_scheduled = True
				asyncio.get_running_loop().call_soon(self._detail_requests_released.set)
			await self._detail_requests_released.wait()

			response = self._get_detail_response(url_path)
			if isinstance(response, Exception):
				raise response

			return response
		finally:
			self.in_flight_detail_requests -= 1

	def _get_detail_response(self, url_path):
		raise NotImplementedError(url_path)


class BoundedMetadataConnector(BoundedDetailConnector):
	DETAIL_PATH_PREFIX = 'metadata?'

	def _get_detail_response(self, url_path):
		return self.metadata_by_query.get(url_path, {'data': []})


class ResponseConnector:
	def __init__(self, responses):
		self.responses = responses
		self.paths = []

	async def get(self, url_path, *_):
		self.paths.append(url_path)
		if f'mosaics/{NATIVE_MOSAIC_ID}' == url_path and url_path not in self.responses:
			return create_mosaic_definition()

		return self.responses[url_path]


class NoOpRateLimiter:
	@staticmethod
	async def wait_for_turn():
		return None


class NamespaceNamesResponseConnector(FakeConnector):
	def __init__(self, *args, names_response, **kwargs):
		super().__init__(*args, **kwargs)
		self.names_response = names_response

	async def post(self, url_path, request_payload, *args):
		if 'namespaces/names' == url_path:
			self.paths.append(url_path)
			self.post_payloads_list.append(request_payload)
			self.post_requests.append((url_path, request_payload))
			if isinstance(self.names_response, Exception):
				raise self.names_response

			return self.names_response

		return await super().post(url_path, request_payload, *args)


class BoundedNamespaceDetailConnector(BoundedDetailConnector):
	DETAIL_PATH_PREFIX = 'namespaces/'

	def _get_detail_response(self, url_path):
		return self.namespace_by_id[url_path.removeprefix('namespaces/')]


class SymbolPullerTestBase(TestCase):
	def setUp(self):
		self.exit_stack = ExitStack()
		self.config_dir = self.exit_stack.enter_context(
			tempfile.TemporaryDirectory()
		)
		self.db_config = self.exit_stack.enter_context(PostgresTestDatabase())
		self.config_ini = create_db_config(self.config_dir, self.db_config)
		self.puller = self.exit_stack.enter_context(
			create_symbol_puller(self.config_ini, 'testnet')
		)
		drop_symbol_block_tables_if_present(self.puller.symbol_db)
		self.puller.symbol_db.create_tables()

	def tearDown(self):
		self.exit_stack.close()

	@staticmethod
	def _fetch_block_heights(database):
		cursor = database.connection.cursor()
		cursor.execute('SELECT height FROM symbol_blocks ORDER BY height')

		return [row[0] for row in cursor.fetchall()]

	def _fetch_table_state(self, table_names):
		cursor = self.puller.symbol_db.connection.cursor()
		state = {}
		for table_name in table_names:
			cursor.execute(
				f'SELECT to_jsonb(table_row) FROM {table_name} AS table_row '
				'ORDER BY to_jsonb(table_row)::text')
			state[table_name] = cursor.fetchall()

		return state

	def _fetch_complete_batch_state(self):
		return self._fetch_table_state((
			'symbol_blocks',
			'symbol_transactions',
			'symbol_transaction_mosaics',
			'symbol_transaction_addresses',
			'symbol_receipts',
			'symbol_accounts',
			'symbol_account_mosaics',
			'symbol_multisig',
			'symbol_namespaces',
			'symbol_alias_names',
			'symbol_mosaics',
			'symbol_metadata',
			'symbol_hash_locks',
			'symbol_secret_locks',
			'symbol_mosaic_restrictions',
			'symbol_sync_state'))

	@staticmethod
	def _fetch_block_hash(database, height):
		cursor = database.connection.cursor()
		cursor.execute(
			'SELECT hash FROM symbol_blocks WHERE height = %s',
			(height,)
		)

		return bytes(cursor.fetchone()[0])

	@staticmethod
	def _fetch_importance_block_fields(database, height):
		cursor = database.connection.cursor()
		cursor.execute(
			'SELECT voting_eligible_accounts_count, '
			'harvesting_eligible_accounts_count, total_voting_balance, '
			'previous_importance_block_hash FROM symbol_blocks '
			'WHERE height = %s',
			(height,)
		)

		return cursor.fetchone()

	@staticmethod
	def _fetch_block_reward(database, height):
		cursor = database.connection.cursor()
		cursor.execute('SELECT block_reward FROM symbol_blocks WHERE height = %s', (height,))

		result = cursor.fetchone()
		return result[0] if result else None

	@staticmethod
	def _fetch_receipts(database):
		cursor = database.connection.cursor()
		cursor.execute(
			'''
			SELECT
				height,
				receipt_type,
				receipt_group,
				source_primary_id,
				source_secondary_id,
				mosaic_id,
				amount
			FROM symbol_receipts
			ORDER BY height, id
			'''
		)

		return cursor.fetchall()

	@staticmethod
	def _beneficiary_address_text():
		return str(Address.from_decoded_address_hex_string(BENEFICIARY_ADDRESS))

	def _seed_blocks(self, database, heights, block_hashes=None):
		block_hashes = block_hashes or {}
		rows = [
			create_block_row(
				create_node_block(
					height,
					block_hash=block_hashes.get(height)
				),
				100,
				self.puller.symbol_facade.network
			)
			for height in heights
		]
		database.upsert_blocks(rows)

	def _sync_with_connector(self, connector, max_height=None):
		# Arrange:
		set_symbol_connector(self.puller, connector)

		# Act:
		asyncio.run(self.puller.sync_block_headers(max_height))

		return (
			self._fetch_block_heights(self.puller.symbol_db),
			self.puller.symbol_db.get_sync_state()
		)

	def _assert_namespace_requests(self, connector, expected_namespace_ids, expected_name_payloads):
		# Assert:
		namespace_paths = [
			path for path in connector.paths
			if path.startswith('namespaces/') and path != 'namespaces/names'
		]
		names_payloads = [
			payload for path, payload in connector.post_requests
			if 'namespaces/names' == path
		]
		self.assertEqual(len(expected_namespace_ids), len(namespace_paths))
		self.assertEqual([f'namespaces/{namespace_id}' for namespace_id in expected_namespace_ids], namespace_paths)
		self.assertEqual(len(expected_name_payloads), len(names_payloads))
		self.assertEqual(expected_name_payloads, names_payloads)

	def _assert_sync_rejects_node_response(
		self,
		connector,
		error_type,
		error_message,
		max_height=None
	):
		# Arrange:
		set_symbol_connector(self.puller, connector)

		# Act:
		with self.assertRaisesRegex(error_type, error_message):
			if max_height is None:
				asyncio.run(self.puller.sync_block_headers())
			else:
				asyncio.run(self.puller.sync_block_headers(max_height))

		# Assert:
		self.assertEqual([], self._fetch_block_heights(self.puller.symbol_db))
		self.assertIsNone(self.puller.symbol_db.get_sync_state())
