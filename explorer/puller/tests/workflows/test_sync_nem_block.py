import asyncio
import unittest
from unittest.mock import AsyncMock, Mock, patch

from workflow_test_utils import assert_common_args, create_facade_with_mock_db, create_main_args, parse_args_with_argv

from puller.workflows.sync_nem_block import main, parse_args


class SyncNemBlockTest(unittest.TestCase):

	def test_parse_args_with_defaults(self):
		# Arrange + Act:
		args = parse_args_with_argv('sync_nem_block.py', parse_args)

		# Assert:
		assert_common_args(self, args)

	def test_parse_args_with_custom_values(self):
		# Arrange + Act:
		args = parse_args_with_argv(
			'sync_nem_block.py',
			parse_args,
			'--nem-node', 'http://localhost:7890',
			'--network', 'testnet',
			'--db-config', 'test_config.ini')

		# Assert:
		assert_common_args(self, args, 'testnet', 'test_config.ini')

	@patch('puller.workflows.sync_nem_block.NemPuller')
	@patch('puller.workflows.sync_nem_block.parse_args')
	def _run_main_test(
		self,
		mock_parse_args,
		mock_nem_puller,
		db_height,
		account_remark=None,
		fork_height=None
	):  # pylint: disable=no-self-use,too-many-arguments,too-many-positional-arguments
		# Arrange:
		mock_parse_args.return_value = create_main_args(account_remark=account_remark)
		mock_facade, mock_db = create_facade_with_mock_db(mock_nem_puller)

		mock_connector = Mock()
		mock_facade.nem_connector = mock_connector
		mock_connector.chain_height = AsyncMock(return_value=10)

		mock_db.get_current_height.return_value = db_height
		mock_facade.sync_nemesis_block = AsyncMock()
		mock_facade.detect_rollback = AsyncMock(return_value=fork_height)
		rollback_impact = Mock()
		account_state = Mock()
		mock_facade.capture_rollback_impact.return_value = rollback_impact
		mock_facade.prefetch_rollback_account_state = AsyncMock(return_value=account_state)
		mock_facade.sync_blocks = AsyncMock()

		# Act:
		asyncio.run(main())

		# Assert:
		mock_nem_puller.assert_called_once_with('http://localhost:7890', 'test_config.ini', 'testnet')
		mock_db.create_tables.assert_called_once()
		if account_remark:
			mock_db.seed_account_remark.assert_called_once_with(account_remark)
		else:
			mock_db.seed_account_remark.assert_not_called()
		mock_db.get_current_height.assert_called_once()
		mock_connector.chain_height.assert_called_once()
		mock_facade.detect_rollback.assert_called_once_with(1, 10)
		if fork_height is None:
			mock_facade.capture_rollback_impact.assert_not_called()
			mock_facade.prefetch_rollback_account_state.assert_not_awaited()
			mock_facade.repair_rollback.assert_not_called()
			mock_facade.sync_blocks.assert_called_once_with(1, 10)
		else:
			mock_facade.capture_rollback_impact.assert_called_once_with(fork_height)
			mock_facade.prefetch_rollback_account_state.assert_awaited_once_with(rollback_impact)
			mock_facade.repair_rollback.assert_called_once_with(rollback_impact, account_state)
			mock_facade.sync_blocks.assert_awaited_once_with(fork_height, 10)

		return mock_facade

	def test_sync_nemesis_block_when_db_empty(self):
		# Act:
		mock_facade = self._run_main_test(db_height=0)  # pylint: disable=no-value-for-parameter

		# Assert:
		mock_facade.sync_nemesis_block.assert_called_once()

	def test_can_skip_sync_nemesis_block_when_db_height_is_not_zero(self):
		# Act:
		mock_facade = self._run_main_test(db_height=1)  # pylint: disable=no-value-for-parameter

		# Assert:
		mock_facade.sync_nemesis_block.assert_not_called()

	def test_can_seed_account_remark_when_configured(self):
		# Act:
		self._run_main_test(db_height=1, account_remark='test_remark.json')  # pylint: disable=no-value-for-parameter

	def test_repairs_rollback_before_syncing_canonical_blocks(self):
		# Act:
		self._run_main_test(db_height=1, fork_height=5)  # pylint: disable=no-value-for-parameter
