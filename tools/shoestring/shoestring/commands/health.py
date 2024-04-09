import importlib
import json
from pathlib import Path

from zenlog import log

from shoestring.internal.ConfigurationManager import ConfigurationManager
from shoestring.internal.Preparer import Preparer
from shoestring.internal.ShoestringConfiguration import parse_shoestring_configuration


class HealthAgentContext:
	"""Context passed to health agent validation routines."""

	def __init__(self, directories, config):
		"""Creates a new context."""

		self.directories = directories
		self.config = config
		self.config_manager = ConfigurationManager(self.directories.resources)

	@property
	def peer_endpoint(self):
		"""Peer endpoint."""

		host = self._load_hostname()
		port = int(self.config_manager.lookup('config-node.properties', [('node', 'port')])[0])
		return (host, port)

	@property
	def rest_endpoint(self):
		"""REST endpoint."""

		scheme = 'https' if self.config.node.api_https else 'http'
		hostname = self._load_hostname()
		port = self._load_rest_port()
		return f'{scheme}://{hostname}:{port}'

	@property
	def websocket_endpoint(self):
		"""Websocket endpoint."""

		scheme = 'wss' if self.config.node.api_https else 'ws'
		hostname = self._load_hostname()
		port = self._load_rest_port()
		return f'{scheme}://{hostname}:{port}/ws'

	def _load_hostname(self):
		host = self.config_manager.lookup('config-node.properties', [('localnode', 'host')])[0]
		return host or 'localhost'

	def _load_rest_port(self):
		if self.config.node.api_https:
			return 3001  # assume default HTTPS port

		with open(self.directories.userconfig / 'rest.json', 'rt', encoding='utf8') as infile:
			rest_json = json.loads(infile.read())
			return int(rest_json['port'])


async def run_main(args):
	config = parse_shoestring_configuration(args.config)
	context = HealthAgentContext(Preparer.DirectoryLocator(None, Path(args.directory)), config)

	for agent_name in ('peer_certificate', 'peer_api', 'voting_keys', 'rest_https_certificate', 'rest_api', 'websockets'):
		module = importlib.import_module(f'shoestring.healthagents.{agent_name}')

		if module.should_run(config.node):
			log.debug(_('health-running-health-agent').format(module_name=module.NAME))
			await module.validate(context)


def add_arguments(parser):
	parser.add_argument('--config', help=_('argument-help-config'), required=True)
	parser.add_argument('--directory', help=_('argument-help-directory').format(default_path=Path.home()), default=str(Path.home()))
	parser.set_defaults(func=run_main)
