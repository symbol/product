import tempfile
from binascii import hexlify
from pathlib import Path

import pytest
from symbolchain.CryptoTypes import Hash256, PrivateKey
from symbolchain.facade.SymbolFacade import SymbolFacade
from symbolchain.symbol.KeyPair import KeyPair

from shoestring.__main__ import main
from shoestring.internal.NodeFeatures import NodeFeatures

from ..test.ConfigurationTestUtils import prepare_shoestring_configuration
from ..test.MockNodewatchServer import setup_mock_nodewatch_server

# region server fixture


@pytest.fixture
def server(event_loop, aiohttp_client):
	return setup_mock_nodewatch_server(event_loop, aiohttp_client, True)

# endregion


# region tests

async def _run_test(server, expected_url_path, transaction_descriptor_factory):  # pylint: disable=redefined-outer-name
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory:
		# - prepare shoestring configuration
		config_filepath = prepare_shoestring_configuration(output_directory, NodeFeatures.PEER, server.make_url(''))

		# - generate and write out (unsigned) transaction
		facade = SymbolFacade('testnet')
		transaction_filepath = Path(output_directory) / 'transaction.dat'
		with open(transaction_filepath, 'wb') as outfile:
			transaction = facade.transaction_factory.create({
				**transaction_descriptor_factory(),
				'signer_public_key': KeyPair(PrivateKey.random()).public_key,
				'deadline': 1234000
			})
			transaction_buffer = transaction.serialize()
			outfile.write(transaction_buffer)

		# Act:
		await main([
			'announce-transaction',
			'--config', str(config_filepath),
			'--transaction', str(transaction_filepath)
		])

		# Assert:
		assert [
			f'{server.make_url("")}/api/symbol/nodes/peer',
			f'{server.make_url("")}/{expected_url_path}'
		] == server.mock.urls
		assert [
			{'payload': hexlify(transaction_buffer).upper().decode('utf8')}
		] == server.mock.request_json_payloads


# pylint: disable=invalid-name


async def test_can_announce_regular_transaction(server):  # pylint: disable=redefined-outer-name
	await _run_test(server, 'transactions', lambda: {
		'type': 'account_key_link_transaction_v1',

		'linked_public_key': KeyPair(PrivateKey.random()).public_key,
		'link_action': 'link'
	})


def _create_aggregate_transaction_descriptor(transaction_type):
	return {
		'type': transaction_type,
		'fee': 0,
		'deadline': 0,
		'transactions_hash': Hash256.zero(),
		'transactions': []
	}


async def test_can_announce_aggregate_complete_transaction(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	def create_transaction_descriptor():
		return _create_aggregate_transaction_descriptor('aggregate_complete_transaction_v2')

	# Act + Assert:
	await _run_test(server, 'transactions', create_transaction_descriptor)


async def test_can_announce_aggregate_bonded_transaction(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	def create_transaction_descriptor():
		return _create_aggregate_transaction_descriptor('aggregate_bonded_transaction_v2')

	# Act + Assert:
	await _run_test(server, 'transactions/partial', create_transaction_descriptor)

# endregion
