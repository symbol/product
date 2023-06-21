import shutil
import tempfile
from pathlib import Path

from zenlog import log

from shoestring.internal.PackageResolver import download_and_extract_package


async def run_main(args):
	with tempfile.TemporaryDirectory() as temp_directory:
		await download_and_extract_package(args.package, Path(temp_directory))

		for path in Path(temp_directory).iterdir():
			if path.name.endswith('.shoestring.ini'):
				log.info(_('general-copying-file').format(source_path=path, destination_path=args.config))
				shutil.copy(path, args.config)
				return


def add_arguments(parser):
	parser.add_argument('--package', help=_('argument-help-setup-package'), default='mainnet')
	parser.add_argument('config', help=_('argument-help-config'))
	parser.set_defaults(func=run_main)
