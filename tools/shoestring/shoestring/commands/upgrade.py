import shutil
from pathlib import Path

from zenlog import log

from shoestring.internal.ConfigurationManager import ConfigurationManager
from shoestring.internal.NodeFeatures import NodeFeatures
from shoestring.internal.Preparer import Preparer
from shoestring.internal.ShoestringConfiguration import parse_shoestring_configuration

from .setup import add_arguments as add_setup_arguments
from .setup import run_main as run_setup_main


def _purge_directory(directory):
	log.info(f'purging DIRECTORY {directory}')
	shutil.rmtree(directory)


def _recreate_directory(directory):
	log.info(f'recreating DIRECTORY {directory}')
	directory.mkdir(mode=0o700, exist_ok=False)


def _load_harvester_configuration_patches(config_manager):
	config_keys = [
		('harvesting', 'harvesterSigningPrivateKey'),
		('harvesting', 'harvesterVrfPrivateKey')
	]
	values = config_manager.lookup('config-harvesting.properties', config_keys)
	return [(*tuple[0], tuple[1]) for tuple in zip(config_keys, values)]


async def run_main(args):
	config = parse_shoestring_configuration(args.config)
	directories = Preparer.DirectoryLocator(None, Path(args.directory))

	config_manager = ConfigurationManager(directories.resources)
	if NodeFeatures.HARVESTER in config.node.features:
		harvester_config_patches = _load_harvester_configuration_patches(config_manager)

	(directories.output_directory / 'docker-compose.yaml').unlink()

	_purge_directory(directories.userconfig)
	_recreate_directory(directories.userconfig)
	_recreate_directory(directories.resources)

	if NodeFeatures.API in config.node.features:
		_purge_directory(directories.startup)
		_purge_directory(directories.mongo)

		if config.node.api_https:
			(directories.https_proxy / 'nginx.conf.erb').unlink()

	await run_setup_main(args)

	if NodeFeatures.HARVESTER in config.node.features:
		harvesting_properties_filepath = directories.resources / 'config-harvesting.properties'
		harvesting_properties_filepath.chmod(0o600)
		config_manager.patch(harvesting_properties_filepath, harvester_config_patches)
		harvesting_properties_filepath.chmod(0o400)


def add_arguments(parser):
	add_setup_arguments(parser, False)
	parser.set_defaults(func=run_main)
