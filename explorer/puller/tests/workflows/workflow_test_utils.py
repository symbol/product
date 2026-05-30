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
