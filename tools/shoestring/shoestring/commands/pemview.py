import getpass
from pathlib import Path

from symbolchain.Network import NetworkLocator
from symbolchain.PrivateKeyStorage import PrivateKeyStorage
from symbolchain.symbol.KeyPair import KeyPair
from symbolchain.symbol.Network import Network
from zenlog import log


def run_main(args):
	filepath = Path(args.input)
	if '.pem' != filepath.suffix:
		raise ValueError(_('pemview-error-input-file-unexpected-suffix').format(filepath=filepath))

	if not filepath.exists():
		raise FileNotFoundError(_('pemview-error-input-file-does-not-exist').format(filepath=filepath))

	password = None
	if args.ask_pass:
		password = getpass.getpass(f'Provide {filepath} password: ')

	storage = PrivateKeyStorage(filepath.parent, password)
	private_key = storage.load(filepath.stem)

	log.info(_('pemview-loaded-pem-file').format(filepath=filepath))

	key_pair = KeyPair(private_key)
	network = NetworkLocator.find_by_name(Network.NETWORKS, args.network)
	address = network.public_key_to_address(key_pair.public_key)

	log.info(_('pemview-show-address').format(address=address))
	log.info(_('pemview-show-public-key').format(public_key=key_pair.public_key))

	if args.show_private:
		log.info(_('pemview-show-private-key').format(private_key=key_pair.private_key))


def add_arguments(parser):
	parser.add_argument('--input', help=_('argument-help-pemview-input'), required=True)
	parser.add_argument('--network', help=_('argument-help-pemview-network'), required=True)
	parser.add_argument('--ask-pass', help=_('argument-help-pemview-ask-pass'), action='store_true')
	parser.add_argument('--show-private', help=_('argument-help-pemview-show-private'), action='store_true')
	parser.set_defaults(func=run_main)
