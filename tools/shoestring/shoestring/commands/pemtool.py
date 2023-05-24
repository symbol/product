import getpass
from binascii import unhexlify
from pathlib import Path

from symbolchain.CryptoTypes import PrivateKey
from symbolchain.PrivateKeyStorage import PrivateKeyStorage


def _get_private_key(filename):
	if not filename:
		private_key = getpass.getpass('Enter private key (in hex): ')
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
		raise FileExistsError(f'output file ({filepath}) already exists, use --force to overwrite')

	private_key = PrivateKey(unhexlify(_get_private_key(args.input)))

	password = None
	if args.ask_pass:
		password = getpass.getpass(f'Provide {filepath} password: ')
		confirmation = getpass.getpass(f'Confirm {filepath} password: ')
		if confirmation != password:
			raise RuntimeError('Provided passwords do not match')

		if len(password) < 4 or len(password) > 1023:
			raise RuntimeError('Password must be between 4 and 1023 characters')

	storage = PrivateKeyStorage('.', password)
	storage.save(output_name, private_key)
	print(f'saved {filepath}')


def add_arguments(parser):
	parser.add_argument('--output', help='output PEM key file', required=True)
	parser.add_argument('--input', help='input private key file (optional)')
	parser.add_argument('--ask-pass', help='encrypt PEM with a password (password prompt will be shown)', action='store_true')
	parser.add_argument('--force', help='overwrite output file if it already exists', action='store_true')
	parser.set_defaults(func=run_main)
