import tempfile
import unittest
from pathlib import Path

from symbolchain.BufferReader import BufferReader
from symbolchain.BufferWriter import BufferWriter
from symbolchain.CryptoTypes import PrivateKey, PublicKey

from shoestring.internal.ConfigurationManager import ConfigurationManager
from shoestring.internal.VoterConfigurator import VoterConfigurator, inspect_voting_key_files


class VoterConfiguratorTest(unittest.TestCase):
	# region utils

	@staticmethod
	def _write_voting_key_file_header(directory, filename, start_epoch, end_epoch):
		writer = BufferWriter()
		writer.write_int(start_epoch, 8)
		writer.write_int(end_epoch, 8)
		writer.write_int(0, 8)
		writer.write_int(0, 8)

		public_key = PublicKey(PrivateKey.random().bytes)
		writer.write_bytes(public_key.bytes)

		with open(Path(directory) / filename, 'wb') as outfile:
			outfile.write(writer.buffer)

		return public_key

	# endregion

	# region VoterConfigurator

	def test_configurator_generates_random_key_pairs(self):
		# Act:
		configurator1 = VoterConfigurator(None)
		configurator2 = VoterConfigurator(None)

		# Assert:
		self.assertEqual(2, len(set([configurator1.voting_key_pair.public_key, configurator2.voting_key_pair.public_key])))

	def test_can_patch_configuration(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as temp_directory:
			with open(Path(temp_directory) / 'config-finalization.properties', 'wt', encoding='utf8') as outfile:
				outfile.write('\n'.join([
					'[finalization]',
					'enableVoting = aaa',
					'enableRevoteOnBoot = bbb',
					'unfinalizedBlocksDuration = ccc'
				]))

			with open(Path(temp_directory) / 'config-node.properties', 'wt', encoding='utf8') as outfile:
				outfile.write('\n'.join([
					'[localnode]',
					'host = yyy',
					'roles = zzz'
				]))

			# Act:
			config_manager = ConfigurationManager(temp_directory)
			configurator = VoterConfigurator(config_manager)
			configurator.patch_configuration()

			# Assert: all finalization values were updated
			updated_values = config_manager.lookup('config-finalization.properties', [
				('finalization', key) for key in ['enableVoting', 'enableRevoteOnBoot', 'unfinalizedBlocksDuration']
			])

			self.assertEqual(['true', 'bbb', '0m'], updated_values)

			# - all node values were updated
			updated_values = config_manager.lookup('config-node.properties', [
				('localnode', key) for key in ['host', 'roles']
			])

			self.assertEqual(['yyy', 'zzz,Voting'], updated_values)

	@staticmethod
	def _prepare_generate_voting_key_file_test(temp_directory):
		with open(Path(temp_directory) / 'config-network.properties', 'wt', encoding='utf8') as outfile:
			outfile.write('\n'.join([
				'[chain]',
				'votingSetGrouping = 123',
				'maxVotingKeyLifetime = 222'
			]))

			voting_key_file_directory = Path(temp_directory) / 'voting'
			voting_key_file_directory.mkdir()
			return voting_key_file_directory

	@staticmethod
	def _read_voting_key_file_header(voting_key_tree_file):
		with open(voting_key_tree_file, 'rb') as infile:
			reader = BufferReader(infile.read(64))
			start_epoch = reader.read_int(8)
			end_epoch = reader.read_int(8)
			reader.read_bytes(16)  # skip
			root_public_key = PublicKey(reader.read_bytes(32))
			return (start_epoch, end_epoch, root_public_key)

	def test_can_generate_voting_key_file_new(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as temp_directory:
			voting_key_file_directory = self._prepare_generate_voting_key_file_test(temp_directory)

			# Act:
			config_manager = ConfigurationManager(temp_directory)
			configurator = VoterConfigurator(config_manager)
			epoch_range = configurator.generate_voting_key_file(voting_key_file_directory, 5)

			# Assert: check voting files
			voting_files = list(path.name for path in voting_key_file_directory.iterdir())
			self.assertEqual(['private_key_tree1.dat'], voting_files)

			# - check new voting file contents
			new_voting_key_tree_file = voting_key_file_directory / 'private_key_tree1.dat'
			(start_epoch, end_epoch, root_public_key) = self._read_voting_key_file_header(new_voting_key_tree_file)
			self.assertEqual(5 + 1 + 1, start_epoch)
			self.assertEqual(5 + 1 + 1 + 221, end_epoch)
			self.assertEqual(configurator.voting_key_pair.public_key, root_public_key)
			self.assertEqual(0o600, new_voting_key_tree_file.stat().st_mode & 0o777)

			# - check return values:
			self.assertEqual(5 + 1 + 1, epoch_range.start_epoch)
			self.assertEqual(5 + 1 + 1 + 221, epoch_range.end_epoch)

	def test_can_generate_voting_key_file_new_with_custom_grace_period(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as temp_directory:
			voting_key_file_directory = self._prepare_generate_voting_key_file_test(temp_directory)

			# Act:
			config_manager = ConfigurationManager(temp_directory)
			configurator = VoterConfigurator(config_manager)
			epoch_range = configurator.generate_voting_key_file(voting_key_file_directory, 5, 7)

			# Assert: check voting files
			voting_files = list(path.name for path in voting_key_file_directory.iterdir())
			self.assertEqual(['private_key_tree1.dat'], voting_files)

			# - check new voting file contents
			new_voting_key_tree_file = voting_key_file_directory / 'private_key_tree1.dat'
			(start_epoch, end_epoch, root_public_key) = self._read_voting_key_file_header(new_voting_key_tree_file)
			self.assertEqual(5 + 1 + 7, start_epoch)
			self.assertEqual(5 + 1 + 7 + 221, end_epoch)
			self.assertEqual(configurator.voting_key_pair.public_key, root_public_key)
			self.assertEqual(0o600, new_voting_key_tree_file.stat().st_mode & 0o777)

			# - check return values:
			self.assertEqual(5 + 1 + 7, epoch_range.start_epoch)
			self.assertEqual(5 + 1 + 7 + 221, epoch_range.end_epoch)

	def test_can_generate_voting_key_file_continuation(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as temp_directory:
			voting_key_file_directory = self._prepare_generate_voting_key_file_test(temp_directory)

			self._write_voting_key_file_header(voting_key_file_directory, 'private_key_tree3.dat', 100, 199)
			self._write_voting_key_file_header(voting_key_file_directory, 'private_key_tree5.dat', 200, 299)
			self._write_voting_key_file_header(voting_key_file_directory, 'private_key_tree7.dat', 300, 399)

			# Act:
			config_manager = ConfigurationManager(temp_directory)
			configurator = VoterConfigurator(config_manager)
			epoch_range = configurator.generate_voting_key_file(voting_key_file_directory, 400)

			# Assert: check voting files
			voting_files = sorted(list(path.name for path in voting_key_file_directory.iterdir()))
			self.assertEqual([f'private_key_tree{i}.dat' for i in (3, 5, 7, 8)], voting_files)

			# - check new voting file contents
			new_voting_key_tree_file = voting_key_file_directory / 'private_key_tree8.dat'
			(start_epoch, end_epoch, root_public_key) = self._read_voting_key_file_header(new_voting_key_tree_file)
			self.assertEqual(400, start_epoch)
			self.assertEqual(400 + 221, end_epoch)
			self.assertEqual(configurator.voting_key_pair.public_key, root_public_key)
			self.assertEqual(0o600, new_voting_key_tree_file.stat().st_mode & 0o777)

			# - check return values:
			self.assertEqual(400, epoch_range.start_epoch)
			self.assertEqual(400 + 221, epoch_range.end_epoch)

	# endregion

	# region inspect_voting_key_files

	def test_inspect_voting_key_files_processes_all_voting_key_files(self):
		# Arrange:
		with tempfile.TemporaryDirectory() as temp_directory:
			public_key_1 = self._write_voting_key_file_header(temp_directory, 'private_key_tree3.dat', 100, 199)
			public_key_2 = self._write_voting_key_file_header(temp_directory, 'private_key_tree5.dat', 200, 299)
			public_key_3 = self._write_voting_key_file_header(temp_directory, 'private_key_tree7.dat', 300, 399)

			# - add file not matching name pattern that should be ignored
			self._write_voting_key_file_header(temp_directory, 'private_key_treex4.dat', 900, 1000)

			# Act:
			descriptors = inspect_voting_key_files(temp_directory)

			# Assert:
			self.assertEqual([3, 5, 7], [descriptor.ordinal for descriptor in descriptors])
			self.assertEqual([public_key_1, public_key_2, public_key_3], [descriptor.public_key for descriptor in descriptors])
			self.assertEqual([100, 200, 300], [descriptor.start_epoch for descriptor in descriptors])
			self.assertEqual([199, 299, 399], [descriptor.end_epoch for descriptor in descriptors])

	# endregion
