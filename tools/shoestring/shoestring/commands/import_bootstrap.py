import shutil
import sys
from pathlib import Path

from zenlog import log

from shoestring.internal.ConfigurationManager import ConfigurationManager


async def run_main(args):
	replacements = []
	config_filepath = Path(args.config).absolute()
	bootstrap_import_path = config_filepath.parent / 'bootstrap-import'
	bootstrap_import_path.mkdir(parents=True, exist_ok=True)

	bootstrap_node_path = Path(args.bootstrap) / 'nodes/node'
	if not bootstrap_node_path.exists():
		log.error(_('import-bootstrap-invalid-directory').format(directory=bootstrap_node_path))
		sys.exit(1)

	bootstrap_harvesting_properties = bootstrap_node_path / 'server-config/resources/config-harvesting.properties'
	if bootstrap_harvesting_properties.exists():
		log.info(_('import-bootstrap-importing-harvester').format(path=bootstrap_harvesting_properties))
		shutil.copy(bootstrap_harvesting_properties, bootstrap_import_path)
		replacements.append(('imports', 'harvester', str(bootstrap_import_path / bootstrap_harvesting_properties.name)))

	bootstrap_voting_keys_directory = bootstrap_node_path / 'votingkeys'
	if bootstrap_voting_keys_directory.exists():
		log.info(_('import-bootstrap-importing-voter').format(path=bootstrap_voting_keys_directory))
		config_votingkeys_path = bootstrap_import_path / 'votingkeys'
		shutil.copytree(bootstrap_voting_keys_directory, config_votingkeys_path)
		replacements.append(('imports', 'voter', str(config_votingkeys_path)))

	if args.include_node_key:
		bootstrap_node_key = bootstrap_node_path / 'cert/node.key.pem'
		if bootstrap_node_key.exists():
			log.info(_('import-bootstrap-importing-node-key').format(path=bootstrap_node_key))
			shutil.copy(bootstrap_node_key, bootstrap_import_path)
			replacements.append(('imports', 'nodeKey', str(bootstrap_import_path / bootstrap_node_key.name)))
		else:
			log.error(_('import-bootstrap-importing-node-key-not-found').format(path=bootstrap_node_key))
			sys.exit(1)

	if replacements:
		ConfigurationManager(config_filepath.parent).patch(config_filepath.name, replacements)


def add_arguments(parser):
	parser.add_argument('--config', help=_('argument-help-config'), required=True)
	parser.add_argument('--bootstrap', help=_('argument-help-import-bootstrap-bootstrap'), required=True)
	parser.add_argument('--include-node-key', help=_('argument-help-import-bootstrap-include-node-key'), action='store_true')
	parser.set_defaults(func=run_main)
