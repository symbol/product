import os
import shutil
import tempfile
from pathlib import Path

import pytest
from symbolchain.CryptoTypes import PrivateKey
from symbolchain.sc import LinkAction, TransactionFactory, TransactionType
from symbolchain.symbol.KeyPair import KeyPair
from symbolchain.symbol.VotingKeysGenerator import VotingKeysGenerator

from shoestring.__main__ import main
from shoestring.internal.CertificateFactory import CertificateFactory
from shoestring.internal.NodeFeatures import NodeFeatures
from shoestring.internal.OpensslExecutor import OpensslExecutor
from shoestring.internal.PackageResolver import download_and_extract_package
from shoestring.internal.PeerDownloader import download_peers
from shoestring.internal.PemUtils import read_public_key_from_public_key_pem_file
from shoestring.internal.VoterConfigurator import inspect_voting_key_files

from ..test.ConfigurationTestUtils import prepare_shoestring_configuration
from ..test.MockNodewatchServer import setup_mock_nodewatch_server
from ..test.TestPackager import prepare_testnet_package
from ..test.TransactionTestUtils import AggregateDescriptor, LinkDescriptor, assert_aggregate_complete_transaction, assert_link_transaction

# region server fixture


@pytest.fixture
def server(event_loop, aiohttp_client):
	return setup_mock_nodewatch_server(event_loop, aiohttp_client, True)


# mock server is configured to return last finalized height as 2033136,
# which corresponds to the following epochs
# -----------------------------------------------
# current epoch = 1 + ceil(2033136 / 720) = 2825
# one epoch padding                       =    1
# grace period padding                    =    1
# -----------------------------------------------
# start epoch                             = 2827
# max voting key lifetime                 =  720
# start epoch inclusion adjustment        =   -1
#  -----------------------------------------------
# end epoch                               = 3546

# endregion


# region utils

class PytestAsserter:
	@staticmethod
	def assertEqual(expected, actual):  # pylint: disable=invalid-name
		assert expected == actual


async def _prepare_output_directory(package_directory, output_directory, node_features, nodewatch_url):
	# extract resources
	prepare_testnet_package(package_directory, 'resources.zip')
	await download_and_extract_package(f'file://{package_directory}/resources.zip', package_directory)

	resources_directory = output_directory / 'userconfig' / 'resources'
	shutil.copytree(package_directory / 'resources', resources_directory)
	await download_peers(nodewatch_url, resources_directory)

	# prepare CA pem file
	certificates_directory = output_directory / 'keys' / 'cert'
	certificates_directory.mkdir(parents=True)

	openssl_executor = OpensslExecutor(os.environ.get('OPENSSL_EXECUTABLE', 'openssl'))
	with CertificateFactory(openssl_executor, certificates_directory / 'ca.key.pem') as factory:
		factory.generate_random_ca_private_key()
		factory.export_ca()
		factory.extract_ca_public_key()
		factory.package(certificates_directory)

	# create voting keys directory
	if NodeFeatures.VOTER in node_features:
		(output_directory / 'keys' / 'voting').mkdir()


def _map_voting_key_descriptors_to_tuples(voting_key_descriptors):
	return [(descriptor.ordinal, descriptor.start_epoch, descriptor.end_epoch) for descriptor in voting_key_descriptors]


def _write_voting_keys_file(directory, ordinal, start_epoch, end_epoch):
	voting_key_pair = KeyPair(PrivateKey.random())
	voting_keys_generator = VotingKeysGenerator(voting_key_pair)
	voting_key_buffer = voting_keys_generator.generate(start_epoch, end_epoch)

	output_filepath = Path(directory) / f'private_key_tree{ordinal}.dat'
	with open(output_filepath, 'wb') as outfile:
		outfile.write(voting_key_buffer)

	return voting_key_pair.public_key


def _read_transaction(directory):
	with open(Path(directory) / 'renew_voting_keys_transaction.dat', 'rb') as infile:
		transaction_bytes = infile.read()
		return TransactionFactory.deserialize(transaction_bytes)


def _assert_is_logged(message, caplog):
	assert message in [record.message for record in caplog.records]

# endregion


# pylint: disable=invalid-name


async def test_renew_voting_keys_fails_when_node_is_not_voter(server, caplog):  # pylint: disable=redefined-outer-name
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory:
		with tempfile.TemporaryDirectory() as package_directory:
			node_features = NodeFeatures.PEER | NodeFeatures.API | NodeFeatures.HARVESTER
			config_filepath = prepare_shoestring_configuration(package_directory, node_features)
			await _prepare_output_directory(Path(package_directory), Path(output_directory), node_features, server.make_url(''))

			# Act:
			await main([
				'renew-voting-keys',
				'--config', str(config_filepath),
				'--directory', output_directory
			])

			# Assert: error is raised
			_assert_is_logged('node is not configured for voting, aborting', caplog)

			# - voting keys directory does not exist
			assert not (Path(output_directory) / 'keys' / 'voting').exists()

			# - no transaction is created
			assert not (Path(output_directory) / 'renew_voting_keys_transaction.dat').exists()


async def test_can_renew_voting_keys_when_none_are_present(server, caplog):  # pylint: disable=redefined-outer-name
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory:
		with tempfile.TemporaryDirectory() as package_directory:
			config_filepath = prepare_shoestring_configuration(package_directory, NodeFeatures.VOTER, server.make_url(''))
			await _prepare_output_directory(Path(package_directory), Path(output_directory), NodeFeatures.VOTER, server.make_url(''))

			# Act:
			await main([
				'renew-voting-keys',
				'--config', str(config_filepath),
				'--directory', output_directory
			])

			# Assert: warning is raised
			_assert_is_logged('voting is enabled, but no existing voting key files were found', caplog)

			# - new voting keys file is created
			voting_key_descriptors = inspect_voting_key_files(Path(output_directory) / 'keys' / 'voting')
			assert [(1, 2827, 3546)] == _map_voting_key_descriptors_to_tuples(voting_key_descriptors)

			# - transaction is created
			transaction = _read_transaction(output_directory)
			ca_public_key = read_public_key_from_public_key_pem_file(Path(output_directory) / 'keys' / 'cert' / 'ca.pubkey.pem')
			assert_aggregate_complete_transaction(PytestAsserter(), transaction, AggregateDescriptor(
				168 + 96,
				200,
				123456789 + 1 * 60 * 60 * 1000,
				ca_public_key))
			assert 1 == len(transaction.transactions)

			assert_link_transaction(PytestAsserter(), transaction.transactions[0], LinkDescriptor(
				TransactionType.VOTING_KEY_LINK,
				voting_key_descriptors[0].public_key,
				LinkAction.LINK,
				(2827, 3546)))


async def test_can_renew_voting_keys_when_some_are_present_and_active(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory:
		with tempfile.TemporaryDirectory() as package_directory:
			config_filepath = prepare_shoestring_configuration(package_directory, NodeFeatures.VOTER, server.make_url(''))
			await _prepare_output_directory(Path(package_directory), Path(output_directory), NodeFeatures.VOTER, server.make_url(''))

			voting_keys_directory = Path(output_directory) / 'keys' / 'voting'
			_write_voting_keys_file(voting_keys_directory, 1, 2800, 2899)
			_write_voting_keys_file(voting_keys_directory, 2, 2900, 2999)

			# Act:
			await main([
				'renew-voting-keys',
				'--config', str(config_filepath),
				'--directory', output_directory
			])

			# Assert: existing voting keys files are preserved and new voting keys file is created
			voting_key_descriptors = inspect_voting_key_files(voting_keys_directory)
			assert [
				(1, 2800, 2899),
				(2, 2900, 2999),
				(3, 3000, 3719)
			] == _map_voting_key_descriptors_to_tuples(voting_key_descriptors)

			# - transaction is created
			transaction = _read_transaction(output_directory)
			ca_public_key = read_public_key_from_public_key_pem_file(Path(output_directory) / 'keys' / 'cert' / 'ca.pubkey.pem')
			assert_aggregate_complete_transaction(PytestAsserter(), transaction, AggregateDescriptor(
				168 + 96,
				200,
				123456789 + 1 * 60 * 60 * 1000,
				ca_public_key))
			assert 1 == len(transaction.transactions)

			assert_link_transaction(PytestAsserter(), transaction.transactions[0], LinkDescriptor(
				TransactionType.VOTING_KEY_LINK,
				voting_key_descriptors[-1].public_key,
				LinkAction.LINK,
				(3000, 3719)))


async def test_can_renew_voting_keys_when_some_are_present_and_inactive(server):  # pylint: disable=redefined-outer-name
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory:
		with tempfile.TemporaryDirectory() as package_directory:
			config_filepath = prepare_shoestring_configuration(package_directory, NodeFeatures.VOTER, server.make_url(''))
			await _prepare_output_directory(Path(package_directory), Path(output_directory), NodeFeatures.VOTER, server.make_url(''))

			voting_keys_directory = Path(output_directory) / 'keys' / 'voting'
			expired_root_voting_public_key_1 = _write_voting_keys_file(voting_keys_directory, 1, 2600, 2699)
			expired_root_voting_public_key_2 = _write_voting_keys_file(voting_keys_directory, 2, 2700, 2799)
			_write_voting_keys_file(voting_keys_directory, 3, 2800, 2825)  # last epoch matches current epoch
			_write_voting_keys_file(voting_keys_directory, 4, 2826, 2999)

			# Act:
			await main([
				'renew-voting-keys',
				'--config', str(config_filepath),
				'--directory', output_directory
			])

			# Assert: inactive voting keys files are deleted, active voting keys files are preserved and new voting keys file is created
			voting_key_descriptors = inspect_voting_key_files(voting_keys_directory)
			assert [
				(1, 2800, 2825),
				(2, 2826, 2999),
				(3, 3000, 3719),
			] == _map_voting_key_descriptors_to_tuples(voting_key_descriptors)

			# - transaction is created
			transaction = _read_transaction(output_directory)
			ca_public_key = read_public_key_from_public_key_pem_file(Path(output_directory) / 'keys' / 'cert' / 'ca.pubkey.pem')
			assert_aggregate_complete_transaction(PytestAsserter(), transaction, AggregateDescriptor(
				168 + 3 * 96,
				200,
				123456789 + 1 * 60 * 60 * 1000,
				ca_public_key))
			assert 3 == len(transaction.transactions)

			assert_link_transaction(PytestAsserter(), transaction.transactions[0], LinkDescriptor(
				TransactionType.VOTING_KEY_LINK,
				expired_root_voting_public_key_1,
				LinkAction.UNLINK,
				(2600, 2699)))
			assert_link_transaction(PytestAsserter(), transaction.transactions[1], LinkDescriptor(
				TransactionType.VOTING_KEY_LINK,
				expired_root_voting_public_key_2,
				LinkAction.UNLINK,
				(2700, 2799)))
			assert_link_transaction(PytestAsserter(), transaction.transactions[2], LinkDescriptor(
				TransactionType.VOTING_KEY_LINK,
				voting_key_descriptors[-1].public_key,
				LinkAction.LINK,
				(3000, 3719)))


async def test_cannot_renew_voting_keys_when_max_keys_are_active(server, caplog):  # pylint: disable=redefined-outer-name
	# Arrange:
	with tempfile.TemporaryDirectory() as output_directory:
		with tempfile.TemporaryDirectory() as package_directory:
			config_filepath = prepare_shoestring_configuration(package_directory, NodeFeatures.VOTER, server.make_url(''))
			await _prepare_output_directory(Path(package_directory), Path(output_directory), NodeFeatures.VOTER, server.make_url(''))

			voting_keys_directory = Path(output_directory) / 'keys' / 'voting'
			_write_voting_keys_file(voting_keys_directory, 1, 2800, 2825)  # last epoch matches current epoch
			_write_voting_keys_file(voting_keys_directory, 2, 3100, 3199)
			_write_voting_keys_file(voting_keys_directory, 3, 3200, 3299)

			# Act:
			await main([
				'renew-voting-keys',
				'--config', str(config_filepath),
				'--directory', output_directory
			])

			# Assert: error is raised
			_assert_is_logged('maximum number of voting keys are already registered for this account', caplog)

			# - no voting keys files are created or changed
			voting_key_descriptors = inspect_voting_key_files(voting_keys_directory)
			assert [
				(1, 2800, 2825),
				(2, 3100, 3199),
				(3, 3200, 3299)
			] == _map_voting_key_descriptors_to_tuples(voting_key_descriptors)

			# no transaction is created
			assert not (Path(output_directory) / 'renew_voting_keys_transaction.dat').exists()
