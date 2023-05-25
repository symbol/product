import shutil
from pathlib import Path

from zenlog import log

from shoestring.internal.NodeFeatures import NodeFeatures
from shoestring.internal.ShoestringConfiguration import parse_shoestring_configuration


def _purge_and_recreate(directory):
	log.info(f'purging and recreating DIRECTORY {directory}')

	shutil.rmtree(directory)
	directory.mkdir()
	directory.chmod(0o700)


class VoterStateProcessor:
	def __init__(self, directory):
		self.data_directory = directory / 'data'
		self.backup_directory = directory / 'backup'
		self.max_epoch = None

	def backup(self):
		self.backup_directory.mkdir()
		self._copy_if(self.data_directory / 'voting_status.dat', self.backup_directory)

		self.max_epoch = self._detect_votes_backup_max_epoch()
		if self.max_epoch:
			self._copy_tree(self.data_directory / 'votes_backup' / str(self.max_epoch), self.backup_directory / 'votes')

	def restore(self):
		self._copy_if(self.backup_directory / 'voting_status.dat', self.data_directory)

		if self.max_epoch:
			shutil.copytree(self.backup_directory / 'votes', self.data_directory / 'votes_backup' / str(self.max_epoch))

		shutil.rmtree(self.backup_directory)

	def _detect_votes_backup_max_epoch(self):
		if not (self.data_directory / 'votes_backup').exists():
			return None

		epochs = [int(epoch.name) for epoch in (self.data_directory / 'votes_backup').iterdir() if epoch.is_dir()]
		return None if not epochs else max(epochs)

	@staticmethod
	def _copy_if(source_path, destination_path):
		if not source_path.exists():
			return

		log.info(f'copying FILE {source_path} into {destination_path}')
		shutil.copy(source_path, destination_path)

	@staticmethod
	def _copy_tree(source_path, destination_path):
		log.info(f'copying TREE {source_path} to {destination_path}')
		shutil.copytree(source_path, destination_path)


async def run_main(args):
	config = parse_shoestring_configuration(args.config)
	directory = Path(args.directory)

	voter_state_processor = VoterStateProcessor(directory)
	if NodeFeatures.VOTER in config.node.features:
		voter_state_processor.backup()

	for name in ('data', 'logs'):
		_purge_and_recreate(directory / name)

	if NodeFeatures.API in config.node.features:
		_purge_and_recreate(directory / 'dbdata')

	if NodeFeatures.VOTER in config.node.features:
		voter_state_processor.restore()


def add_arguments(parser):
	parser.add_argument('--config', help='path to shoestring configuration file', required=True)
	parser.add_argument('--directory', help=f'installation directory (default: {Path.home()})', default=str(Path.home()))
	parser.set_defaults(func=run_main)
