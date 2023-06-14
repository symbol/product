import shutil
from pathlib import Path

from zenlog import log

from shoestring.internal.NodeFeatures import NodeFeatures
from shoestring.internal.ShoestringConfiguration import parse_shoestring_configuration


def _purge_and_recreate(directory):
	log.info(_('reset-data-recreating-directory').format(directory=directory))

	shutil.rmtree(directory)
	directory.mkdir(mode=0o700, exist_ok=False)


class StatefulDataProcessor:
	def __init__(self, directory, data_files_to_keep):
		self.data_directory = directory / 'data'
		self.backup_directory = directory / 'backup'
		self.data_files_to_keep = ['voting_status.dat'] + data_files_to_keep
		self.max_epoch = None

	def backup(self):
		for filename in self.data_files_to_keep:
			self._copy_if(self.data_directory / filename, self.backup_directory)

		self.max_epoch = self._detect_votes_backup_max_epoch()
		if self.max_epoch:
			self._copy_tree(self.data_directory / 'votes_backup' / str(self.max_epoch), self.backup_directory / 'votes')

	def restore(self):
		for filename in self.data_files_to_keep:
			self._copy_if(self.backup_directory / filename, self.data_directory)

		if self.max_epoch:
			shutil.copytree(self.backup_directory / 'votes', self.data_directory / 'votes_backup' / str(self.max_epoch))

		if self.backup_directory.exists():
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

		if not destination_path.exists():
			destination_path.mkdir()

		log.info(_('general-copying-file').format(source_path=source_path, destination_path=destination_path))
		shutil.copy(source_path, destination_path)

	@staticmethod
	def _copy_tree(source_path, destination_path):
		log.info(_('general-copying-tree').format(source_path=source_path, destination_path=destination_path))
		shutil.copytree(source_path, destination_path)


async def run_main(args):
	config = parse_shoestring_configuration(args.config)
	directory = Path(args.directory)

	data_files_to_keep = []
	if not args.purge_harvesters:
		data_files_to_keep.append('harvesters.dat')

	stateful_data_processor = StatefulDataProcessor(directory, data_files_to_keep)
	stateful_data_processor.backup()

	for name in ('data', 'logs'):
		_purge_and_recreate(directory / name)

	if NodeFeatures.API in config.node.features:
		_purge_and_recreate(directory / 'dbdata')

	stateful_data_processor.restore()


def add_arguments(parser):
	parser.add_argument('--config', help=_('argument-help-config'), required=True)
	parser.add_argument('--directory', help=_('argument-help-directory').format(default_path=Path.home()), default=str(Path.home()))
	parser.add_argument('--purge-harvesters', help=_('argument-help-reset-data-purge-harvesters'), action='store_true')
	parser.set_defaults(func=run_main)
