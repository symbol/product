import shutil
import tempfile
from pathlib import Path

from zenlog import log

from shoestring.internal.PackageResolver import download_and_extract_package


async def run_main(args):
	with tempfile.TemporaryDirectory() as temp_directory:
		await download_and_extract_package(args.package, Path(temp_directory))

		template_filepath = Path(temp_directory) / 'shoestring.ini'
		log.info(_('general-copying-file').format(source_path=template_filepath, destination_path=args.config))
		shutil.copy(template_filepath, args.config)


def add_arguments(parser):
	parser.add_argument('--package', help=_('argument-help-setup-package'), default='mainnet')
	parser.add_argument('config', help=_('argument-help-config'))
	parser.set_defaults(func=run_main)
