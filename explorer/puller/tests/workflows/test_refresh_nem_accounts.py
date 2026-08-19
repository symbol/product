import asyncio
import unittest
from unittest.mock import AsyncMock, patch

from workflow_test_utils import assert_common_args, create_facade_with_mock_db, create_main_args, parse_args_with_argv

from puller.workflows.refresh_nem_accounts import main, parse_args


class RefreshNemAccountsTest(unittest.TestCase):

	def test_parse_args_with_defaults(self):
		# Arrange + Act:
		args = parse_args_with_argv('refresh_nem_accounts.py', parse_args)

		# Assert:
		assert_common_args(self, args)
		self.assertEqual(args.batch_size, 500)

	def test_parse_args_with_custom_values(self):
		# Arrange + Act:
		args = parse_args_with_argv(
			'refresh_nem_accounts.py',
			parse_args,
			'--nem-node', 'http://localhost:7890',
			'--network', 'testnet',
			'--db-config', 'test_config.ini',
			'--batch-size', '100')

		# Assert:
		assert_common_args(self, args, 'testnet', 'test_config.ini')
		self.assertEqual(args.batch_size, 100)

	def test_parse_args_rejects_invalid_batch_size(self):
		# Arrange + Act + Assert:
		with patch('sys.argv', ['refresh_nem_accounts.py', '--batch-size', '0']):
			with self.assertRaises(SystemExit):
				parse_args()

	@patch('puller.workflows.nem_workflow_utils.NemPuller')
	@patch('puller.workflows.refresh_nem_accounts.parse_args')
	def test_can_refresh_accounts(self, mock_parse_args, mock_nem_puller):
		# Arrange:
		mock_parse_args.return_value = create_main_args(batch_size=100)
		mock_facade, _ = create_facade_with_mock_db(mock_nem_puller)
		mock_facade.refresh_accounts = AsyncMock(return_value=3)

		# Act:
		result = asyncio.run(main())

		# Assert:
		self.assertIsNone(result)
		mock_nem_puller.assert_called_once_with('http://localhost:7890', 'test_config.ini', 'testnet')
		mock_facade.refresh_accounts.assert_called_once_with(100)
