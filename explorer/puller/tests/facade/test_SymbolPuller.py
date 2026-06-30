import asyncio
import tempfile
from contextlib import ExitStack, contextmanager
from pathlib import Path
from unittest import TestCase
from unittest.mock import AsyncMock, patch

from common.symbol.NodeConfiguration import SymbolNodeConfiguration
from common.tests.PostgresTestUtils import (
    PostgresTestDatabase,
    drop_symbol_block_tables_if_present
)
from symbollightapi.model.Exceptions import NodeException

from puller.facade.SymbolPuller import (
    DatabaseConfiguration,
    SymbolPuller,
    SymbolRollbackError
)

NODE_URL = 'http://127.0.0.1:3000'
SIGNER_PUBLIC_KEY = (
    '76E94661562762111FF7E592B00398554973396D8A4B922F3E3D139892F7C35C'
)
BENEFICIARY_ADDRESS = '9889432DE263BB8FE88444A4DA28D3609BD8BB8FAE18AE95'


def _create_db_config(config_dir, db_config=None, include_symbol_db=True):
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


def _create_symbol_puller(
    db_config_path,
    network_type='mainnet',
    request_timeout_seconds=10,
    node_url=NODE_URL
):
    node_config = SymbolNodeConfiguration.from_url(
        node_url,
        allow_loopback=True,
        timeout_seconds=request_timeout_seconds
    )

    return SymbolPuller(
        node_url,
        db_config_path,
        network_type,
        node_config
    )


@contextmanager
def _temporary_symbol_puller(
    network_type='mainnet',
    request_timeout_seconds=10
):
    with tempfile.TemporaryDirectory() as temp_directory:
        db_config_path = _create_db_config(temp_directory)

        yield _create_symbol_puller(
            db_config_path,
            network_type,
            request_timeout_seconds
        )


def _set_symbol_connector(puller, connector):
    # Keep protected connector replacement in one helper so sync tests can use
    # deterministic Symbol node responses.
    puller._symbol_connector = connector  # pylint: disable=protected-access


def _set_sync_block_pages(puller, sync_block_pages):
    # Patch the private page sync step only for hard-to-reach error branches.
    puller._sync_block_pages = (
        sync_block_pages  # pylint: disable=protected-access
    )


def _create_block_row(puller, node_block, epoch_adjustment_seconds):
    # Reuse production normalization instead of duplicating row construction.
    return puller._create_block_row(  # pylint: disable=protected-access
        node_block,
        epoch_adjustment_seconds
    )


def _create_node_block(
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


def _create_sync_state(**overrides):
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


def _create_chain_info(chain_height=1, finalized_height=1):
    return {
        'height': str(chain_height),
        'latestFinalizedBlock': {
            'finalizationEpoch': 4,
            'finalizationPoint': 5,
            'height': str(finalized_height),
            'hash': f'{finalized_height:064X}'
        }
    }


def _create_network_properties(epoch_adjustment='100s'):
    return {'network': {'epochAdjustment': epoch_adjustment}}


class FakeConnector:
    def __init__(
        self,
        chain_height,
        pages,
        block_by_height=None,
        finalized_height=1
    ):
        self.chain_height = chain_height
        self.pages = pages
        self.block_by_height = block_by_height or {}
        self.finalized_height = finalized_height
        self.paths = []

    async def get(self, url_path, *_):
        self.paths.append(url_path)
        if 'chain/info' == url_path:
            return _create_chain_info(self.chain_height, self.finalized_height)
        if 'network/properties' == url_path:
            return _create_network_properties()
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

        raise KeyError(url_path)


class ResponseConnector:
    def __init__(self, responses):
        self.responses = responses
        self.paths = []

    async def get(self, url_path, *_):
        self.paths.append(url_path)
        return self.responses[url_path]


class _SymbolPullerTestBase(TestCase):
    def setUp(self):
        self.exit_stack = ExitStack()
        self.config_dir = self.exit_stack.enter_context(
            tempfile.TemporaryDirectory()
        )
        self.db_config = self.exit_stack.enter_context(PostgresTestDatabase())
        self.config_ini = _create_db_config(self.config_dir, self.db_config)
        self.puller = _create_symbol_puller(self.config_ini, 'testnet')
        with self.puller.symbol_db as database:
            drop_symbol_block_tables_if_present(database)

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

    def _seed_blocks(self, database, heights, block_hashes=None):
        block_hashes = block_hashes or {}
        rows = [
            _create_block_row(
                self.puller,
                _create_node_block(
                    height,
                    block_hash=block_hashes.get(height)
                ),
                100
            )
            for height in heights
        ]
        database.upsert_blocks(rows)

    def _sync_with_connector(self, connector, max_height=None):
        # Arrange:
        with self.puller.symbol_db as database:
            database.create_tables()
            _set_symbol_connector(self.puller, connector)

            # Act:
            asyncio.run(self.puller.sync_block_headers(max_height))

            return (
                self._fetch_block_heights(database),
                database.get_sync_state()
            )

    def _assert_sync_rejects_node_response(
        self,
        connector,
        error_type,
        error_message
    ):
        # Arrange:
        with self.puller.symbol_db as database:
            database.create_tables()
            _set_symbol_connector(self.puller, connector)

            # Act:
            with self.assertRaisesRegex(error_type, error_message):
                asyncio.run(self.puller.sync_block_headers())

            # Assert:
            self.assertEqual([], self._fetch_block_heights(database))
            self.assertIsNone(database.get_sync_state())


class SymbolPullerTest(TestCase):

    def test_create_default_puller_instance(self):
        # Arrange / Act:
        with _temporary_symbol_puller() as puller:
            # Assert:
            self.assertEqual('mainnet', puller.symbol_facade.network.name)
            self.assertEqual('symbol', puller.symbol_db.db_config.database)
            self.assertIsNone(puller.symbol_db.connection)

    def test_create_testnet_puller_instance(self):
        # Arrange / Act:
        with _temporary_symbol_puller(
            'testnet',
            request_timeout_seconds=15
        ) as puller:
            # Assert:
            self.assertEqual(NODE_URL, puller.node_config.base_url)
            self.assertEqual('testnet', puller.symbol_facade.network.name)
            self.assertEqual('symbol', puller.symbol_db.db_config.database)
            self.assertIsNone(puller.symbol_db.connection)

    @patch('puller.facade.SymbolPuller.SymbolConnector')
    def test_initializes_with_custom_request_timeout(
        self,
        symbol_connector_factory
    ):
        # Arrange / Act:
        with _temporary_symbol_puller(
            'testnet',
            request_timeout_seconds=15
        ) as puller:
            self.assertEqual(15, puller.node_config.timeout_seconds)

        # Assert:
        self.assertEqual(
            15,
            symbol_connector_factory.return_value.timeout_seconds
        )

    def test_rejects_unsupported_network_type(self):
        # Arrange:
        with tempfile.TemporaryDirectory() as temp_directory:
            db_config_path = _create_db_config(temp_directory)

            # Act / Assert:
            with self.assertRaisesRegex(
                ValueError,
                'Unsupported Symbol network "main". '
                'Supported values: mainnet, testnet'
            ):
                _create_symbol_puller(db_config_path, 'main')

    def test_requires_symbol_db_config_section(self):
        # Arrange:
        with tempfile.TemporaryDirectory() as temp_directory:
            db_config_path = _create_db_config(
                temp_directory,
                include_symbol_db=False
            )

            # Act / Assert:
            with self.assertRaisesRegex(KeyError, 'symbol_db'):
                _create_symbol_puller(db_config_path)

    def test_initializes_from_node_url_when_node_config_is_omitted(self):
        # Arrange:
        with tempfile.TemporaryDirectory() as temp_directory:
            db_config_path = _create_db_config(temp_directory)
            with patch(
                'common.symbol.NodeConfiguration.socket.getaddrinfo',
                return_value=[
                    (None, None, None, None, ('93.184.216.34', 3000))
                ]
            ):
                # Act:
                puller = SymbolPuller(
                    'http://example.com:3000',
                    db_config_path,
                    'testnet'
                )

            # Assert:
            self.assertEqual(
                'http://example.com:3000',
                puller.node_config.base_url
            )
            self.assertEqual(
                frozenset({'example.com:3000'}),
                puller.node_config.allowed_hosts
            )
            self.assertEqual('testnet', puller.symbol_facade.network.name)

    @patch('puller.facade.SymbolPuller.SymbolConnector')
    def test_get_symbol_node_validates_target(self, symbol_connector_factory):
        # Arrange:
        with _temporary_symbol_puller() as puller:
            symbol_connector = symbol_connector_factory.return_value
            symbol_connector.get = AsyncMock(return_value={'ok': True})

            # Act:
            result = asyncio.run(puller.get_symbol_node(
                '/blocks?pageNumber=1&pageSize=100',
                'data',
                False
            ))

        # Assert:
        self.assertEqual({'ok': True}, result)
        symbol_connector.get.assert_awaited_once_with(
            'blocks?pageNumber=1&pageSize=100',
            'data',
            False
        )

    @patch('puller.facade.SymbolPuller.SymbolConnector')
    def test_post_symbol_node_validates_target(self, symbol_connector_factory):
        # Arrange:
        with _temporary_symbol_puller() as puller:
            symbol_connector = symbol_connector_factory.return_value
            symbol_connector.post = AsyncMock(return_value={'ok': True})

            # Act:
            result = asyncio.run(puller.post_symbol_node(
                'path',
                {'payload': 1},
                'data',
                False
            ))

        # Assert:
        self.assertEqual({'ok': True}, result)
        symbol_connector.post.assert_awaited_once_with(
            'path',
            {'payload': 1},
            'data',
            False
        )

    @patch('asyncio.sleep')
    @patch('puller.facade.SymbolPuller.SymbolConnector')
    def test_post_symbol_node_retries_api_error_response(
        self,
        symbol_connector_factory,
        mock_sleep
    ):
        # Arrange:
        with _temporary_symbol_puller() as puller:
            symbol_connector = symbol_connector_factory.return_value
            symbol_connector.post = AsyncMock(side_effect=[
                {
                    'code': 'InvalidArgument',
                    'message': 'payload has an invalid format'
                },
                {'ok': True}
            ])
            mock_sleep.return_value = AsyncMock()

            # Act:
            result = asyncio.run(puller.post_symbol_node(
                '/transactions',
                {'payload': 'ABCD'}
            ))

        # Assert:
        self.assertEqual({'ok': True}, result)
        self.assertEqual(2, symbol_connector.post.await_count)
        mock_sleep.assert_called_once_with(2)

    @patch('asyncio.sleep')
    @patch('puller.facade.SymbolPuller.SymbolConnector')
    def test_get_symbol_node_retries_node_exception(
        self,
        symbol_connector_factory,
        mock_sleep
    ):
        # Arrange:
        with _temporary_symbol_puller() as puller:
            symbol_connector = symbol_connector_factory.return_value
            symbol_connector.get = AsyncMock(side_effect=[
                NodeException('Connection refused'),
                {'ok': True}
            ])
            mock_sleep.return_value = AsyncMock()

            # Act:
            result = asyncio.run(puller.get_symbol_node('/chain/info'))

        # Assert:
        self.assertEqual({'ok': True}, result)
        self.assertEqual(2, symbol_connector.get.await_count)
        mock_sleep.assert_called_once_with(2)

    @patch('asyncio.sleep')
    @patch('puller.facade.SymbolPuller.SymbolConnector')
    def test_get_symbol_node_raises_after_max_retries(
        self,
        symbol_connector_factory,
        mock_sleep
    ):
        # Arrange:
        with _temporary_symbol_puller() as puller:
            symbol_connector = symbol_connector_factory.return_value
            symbol_connector.get = AsyncMock(
                side_effect=NodeException('Connection refused')
            )
            mock_sleep.return_value = AsyncMock()

            # Act / Assert:
            with self.assertRaisesRegex(NodeException, 'Connection refused'):
                asyncio.run(puller.get_symbol_node('/chain/info'))

        # Assert:
        self.assertEqual(3, symbol_connector.get.await_count)
        self.assertEqual(2, mock_sleep.call_count)

    @patch('asyncio.sleep')
    @patch('puller.facade.SymbolPuller.SymbolConnector')
    def test_get_symbol_node_retries_api_error_response(
        self,
        symbol_connector_factory,
        mock_sleep
    ):
        # Arrange:
        with _temporary_symbol_puller() as puller:
            symbol_connector = symbol_connector_factory.return_value
            symbol_connector.get = AsyncMock(side_effect=[
                {
                    'code': 'InvalidArgument',
                    'message': 'offset has an invalid format'
                },
                {'data': [], 'pagination': {'pageNumber': 1, 'pageSize': 100}}
            ])
            mock_sleep.return_value = AsyncMock()

            # Act:
            result = asyncio.run(puller.get_symbol_node(
                '/blocks?pageSize=100&offset=bad&orderBy=height'
            ))

        # Assert:
        self.assertEqual(
            {'data': [], 'pagination': {'pageNumber': 1, 'pageSize': 100}},
            result
        )
        self.assertEqual(2, symbol_connector.get.await_count)
        mock_sleep.assert_called_once_with(2)

    @patch('puller.facade.SymbolPuller.SymbolConnector')
    def test_symbol_node_path_must_be_relative(self, symbol_connector_factory):
        # Arrange:
        with _temporary_symbol_puller() as puller:
            # Act / Assert:
            with self.assertRaisesRegex(
                ValueError,
                'Symbol node connector paths must be relative'
            ):
                asyncio.run(puller.get_symbol_node('http://example.com/path'))

            # Assert:
            symbol_connector_factory.return_value.get.assert_not_called()

    @patch('puller.facade.SymbolPuller.SymbolConnector')
    def test_symbol_node_path_must_not_include_fragments(
        self,
        symbol_connector_factory
    ):
        # Arrange:
        with _temporary_symbol_puller() as puller:
            # Act / Assert:
            with self.assertRaisesRegex(
                ValueError,
                'Symbol node connector paths must not include fragments'
            ):
                asyncio.run(puller.get_symbol_node('blocks#fragment'))

            # Assert:
            symbol_connector_factory.return_value.get.assert_not_called()


class SymbolPullerSyncTest(_SymbolPullerTestBase):

    def test_sync_block_headers_pulls_chain_info_network_properties_and_blocks(
        self
    ):
        # Arrange:
        connector = FakeConnector(
            2,
            {0: [_create_node_block(1), _create_node_block(2)]}
        )

        # Act:
        self._sync_with_connector(connector)

        # Assert:
        self.assertEqual([
            'chain/info',
            'network/properties',
            'blocks?pageSize=100&offset=0&orderBy=height'
        ], connector.paths)

    def test_sync_block_headers_persists_synced_block_watermark(self):
        # Arrange:
        connector = FakeConnector(
            2,
            {0: [_create_node_block(1), _create_node_block(2)]}
        )

        # Act:
        block_heights, sync_state = self._sync_with_connector(connector)

        # Assert:
        self.assertEqual([1, 2], block_heights)
        self.assertEqual('healthy', sync_state['status'])
        self.assertEqual(2, sync_state['chain_height'])
        self.assertEqual(1, sync_state['finalized_height'])
        self.assertEqual(
            bytes.fromhex(f'{2:064X}'),
            bytes(sync_state['last_synced_block_hash'])
        )

    def test_sync_block_headers_persists_importance_block_fields(self):
        # Arrange:
        connector = FakeConnector(1, {0: [_create_node_block(
            1,
            votingEligibleAccountsCount=4,
            harvestingEligibleAccountsCount='17',
            totalVotingBalance='19000235663367',
            previousImportanceBlockHash='86' * 32
        )]})

        with self.puller.symbol_db as database:
            database.create_tables()
            _set_symbol_connector(self.puller, connector)

            # Act:
            asyncio.run(self.puller.sync_block_headers())

            # Assert:
            (
                voting_eligible,
                harvesting_eligible,
                total_voting,
                previous_importance_hash
            ) = (
                self._fetch_importance_block_fields(database, 1)
            )

        self.assertEqual(4, voting_eligible)
        self.assertEqual(17, harvesting_eligible)
        self.assertEqual(19000235663367, total_voting)
        self.assertEqual(
            bytes.fromhex('86' * 32),
            bytes(previous_importance_hash)
        )

    def test_sync_block_headers_paginates_by_offset(self):
        # Arrange:
        first_page = [_create_node_block(height) for height in range(1, 101)]
        second_page = [_create_node_block(101)]
        connector = FakeConnector(101, {0: first_page, 100: second_page})

        # Act:
        _, sync_state = self._sync_with_connector(connector)

        # Assert:
        self.assertIn(
            'blocks?pageSize=100&offset=0&orderBy=height',
            connector.paths
        )
        self.assertIn(
            'blocks?pageSize=100&offset=100&orderBy=height',
            connector.paths
        )
        self.assertEqual(101, sync_state['last_synced_height'])

    def test_sync_block_headers_stops_at_max_height(self):
        # Arrange:
        connector = FakeConnector(
            101,
            {0: [_create_node_block(height) for height in range(1, 101)]}
        )

        # Act:
        block_heights, sync_state = self._sync_with_connector(
            connector,
            max_height=2
        )

        # Assert:
        self.assertEqual([
            'chain/info',
            'network/properties',
            'blocks?pageSize=100&offset=0&orderBy=height'
        ], connector.paths)
        self.assertEqual([1, 2], block_heights)
        self.assertEqual('healthy', sync_state['status'])
        self.assertEqual(2, sync_state['chain_height'])
        self.assertEqual(2, sync_state['last_synced_height'])

    def test_sync_block_headers_caps_finalization_to_max_height(self):
        # Arrange:
        connector = FakeConnector(
            5,
            {0: [_create_node_block(height) for height in range(1, 6)]},
            finalized_height=5
        )

        # Act:
        _, sync_state = self._sync_with_connector(connector, max_height=2)

        # Assert:
        self.assertEqual(2, sync_state['chain_height'])
        self.assertEqual(2, sync_state['finalized_height'])
        self.assertEqual(
            bytes.fromhex(f'{2:064X}'),
            bytes(sync_state['finalized_hash'])
        )
        self.assertIsNone(sync_state['finalized_epoch'])
        self.assertIsNone(sync_state['finalized_point'])

    def test_sync_block_headers_continues_from_existing_sync_state(self):
        # Arrange:
        connector = FakeConnector(
            4,
            {2: [_create_node_block(3), _create_node_block(4)]},
            {2: _create_node_block(2)}
        )
        with self.puller.symbol_db as database:
            database.create_tables()
            self._seed_blocks(database, [1, 2])
            database.upsert_sync_state(_create_sync_state(
                chain_height=2,
                last_synced_height=2,
                last_synced_block_hash=bytes.fromhex(f'{2:064X}')
            ))
            _set_symbol_connector(self.puller, connector)

            # Act:
            asyncio.run(self.puller.sync_block_headers())

            # Assert:
            block_heights = self._fetch_block_heights(database)
            sync_state = database.get_sync_state()

        self.assertEqual([
            'chain/info',
            'network/properties',
            'blocks/2',
            'blocks?pageSize=100&offset=2&orderBy=height'
        ], connector.paths)
        self.assertEqual([1, 2, 3, 4], block_heights)
        self.assertEqual('healthy', sync_state['status'])
        self.assertEqual(4, sync_state['chain_height'])
        self.assertEqual(4, sync_state['last_synced_height'])
        self.assertEqual(
            bytes.fromhex(f'{4:064X}'),
            bytes(sync_state['last_synced_block_hash'])
        )

    def test_sync_block_headers_bounds_existing_sync_state_to_max_height(self):
        # Arrange:
        connector = FakeConnector(5, {}, finalized_height=5)
        with self.puller.symbol_db as database:
            database.create_tables()
            self._seed_blocks(database, range(1, 6))
            database.upsert_sync_state(_create_sync_state(
                chain_height=5,
                finalized_height=5,
                finalized_hash=bytes.fromhex(f'{5:064X}'),
                last_synced_height=5,
                last_synced_block_hash=bytes.fromhex(f'{5:064X}')
            ))
            _set_symbol_connector(self.puller, connector)

            # Act:
            asyncio.run(self.puller.sync_block_headers(max_height=2))

            # Assert:
            sync_state = database.get_sync_state()

        self.assertEqual([
            'chain/info',
            'network/properties'
        ], connector.paths)
        self.assertEqual(2, sync_state['chain_height'])
        self.assertEqual(2, sync_state['finalized_height'])
        self.assertEqual(2, sync_state['last_synced_height'])
        self.assertEqual(
            bytes.fromhex(f'{2:064X}'),
            bytes(sync_state['finalized_hash'])
        )
        self.assertEqual(
            bytes.fromhex(f'{2:064X}'),
            bytes(sync_state['last_synced_block_hash'])
        )

    def test_sync_block_headers_rejects_missing_capped_finalization_hash(self):
        # Arrange:
        connector = FakeConnector(5, {}, finalized_height=5)
        with self.puller.symbol_db as database:
            database.create_tables()
            _set_symbol_connector(self.puller, connector)
            _set_sync_block_pages(
                self.puller,
                AsyncMock(return_value=(None, None))
            )

            # Act / Assert:
            with self.assertRaisesRegex(
                ValueError,
                'Unable to determine finalized hash for height 2'
            ):
                asyncio.run(self.puller.sync_block_headers(max_height=2))

            # Assert:
            self.assertIsNone(database.get_sync_state())


class SymbolPullerNodeResponseTest(_SymbolPullerTestBase):

    def test_rejects_missing_chain_height(self):
        # Arrange:
        chain_info = _create_chain_info()
        del chain_info['height']
        connector = ResponseConnector({
            'chain/info': chain_info,
            'network/properties': _create_network_properties()
        })

        # Act / Assert:
        self._assert_sync_rejects_node_response(connector, KeyError, 'height')

    def test_rejects_missing_epoch_adjustment(self):
        # Arrange:
        connector = ResponseConnector({
            'chain/info': _create_chain_info(),
            'network/properties': {'network': {}}
        })

        # Act / Assert:
        self._assert_sync_rejects_node_response(
            connector,
            KeyError,
            'epochAdjustment'
        )

    def test_rejects_missing_block_hash(self):
        # Arrange:
        block = _create_node_block(1)
        del block['meta']['hash']
        connector = FakeConnector(1, {0: [block]})

        # Act / Assert:
        self._assert_sync_rejects_node_response(connector, KeyError, 'hash')

    def _assert_rejects_missing_block_field(self, container, field_name):
        # Arrange:
        block = _create_node_block(1)
        del block[container][field_name]
        connector = FakeConnector(1, {0: [block]})

        # Act / Assert:
        self._assert_sync_rejects_node_response(
            connector,
            KeyError,
            field_name
        )

    def test_rejects_missing_state_hash_sub_cache_roots(self):
        self._assert_rejects_missing_block_field(
            'meta',
            'stateHashSubCacheMerkleRoots'
        )

    def test_rejects_missing_fee_multiplier(self):
        self._assert_rejects_missing_block_field('block', 'feeMultiplier')

    def test_rejects_missing_beneficiary_address(self):
        self._assert_rejects_missing_block_field(
            'block',
            'beneficiaryAddress'
        )

    def test_rejects_missing_proof_gamma(self):
        self._assert_rejects_missing_block_field('block', 'proofGamma')

    def test_rejects_missing_proof_verification_hash(self):
        self._assert_rejects_missing_block_field(
            'block',
            'proofVerificationHash'
        )

    def test_rejects_missing_proof_scalar(self):
        self._assert_rejects_missing_block_field('block', 'proofScalar')

    def test_rejects_missing_state_hash(self):
        self._assert_rejects_missing_block_field('block', 'stateHash')

    def test_rejects_missing_transactions_hash(self):
        self._assert_rejects_missing_block_field('block', 'transactionsHash')

    def test_rejects_missing_receipts_hash(self):
        self._assert_rejects_missing_block_field('block', 'receiptsHash')

    def test_rejects_malformed_block_height(self):
        # Arrange:
        block = _create_node_block(1)
        block['block']['height'] = 'not-a-height'
        connector = FakeConnector(1, {0: [block]})

        # Act / Assert:
        self._assert_sync_rejects_node_response(
            connector,
            ValueError,
            'invalid literal'
        )

    def test_rejects_symbol_node_api_error_response(self):
        # Arrange:
        connector = ResponseConnector({
            'chain/info': _create_chain_info(),
            'network/properties': _create_network_properties(),
            'blocks?pageSize=100&offset=0&orderBy=height': {
                'code': 'InvalidArgument',
                'message': 'offset has an invalid format'
            }
        })

        # Act / Assert:
        self._assert_sync_rejects_node_response(
            connector,
            NodeException,
            'InvalidArgument: offset has an invalid format'
        )

    def test_rejects_malformed_block_page_response(self):
        # Arrange:
        connector = ResponseConnector({
            'chain/info': _create_chain_info(),
            'network/properties': _create_network_properties(),
            'blocks?pageSize=100&offset=0&orderBy=height': {
                'pagination': {'pageNumber': 1, 'pageSize': 100}
            }
        })

        # Act / Assert:
        self._assert_sync_rejects_node_response(
            connector,
            ValueError,
            'Malformed Symbol block page response'
        )

    def test_sync_block_headers_rejects_invalid_max_height(self):
        # Arrange:
        connector = FakeConnector(1, {})
        with self.puller.symbol_db as database:
            database.create_tables()
            _set_symbol_connector(self.puller, connector)

            # Act / Assert:
            with self.assertRaisesRegex(
                ValueError,
                'max_height must be greater than or equal to 1'
            ):
                asyncio.run(self.puller.sync_block_headers(max_height=0))

    def test_sync_block_headers_rejects_short_page_before_chain_height(self):
        # Arrange:
        connector = FakeConnector(
            3,
            {0: [_create_node_block(1), _create_node_block(2)]}
        )
        with self.puller.symbol_db as database:
            database.create_tables()
            _set_symbol_connector(self.puller, connector)

            # Act / Assert:
            with self.assertRaisesRegex(
                ValueError,
                'Short Symbol block page ended at height 2 '
                'before chain height 3'
            ):
                asyncio.run(self.puller.sync_block_headers())

            # Assert:
            self.assertEqual([], self._fetch_block_heights(database))
            self.assertIsNone(database.get_sync_state())


class SymbolPullerRollbackTest(_SymbolPullerTestBase):

    def test_sync_block_headers_repairs_shallow_unfinalized_rollback(self):
        # Arrange:
        connector = FakeConnector(
            3,
            {1: [_create_node_block(2), _create_node_block(3)]},
            {2: _create_node_block(2)}
        )
        with self.puller.symbol_db as database:
            database.create_tables()
            self._seed_blocks(
                database,
                [1, 2, 3],
                {2: b'local mismatch'.hex()}
            )
            database.upsert_sync_state(_create_sync_state())
            _set_symbol_connector(self.puller, connector)

            # Act:
            asyncio.run(self.puller.sync_block_headers())

            # Assert:
            block_heights = self._fetch_block_heights(database)
            block_hash = self._fetch_block_hash(database, 2)
            sync_state = database.get_sync_state()

        self.assertEqual([1, 2, 3], block_heights)
        self.assertEqual(
            bytes.fromhex(f'{2:064X}'),
            block_hash
        )
        self.assertEqual('healthy', sync_state['status'])
        self.assertEqual(3, sync_state['last_synced_height'])

    def test_sync_block_headers_marks_deep_finalized_mismatch_unhealthy(self):
        # Arrange:
        connector = FakeConnector(3, {})
        with self.puller.symbol_db as database:
            database.create_tables()
            self._seed_blocks(database, [1], {1: b'local mismatch'.hex()})
            database.upsert_sync_state(_create_sync_state(
                finalized_hash=b'old finalized'
            ))
            _set_symbol_connector(self.puller, connector)

            # Act / Assert:
            with self.assertRaisesRegex(
                SymbolRollbackError,
                'Finalized block hash does not match local database'
            ):
                asyncio.run(self.puller.sync_block_headers())

            # Assert:
            sync_state = database.get_sync_state()

        self.assertEqual('unhealthy', sync_state['status'])

    def test_sync_block_headers_marks_missing_finalized_block_unhealthy(self):
        # Arrange:
        connector = FakeConnector(3, {})
        with self.puller.symbol_db as database:
            database.create_tables()
            database.upsert_sync_state(_create_sync_state())
            _set_symbol_connector(self.puller, connector)

            # Act / Assert:
            with self.assertRaisesRegex(
                SymbolRollbackError,
                'Finalized block is missing from local database'
            ):
                asyncio.run(self.puller.sync_block_headers())

            # Assert:
            sync_state = database.get_sync_state()

        self.assertEqual('unhealthy', sync_state['status'])
        self.assertEqual(
            bytes.fromhex(f'{1:064X}'),
            bytes(sync_state['finalized_hash'])
        )

    def test_sync_block_headers_keeps_watermark_when_no_new_pages_exist(
        self
    ):
        # Arrange:
        connector = FakeConnector(
            3,
            {},
            {2: _create_node_block(2), 3: _create_node_block(3)},
            finalized_height=3
        )
        with self.puller.symbol_db as database:
            database.create_tables()
            self._seed_blocks(database, [1, 2, 3])
            database.upsert_sync_state(_create_sync_state(
                finalized_height=3,
                finalized_hash=bytes.fromhex(f'{3:064X}')
            ))
            _set_symbol_connector(self.puller, connector)

            # Act:
            asyncio.run(self.puller.sync_block_headers())

            # Assert:
            sync_state = database.get_sync_state()

        self.assertEqual(3, sync_state['last_synced_height'])
        self.assertEqual(
            bytes.fromhex(f'{3:064X}'),
            bytes(sync_state['last_synced_block_hash'])
        )

    def test_sync_block_headers_verifies_unfinalized_hashes_without_rollback(
        self
    ):
        # Arrange:
        connector = FakeConnector(
            3,
            {},
            {2: _create_node_block(2), 3: _create_node_block(3)}
        )
        with self.puller.symbol_db as database:
            database.create_tables()
            self._seed_blocks(database, [1, 2, 3])
            database.upsert_sync_state(_create_sync_state())
            _set_symbol_connector(self.puller, connector)

            # Act:
            asyncio.run(self.puller.sync_block_headers())

            # Assert:
            block_heights = self._fetch_block_heights(database)
            sync_state = database.get_sync_state()

        self.assertEqual([1, 2, 3], block_heights)
        self.assertEqual(3, sync_state['last_synced_height'])

    def test_sync_block_headers_repairs_missing_unfinalized_block_hash(self):
        # Arrange:
        connector = FakeConnector(
            3,
            {2: [_create_node_block(3)]},
            {2: _create_node_block(2)}
        )
        with self.puller.symbol_db as database:
            database.create_tables()
            self._seed_blocks(database, [1, 2])
            database.upsert_sync_state(_create_sync_state())
            _set_symbol_connector(self.puller, connector)

            # Act:
            asyncio.run(self.puller.sync_block_headers())

            # Assert:
            block_heights = self._fetch_block_heights(database)
            sync_state = database.get_sync_state()

        self.assertEqual([1, 2, 3], block_heights)
        self.assertEqual('healthy', sync_state['status'])
        self.assertEqual(3, sync_state['last_synced_height'])

    def test_sync_block_headers_repairs_gap_in_unfinalized_block_hashes(self):
        # Arrange:
        connector = FakeConnector(
            3,
            {1: [_create_node_block(2), _create_node_block(3)]}
        )
        with self.puller.symbol_db as database:
            database.create_tables()
            self._seed_blocks(database, [1, 3])
            database.upsert_sync_state(_create_sync_state())
            _set_symbol_connector(self.puller, connector)

            # Act:
            asyncio.run(self.puller.sync_block_headers())

            # Assert:
            block_heights = self._fetch_block_heights(database)
            sync_state = database.get_sync_state()

        self.assertEqual([1, 2, 3], block_heights)
        self.assertEqual('healthy', sync_state['status'])
        self.assertEqual(3, sync_state['last_synced_height'])

    def test_sync_block_headers_rejects_empty_page_before_chain_height(self):
        # Arrange:
        connector = FakeConnector(1, {0: []})
        with self.puller.symbol_db as database:
            database.create_tables()
            _set_symbol_connector(self.puller, connector)

            # Act / Assert:
            with self.assertRaisesRegex(
                ValueError,
                'Expected Symbol blocks at offset 0 before chain height 1'
            ):
                asyncio.run(self.puller.sync_block_headers())

            # Assert:
            self.assertEqual([], self._fetch_block_heights(database))
            self.assertIsNone(database.get_sync_state())

    def test_sync_block_headers_rejects_page_past_target_height(self):
        # Arrange:
        connector = FakeConnector(1, {0: [_create_node_block(2)]})
        with self.puller.symbol_db as database:
            database.create_tables()
            _set_symbol_connector(self.puller, connector)

            # Act / Assert:
            with self.assertRaisesRegex(
                ValueError,
                'Symbol block page at offset 0 does not contain blocks at or '
                'below chain height 1'
            ):
                asyncio.run(self.puller.sync_block_headers())

            # Assert:
            self.assertEqual([], self._fetch_block_heights(database))
            self.assertIsNone(database.get_sync_state())

    def test_sync_block_headers_rejects_unexpected_height_sequence(self):
        # Arrange:
        connector = FakeConnector(2, {0: [_create_node_block(2)]})
        with self.puller.symbol_db as database:
            database.create_tables()
            _set_symbol_connector(self.puller, connector)

            # Act / Assert:
            with self.assertRaisesRegex(
                ValueError,
                'Unexpected Symbol block height 2; expected 1'
            ):
                asyncio.run(self.puller.sync_block_headers())
