import re
from collections import namedtuple
from pathlib import Path

from symbolchain.BufferReader import BufferReader
from symbolchain.CryptoTypes import PrivateKey
from symbolchain.symbol.KeyPair import KeyPair
from symbolchain.symbol.VotingKeysGenerator import VotingKeysGenerator

from .HeightGrouping import calculate_finalization_epoch_for_height

VotingFileDescriptor = namedtuple('VotingFileDescriptor', ['ordinal', 'end_epoch'])
EpochRange = namedtuple('EpochRange', ['start_epoch', 'end_epoch'])


class VoterConfigurator:
	"""Configures a voter."""

	def __init__(self, config_manager):
		"""Creates a voter configurator."""

		self.config_manager = config_manager
		self.voting_key_pair = KeyPair(PrivateKey.random())

	def patch_configuration(self):
		"""Patches voting settings."""

		# update finalization properties
		self.config_manager.patch('config-finalization.properties', [
			('finalization', 'enableVoting', 'true'),
			('finalization', 'unfinalizedBlocksDuration', '0m')
		])

		# append "Voting" to current roles
		current_roles = self.config_manager.lookup('config-node.properties', [('localnode', 'roles')])[0]
		self.config_manager.patch('config-node.properties', [
			('localnode', 'roles', f'{current_roles},Voting')
		])

	def generate_voting_key_file(self, directory, last_finalized_height, grace_period_epochs=1):
		"""Generates a voting key file."""

		(voting_set_grouping, max_voting_key_lifetime) = (int(value) for value in self.config_manager.lookup('config-network.properties', [
			('chain', 'votingSetGrouping'), ('chain', 'maxVotingKeyLifetime')
		]))

		descriptors = inspect_voting_key_files(directory)
		if descriptors:
			ordinal = descriptors[-1].ordinal + 1
			start_epoch = descriptors[-1].end_epoch + 1
		else:
			# voting has not been previously configured, so give at least one full epoch to set up
			ordinal = 1
			start_epoch = calculate_finalization_epoch_for_height(last_finalized_height, voting_set_grouping) + 1 + grace_period_epochs

		end_epoch = start_epoch + max_voting_key_lifetime - 1

		voting_keys_generator = VotingKeysGenerator(self.voting_key_pair)
		voting_key_buffer = voting_keys_generator.generate(start_epoch, end_epoch)

		output_filepath = Path(directory) / f'private_key_tree{ordinal}.dat'
		with open(output_filepath, 'wb') as outfile:
			outfile.write(voting_key_buffer)

		output_filepath.chmod(0o600)

		return EpochRange(start_epoch, end_epoch)


def inspect_voting_key_files(directory):
	"""Inspects all voting key files in the specified directory."""

	voting_key_filename_regex = re.compile(r'private_key_tree(\d+)\.dat')
	descriptors = []
	for filepath in Path(directory).glob('private_key_tree*.dat'):
		match = voting_key_filename_regex.match(filepath.name)
		if not match:
			continue

		with open(filepath, 'rb') as infile:
			reader = BufferReader(infile.read(16))
			reader.read_int(8)
			end_epoch = reader.read_int(8)

			descriptors.append(VotingFileDescriptor(int(match.group(1)), end_epoch))

	descriptors.sort(key=lambda descriptor: descriptor.ordinal)
	return descriptors
