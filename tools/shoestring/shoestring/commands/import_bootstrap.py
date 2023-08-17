import sys
from pathlib import Path

from zenlog import log

from shoestring.internal.ConfigurationManager import ConfigurationManager


async def run_main(args):
	replacements = []

	bootstrap_node_path = Path(args.bootstrap) / 'nodes/node'
	if not bootstrap_node_path.exists():
		log.error(_('import-bootstrap-invalid-directory').format(directory=bootstrap_node_path))
		sys.exit(1)

	bootstrap_harvesting_properties = bootstrap_node_path / 'server-config/resources/config-harvesting.properties'
	if bootstrap_harvesting_properties.exists():
		log.info(_('import-bootstrap-importing-harvester').format(path=bootstrap_harvesting_properties))
		replacements.append(('imports', 'harvester', str(bootstrap_harvesting_properties)))

	bootstrap_voting_keys_directory = bootstrap_node_path / 'votingkeys'
	if bootstrap_voting_keys_directory.exists():
		log.info(_('import-bootstrap-importing-voter').format(path=bootstrap_voting_keys_directory))
		replacements.append(('imports', 'voter', str(bootstrap_voting_keys_directory)))

	if replacements:
		config_filepath = Path(args.config)
		ConfigurationManager(config_filepath.parent).patch(config_filepath.name, replacements)


def add_arguments(parser):
	parser.add_argument('--config', help=_('argument-help-config'), required=True)
	parser.add_argument('--bootstrap', help=_('argument-help-import-bootstrap-bootstrap'), required=True)
	parser.set_defaults(func=run_main)
