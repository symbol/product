import shutil
from pathlib import Path

from symbollightapi.connector.SymbolConnector import SymbolConnector
from zenlog import log

from shoestring.internal.ConfigurationManager import ConfigurationManager
from shoestring.internal.LinkTransactionBuilder import LinkTransactionBuilder
from shoestring.internal.NodeFeatures import NodeFeatures
from shoestring.internal.NodewatchClient import get_current_finalization_epoch
from shoestring.internal.PeerDownloader import load_api_endpoints
from shoestring.internal.PemUtils import read_public_key_from_public_key_pem_file
from shoestring.internal.Preparer import Preparer
from shoestring.internal.ShoestringConfiguration import parse_shoestring_configuration
from shoestring.internal.TransactionSerializer import write_transaction_to_file
from shoestring.internal.VoterConfigurator import VoterConfigurator, inspect_voting_key_files


def _load_voting_key_descriptors(directory, current_epoch):
	voting_key_descriptors = inspect_voting_key_files(directory)
	active_voting_key_descriptors = []
	inactive_voting_key_descriptors = []
	for descriptor in voting_key_descriptors:
		(inactive_voting_key_descriptors if descriptor.end_epoch < current_epoch else active_voting_key_descriptors).append(descriptor)

	return (active_voting_key_descriptors, inactive_voting_key_descriptors)


async def _get_network_time(resources_directory):
	api_endpoints = load_api_endpoints(resources_directory)

	log.info(_('general-connecting-to-node').format(endpoint=api_endpoints[0]))
	connector = SymbolConnector(api_endpoints[0])

	network_time = await connector.network_time()
	return network_time


async def _save_transaction(transaction_config, directories, transaction_builder):
	network_time = await _get_network_time(directories.resources)
	aggregate_transaction, transaction_hash = transaction_builder.build(
		network_time.add_hours(transaction_config.timeout_hours),
		transaction_config.fee_multiplier,
		transaction_config.min_cosignatures_count)

	log.info(_('general-created-aggregate-transaction').format(transaction_hash=transaction_hash))

	write_transaction_to_file(aggregate_transaction, directories.output_directory / 'renew_voting_keys_transaction.dat')


def _clean_up_voting_keys_files(voting_keys_directory, inactive_voting_key_descriptors):
	def _get_voting_keys_filepath(ordinal):
		return voting_keys_directory / f'private_key_tree{ordinal}.dat'

	# remove inactive voting keys files
	for descriptor in inactive_voting_key_descriptors:
		expired_voting_keys_filepath = _get_voting_keys_filepath(descriptor.ordinal)
		log.info(_('renew-voting-keys-removing-expired-voting-keys').format(filepath=expired_voting_keys_filepath))
		expired_voting_keys_filepath.unlink()

	# renumber active voting keys files
	next_ordinal = 1
	for descriptor in inspect_voting_key_files(voting_keys_directory):
		shutil.move(_get_voting_keys_filepath(descriptor.ordinal), _get_voting_keys_filepath(next_ordinal))
		next_ordinal += 1


async def run_main(args):
	config = parse_shoestring_configuration(args.config)

	if NodeFeatures.VOTER not in config.node.features:
		log.error(_('renew-voting-keys-not-voting'))
		return

	directories = Preparer.DirectoryLocator(None, Path(args.directory))
	config_manager = ConfigurationManager(directories.resources)

	# detect the current finalized height and load the voting key files
	current_finalization_epoch = await get_current_finalization_epoch(config.services.nodewatch, config_manager)
	(active_voting_key_descriptors, inactive_voting_key_descriptors) = _load_voting_key_descriptors(
		directories.voting_keys,
		current_finalization_epoch)

	if not active_voting_key_descriptors:
		log.warning(_('renew-voting-keys-no-voting-keys-found'))

	max_voting_keys_per_account = int(config_manager.lookup('config-network.properties', [('chain', 'maxVotingKeysPerAccount')])[0])
	if len(active_voting_key_descriptors) - len(inactive_voting_key_descriptors) >= max_voting_keys_per_account:
		log.error(_('renew-voting-keys-maximum-already-registered'))
		return

	account_public_key = read_public_key_from_public_key_pem_file(directories.certificates / 'ca.pubkey.pem')
	transaction_builder = LinkTransactionBuilder(account_public_key, config.network)

	# remove expired root voting keys
	for descriptor in inactive_voting_key_descriptors:
		transaction_builder.unlink_voting_public_key(descriptor.public_key, descriptor.start_epoch, descriptor.end_epoch)

	# add new root voting key
	voter_configurator = VoterConfigurator(config_manager)
	new_voting_key_file_epoch_range = voter_configurator.generate_voting_key_file(directories.voting_keys, current_finalization_epoch)
	transaction_builder.link_voting_public_key(voter_configurator.voting_key_pair.public_key, *new_voting_key_file_epoch_range)

	# generate transaction
	await _save_transaction(config.transaction, directories, transaction_builder)

	# clean up voting keys files
	_clean_up_voting_keys_files(directories.voting_keys, inactive_voting_key_descriptors)


def add_arguments(parser):
	parser.add_argument('--config', help=_('argument-help-config'), required=True)
	parser.add_argument('--directory', help=_('argument-help-directory').format(default_path=Path.home()), default=str(Path.home()))
	parser.set_defaults(func=run_main)
