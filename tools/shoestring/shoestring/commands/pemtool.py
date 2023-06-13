import getpass
from binascii import unhexlify
from pathlib import Path

from symbolchain.CryptoTypes import PrivateKey
from symbolchain.PrivateKeyStorage import PrivateKeyStorage
from zenlog import log


def _get_private_key(filename):
	if not filename:
		private_key = getpass.getpass(_('pemtool-enter-private-key'))
	else:
		with open(filename, 'rt', encoding='utf8') as infile:
			private_key = infile.read()

	return private_key.strip()


def run_main(args):
	output_name = args.output
	if output_name.endswith('.pem'):
		output_name = output_name[:-4]

	filepath = Path(output_name + '.pem')
	if filepath.exists() and not args.force:
		raise FileExistsError(_('pemtool-error-output-file-already-exists').format(filepath=filepath))

	private_key = PrivateKey(unhexlify(_get_private_key(args.input)))

	password = None
	if args.ask_pass:
		password = getpass.getpass(f'Provide {filepath} password: ')
		confirmation = getpass.getpass(f'Confirm {filepath} password: ')
		if confirmation != password:
			raise RuntimeError(_('pemtool-error-password-mismatch'))

		if len(password) < 4 or len(password) > 1023:
			raise RuntimeError(_('pemtool-error-password-length'))

	storage = PrivateKeyStorage('.', password)
	storage.save(output_name, private_key)
	log.info(_('pemtool-saved-pem-file').format(filepath=filepath))


def add_arguments(parser):
	parser.add_argument('--output', help=_('argument-help-pemtool-output'), required=True)
	parser.add_argument('--input', help=_('argument-help-pemtool-input'))
	parser.add_argument('--ask-pass', help=_('argument-help-pemtool-ask-pass'), action='store_true')
	parser.add_argument('--force', help=_('argument-help-pemtool-force'), action='store_true')
	parser.set_defaults(func=run_main)
