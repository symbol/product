from unittest.mock import Mock, patch


def parse_args_with_argv(script_name, parse_args, *argv):
	with patch('sys.argv', [script_name, *argv]):
		return parse_args()


def assert_common_args(test_case, args, network='mainnet', db_config='config.ini'):
	test_case.assertEqual(args.nem_node, 'http://localhost:7890')
	test_case.assertEqual(args.network, network)
	test_case.assertEqual(args.db_config, db_config)


def create_main_args(batch_size=None, account_remark=None):
	args = Mock()
	args.nem_node = 'http://localhost:7890'
	args.network = 'testnet'
	args.db_config = 'test_config.ini'
	args.account_remark = account_remark

	if None is not batch_size:
		args.batch_size = batch_size

	return args


def create_facade_with_mock_db(mock_nem_puller):
	mock_facade = Mock()
	mock_nem_puller.return_value = mock_facade

	mock_db = Mock()
	mock_facade.nem_db = mock_db
	mock_facade.nem_db.__enter__ = Mock(return_value=mock_db)
	mock_facade.nem_db.__exit__ = Mock(return_value=None)

	return mock_facade, mock_db


class RecordingSymbolDatabase:
	def __init__(self):
		self.create_tables_call_count = 0

	def create_tables(self):
		self.create_tables_call_count += 1


class RecordingSymbolPuller:
	def __init__(self, *args, **kwargs):
		self.constructor_args = args
		self.constructor_kwargs = kwargs
		self.symbol_db = RecordingSymbolDatabase()
		self.refresh_accounts_call_count = 0
		self.synced_max_heights = []

	def __enter__(self):
		return self

	def __exit__(self, *_):
		return None

	async def refresh_accounts(self):
		self.refresh_accounts_call_count += 1

	async def sync_block_headers(self, max_height):
		self.synced_max_heights.append(max_height)


class FailingRefreshSymbolPuller(RecordingSymbolPuller):
	async def refresh_accounts(self):
		raise RuntimeError('refresh failed')


class RecordingSymbolPullerFactory:
	def __init__(self):
		self.puller = None

	def __call__(self, *args, **kwargs):
		self.puller = RecordingSymbolPuller(*args, **kwargs)
		return self.puller


class FailingRefreshSymbolPullerFactory:
	def __init__(self):
		self.puller = None

	def __call__(self, *args, **kwargs):
		self.puller = FailingRefreshSymbolPuller(*args, **kwargs)
		return self.puller


def create_symbol_environment(request_timeout_seconds='17'):
	return {
		'SYMBOL_NODE_ALLOWED_HOSTS': 'localhost:7890',
		'SYMBOL_NODE_ALLOW_LOOPBACK': 'true',
		'SYMBOL_NODE_ALLOW_PRIVATE': 'false',
		'SYMBOL_NODE_REQUEST_TIMEOUT_SECONDS': request_timeout_seconds
	}


def assert_symbol_node_config(test_case, node_config):
	test_case.assertEqual('http://localhost:7890', node_config.base_url)
	test_case.assertEqual(frozenset({'localhost:7890'}), node_config.allowed_hosts)
	test_case.assertTrue(node_config.allow_loopback)
	test_case.assertFalse(node_config.allow_private)
	test_case.assertEqual(17, node_config.timeout_seconds)
