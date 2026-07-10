import asyncio
import tempfile
from contextlib import ExitStack, contextmanager
from pathlib import Path
from unittest import TestCase

from common.symbol.NodeConfiguration import SymbolNodeConfiguration
from common.tests.PostgresTestUtils import PostgresTestDatabase, drop_symbol_block_tables_if_present
from symbolchain.sc import ReceiptType, TransactionType

from puller.facade.SymbolPuller import MAX_PAGE_SIZE, DatabaseConfiguration, SymbolPuller
from puller.model.symbol.Block import create_block_row
from tests.test.SymbolTestConstants import BENEFICIARY_ADDRESS, RECIPIENT_ADDRESS, SIGNER_PUBLIC_KEY

NODE_URL = 'http://127.0.0.1:3000'


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


def create_node_transaction(height, transaction_hash=None, transaction_id=None, **transaction_overrides):
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
		'mosaics': [{'id': 'E74B99BA41F4AFEE', 'amount': str(height * 1000)}]
	}
	transaction.update(transaction_overrides)

	return {
		'meta': {
			'height': str(height),
			'hash': transaction_hash,
			'merkleComponentHash': transaction_hash,
			'index': 0,
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
		'mosaics': [{'id': 'E74B99BA41F4AFEE', 'amount': str(height * 1000)}]
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


def create_statement_item(height, amount, receipt_type=ReceiptType.INFLATION.value):
	return {
		'statement': {
			'height': str(height),
			'source': {'primaryId': height, 'secondaryId': 0},
			'receipts': [{
				'version': 1,
				'type': receipt_type,
				'mosaicId': '72C0212E67A08BCE',
				'amount': str(amount)
			}]
		},
		'id': f'statement-{height}-{amount}',
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
	return {'network': {'epochAdjustment': epoch_adjustment}}


class FakeConnector:
	def __init__(  # pylint: disable=too-many-arguments,too-many-positional-arguments
		self,
		chain_height,
		pages,
		block_by_height=None,
		finalized_height=1,
		transactions_by_path=None,
		statement_pages=None
	):  # pylint: disable=too-many-arguments,too-many-positional-arguments
		self.chain_height = chain_height
		self.pages = pages
		self.block_by_height = block_by_height or {}
		self.finalized_height = finalized_height
		self.transactions_by_path = transactions_by_path or {}
		self.statement_pages = statement_pages or {}
		self.paths = []

	async def get(self, url_path, *_):
		self.paths.append(url_path)
		if 'chain/info' == url_path:
			return create_chain_info(self.chain_height, self.finalized_height)
		if 'network/properties' == url_path:
			return create_network_properties()
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

		raise KeyError(url_path)


class ResponseConnector:
	def __init__(self, responses):
		self.responses = responses
		self.paths = []

	async def get(self, url_path, *_):
		self.paths.append(url_path)
		return self.responses[url_path]


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
