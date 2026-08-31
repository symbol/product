import argparse
import asyncio
import os
import unittest

from common.symbol.NodeConfiguration import SymbolNodeConfigurationError
from workflow_test_utils import (
	FailingCreateTablesSymbolPullerFactory,
	RecordingSymbolPullerFactory,
	assert_symbol_node_config,
	create_symbol_environment
)

from puller.workflows.symbol_workflow_utils import add_common_arguments, create_node_config, run_symbol_workflow


class SymbolWorkflowUtilsTest(unittest.TestCase):
	def test_add_common_arguments_parses_shared_workflow_arguments(self):
		# Arrange:
		parser = argparse.ArgumentParser()
		add_common_arguments(parser)

		# Act:
		args = parser.parse_args([
			'--symbol-node', 'http://localhost:7890',
			'--network', 'testnet',
			'--db-config', 'test_config.ini'
		])

		# Assert:
		self.assertEqual('http://localhost:7890', args.symbol_node)
		self.assertEqual('testnet', args.network)
		self.assertEqual('test_config.ini', args.db_config)

	def test_create_node_config_uses_explicit_environment(self):
		# Arrange:
		environment = create_symbol_environment()

		# Act:
		node_config = create_node_config('http://localhost:7890', environment)

		# Assert:
		assert_symbol_node_config(self, node_config)

	def test_create_node_config_defaults_to_process_environment(self):
		# Arrange:
		environment = create_symbol_environment()
		previous_environment = {name: os.environ.get(name) for name in environment}

		# Act:
		try:
			os.environ.update(environment)
			node_config = create_node_config('http://localhost:7890')
		finally:
			for name, value in previous_environment.items():
				if value is None:
					os.environ.pop(name, None)
				else:
					os.environ[name] = value

		# Assert:
		assert_symbol_node_config(self, node_config)

	def test_create_node_config_rejects_missing_allowed_hosts(self):
		# Act + Assert:
		with self.assertRaisesRegex(
			SymbolNodeConfigurationError,
			'SYMBOL_NODE_ALLOWED_HOSTS is required'
		):
			create_node_config('http://localhost:7890', {})

	def test_run_symbol_workflow_runs_operation_after_table_initialization(self):
		# Arrange:
		factory = RecordingSymbolPullerFactory()
		args = argparse.Namespace(
			symbol_node='http://localhost:7890',
			db_config='test_config.ini',
			network='testnet')
		environment = create_symbol_environment()
		operation_pullers = []

		async def operation(puller):
			operation_pullers.append(puller)

		# Act:
		asyncio.run(run_symbol_workflow(factory, args, operation, environment, {'max_requests_per_second': 25}))

		# Assert:
		puller = factory.puller
		self.assertEqual(
			('http://localhost:7890', 'test_config.ini', 'testnet'),
			puller.constructor_args[:3])
		self.assertEqual(4, len(puller.constructor_args))
		assert_symbol_node_config(self, puller.constructor_args[3])
		self.assertEqual({'max_requests_per_second': 25}, puller.constructor_kwargs)
		self.assertEqual(1, puller.symbol_db.create_tables_call_count)
		self.assertEqual([puller], operation_pullers)
		self.assertEqual(1, puller.async_enter_call_count)
		self.assertEqual(1, puller.async_exit_call_count)

	def test_run_symbol_workflow_stops_before_operation_when_table_creation_fails(self):
		# Arrange:
		factory = FailingCreateTablesSymbolPullerFactory()
		args = argparse.Namespace(
			symbol_node='http://localhost:7890',
			db_config='test_config.ini',
			network='testnet')
		environment = create_symbol_environment()
		operation_pullers = []

		async def operation(puller):
			operation_pullers.append(puller)

		# Act:
		with self.assertRaisesRegex(RuntimeError, 'create tables failed') as exception_context:
			asyncio.run(run_symbol_workflow(factory, args, operation, environment))

		# Assert:
		puller = factory.puller
		self.assertEqual('create tables failed', str(exception_context.exception))
		self.assertEqual(1, puller.symbol_db.create_tables_call_count)
		self.assertEqual([], operation_pullers)
		self.assertEqual(1, puller.async_enter_call_count)
		self.assertEqual(1, puller.async_exit_call_count)
