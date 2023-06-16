import re
import shutil
from collections import namedtuple
from pathlib import Path

from symbolchain.BufferReader import BufferReader
from symbolchain.CryptoTypes import PrivateKey, PublicKey
from symbolchain.symbol.KeyPair import KeyPair
from symbolchain.symbol.VotingKeysGenerator import VotingKeysGenerator
from zenlog import log

VotingFileDescriptor = namedtuple('VotingFileDescriptor', ['ordinal', 'public_key', 'start_epoch', 'end_epoch'])
EpochRange = namedtuple('EpochRange', ['start_epoch', 'end_epoch'])


class VoterConfigurator:
	"""Configures a voter."""

	def __init__(self, config_manager, import_source=None):
		"""Creates a voter configurator."""

		self.config_manager = config_manager
		self.is_imported = bool(import_source)
		self._import_source = Path(import_source) if import_source else None

		if not self.is_imported:
			self.voting_key_pair = KeyPair(PrivateKey.random())
		else:
			# when importing, each file should have its own key pair
			# since the voting keys don't need to be reregistered later, the keys don't need to be extracted
			self.voting_key_pair = None

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

	def generate_voting_key_file(self, directory, current_finalization_epoch, grace_period_epochs=1):
		"""Generates a voting key file."""

		if self.is_imported:
			for source_filepath in Path(self._import_source).glob('private_key_tree*.dat'):
				log.info(_('general-copying-file').format(source_path=source_filepath, destination_path=directory))
				shutil.copy(source_filepath, directory)
				(directory / source_filepath.name).chmod(0o600)

			# when importing, each file should have its own epoch range
			# since the voting keys don't need to be reregistered later, the ranges don't need to be extracted
			return None

		max_voting_key_lifetime = int(self.config_manager.lookup('config-network.properties', [('chain', 'maxVotingKeyLifetime')])[0])

		descriptors = inspect_voting_key_files(directory)
		if descriptors:
			ordinal = descriptors[-1].ordinal + 1
			start_epoch = descriptors[-1].end_epoch + 1
		else:
			# voting has not been previously configured, so give at least one full epoch to set up
			ordinal = 1
			start_epoch = current_finalization_epoch + 1 + grace_period_epochs

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
			reader = BufferReader(infile.read(64))
			start_epoch = reader.read_int(8)
			end_epoch = reader.read_int(8)
			reader.read_int(8)  # skip
			reader.read_int(8)  # skip
			public_key = PublicKey(reader.read_bytes(32))

			descriptors.append(VotingFileDescriptor(int(match.group(1)), public_key, start_epoch, end_epoch))

	descriptors.sort(key=lambda descriptor: descriptor.ordinal)
	return descriptors
