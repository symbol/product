import os
from pathlib import Path

from shoestring.internal.CertificateFactory import CertificateFactory
from shoestring.internal.NodeKeyUtils import write_node_key_file
from shoestring.internal.OpensslExecutor import OpensslExecutor
from shoestring.internal.Preparer import Preparer
from shoestring.internal.ShoestringConfiguration import parse_shoestring_configuration


async def run_main(args):
	config = parse_shoestring_configuration(args.config)
	directories = Preparer.DirectoryLocator(None, Path(args.directory))

	ca_key_path = Path(args.ca_key_path).absolute()
	if not ca_key_path.exists():
		raise RuntimeError(f'CA key is required but does not exist at path {ca_key_path}')

	openssl_executor = OpensslExecutor(os.environ.get('OPENSSL_EXECUTABLE', 'openssl'))
	with CertificateFactory(openssl_executor, ca_key_path, config.node.ca_password) as factory:
		if args.renew_ca:
			factory.generate_ca_certificate(config.node.ca_common_name)
		else:  # health node full certificate check needs current ca cert to pass
			factory.reuse_ca_certificate(config.node.ca_common_name, directories.certificates)

		write_node_key_file(factory, directories.certificates / 'node.key.pem' if args.retain_node_key else None)
		factory.generate_node_certificate(config.node.node_common_name)
		factory.create_node_certificate_chain()

		factory.package(directories.certificates, '' if args.renew_ca else 'node')


def add_arguments(parser):
	parser.add_argument('--config', help=_('argument-help-config'), required=True)
	parser.add_argument('--directory', help=_('argument-help-directory').format(default_path=Path.home()), default=str(Path.home()))
	parser.add_argument('--ca-key-path', help=_('argument-help-ca-key-path'), required=True)
	parser.add_argument('--renew-ca', help=_('argument-help-renew-certificates-renew-ca'), action='store_true')
	parser.add_argument('--retain-node-key', help=_('argument-help-renew-certificates-retain-node-key'), action='store_true')
	parser.set_defaults(func=run_main)
