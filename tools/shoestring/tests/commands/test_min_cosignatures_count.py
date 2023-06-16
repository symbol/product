import tempfile
from pathlib import Path

import pytest
from symbolchain.CryptoTypes import PrivateKey
from symbolchain.PrivateKeyStorage import PrivateKeyStorage
from symbolchain.symbol.Network import Network

from shoestring.__main__ import main
from shoestring.internal.ConfigurationManager import ConfigurationManager
from shoestring.internal.NodeFeatures import NodeFeatures
from shoestring.internal.PemUtils import read_public_key_from_private_key_pem_file
from shoestring.internal.ShoestringConfiguration import NodeConfiguration, ShoestringConfiguration

from ..test.ConfigurationTestUtils import prepare_shoestring_configuration
from ..test.LogTestUtils import assert_message_is_logged
from ..test.MockNodewatchServer import setup_mock_nodewatch_server

# region server fixture


@pytest.fixture
def server(event_loop, aiohttp_client):
	return setup_mock_nodewatch_server(event_loop, aiohttp_client, True)

# endregion


# region tests


def _create_configuration():
	return ShoestringConfiguration(*(5 * [None]), NodeConfiguration(NodeFeatures.PEER, None, None, None, False, None, None))


def _load_ca_address(ca_pem_filepath):
	ca_public_key = read_public_key_from_private_key_pem_file(ca_pem_filepath)
	return Network.TESTNET.public_key_to_address(ca_public_key)


async def _run_test(server, caplog, additional_flags, expected_config_value):    # pylint: disable=redefined-outer-name
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory:
		PrivateKeyStorage(output_directory).save('ca.key', PrivateKey.random())

		ca_pem_filepath = Path(output_directory) / 'ca.key.pem'
		ca_address = _load_ca_address(ca_pem_filepath)
		server.mock.multisig_account_addresses.append(ca_address)

		config_filepath = prepare_shoestring_configuration(output_directory, NodeFeatures.PEER, server.make_url(''))

		# Act:
		await main([
			'min-cosignatures-count',
			'--config', str(config_filepath),
			'--ca-key-path', str(ca_pem_filepath)
		] + additional_flags)

		# Assert:
		assert_message_is_logged(f'detected at least 2 cosignatures are required for transactions from {ca_address}', caplog)

		min_cosignatures_count_from_config = int(ConfigurationManager(output_directory).lookup(config_filepath.name, [
			('transaction', 'minCosignaturesCount')
		])[0])
		assert expected_config_value == min_cosignatures_count_from_config


# pylint: disable=invalid-name


async def test_can_detect_min_cosignatures_count_without_update_flag(server, caplog):  # pylint: disable=redefined-outer-name
	await _run_test(server, caplog, [], 0)


async def test_can_detect_and_update_min_cosignatures_count_with_update_flag(server, caplog):  # pylint: disable=redefined-outer-name
	await _run_test(server, caplog, ['--update'], 2)


# endregion
