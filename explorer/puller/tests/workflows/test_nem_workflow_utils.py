import argparse
import unittest
from unittest.mock import patch

from workflow_test_utils import assert_common_args, create_facade_with_mock_db, create_main_args

from puller.workflows.nem_workflow_utils import add_common_arguments, bootstrap_nem_workflow


class NemWorkflowUtilsTest(unittest.TestCase):
	def test_add_common_arguments_parses_shared_workflow_arguments(self):
		# Arrange:
		parser = argparse.ArgumentParser()
		add_common_arguments(parser)

		# Act:
		args = parser.parse_args([
			'--nem-node', 'http://localhost:7890',
			'--network', 'testnet',
			'--db-config', 'test_config.ini'
		])

		# Assert:
		assert_common_args(self, args, 'testnet', 'test_config.ini')

	def test_add_common_arguments_applies_defaults(self):
		# Arrange:
		parser = argparse.ArgumentParser()
		add_common_arguments(parser)

		# Act:
		args = parser.parse_args([])

		# Assert:
		assert_common_args(self, args)

	@patch('puller.workflows.nem_workflow_utils.NemPuller')
	def test_bootstrap_logs_target_node_and_network(self, mock_nem_puller):
		# Arrange:
		create_facade_with_mock_db(mock_nem_puller)

		# Act:
		with self.assertLogs(level='INFO') as captured:
			bootstrap_nem_workflow(create_main_args())

		# Assert:
		self.assertEqual(
			['Node URL: http://localhost:7890', 'Network: testnet'],
			[record.getMessage() for record in captured.records])

	@patch('puller.workflows.nem_workflow_utils.configure_logging')
	@patch('puller.workflows.nem_workflow_utils.NemPuller')
	def test_bootstrap_configures_logging(self, mock_nem_puller, mock_configure_logging):
		# Arrange:
		create_facade_with_mock_db(mock_nem_puller)

		# Act:
		bootstrap_nem_workflow(create_main_args())

		# Assert:
		self.assertEqual(1, mock_configure_logging.call_count)
