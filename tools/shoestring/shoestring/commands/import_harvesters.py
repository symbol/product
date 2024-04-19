import sys
from functools import partial
from pathlib import Path

from symbolchain.CryptoTypes import PrivateKey, PublicKey
from symbolchain.impl.CipherHelpers import decode_aes_gcm, encode_aes_gcm
from symbolchain.symbol.KeyPair import KeyPair
from symbolchain.symbol.SharedKey import SharedKey
from zenlog import log

from shoestring.internal.PemUtils import read_private_key_from_private_key_pem_file
from shoestring.internal.ShoestringConfiguration import parse_shoestring_configuration

HARVESTER_ENTRY_PAYLOAD_SIZE = sum([
	PublicKey.SIZE,       # ephemeral public key
	16,                   # aes gcm tag
	12,                   # aes gcm initialization vector
	2 * PrivateKey.SIZE,  # encrypted harvester signing private key | encrypted harvester vrf private key
])


def _private_key_to_address(network, private_key):
	public_key = KeyPair(private_key).public_key
	address = network.public_key_to_address(public_key)
	return address


def _visit_harvesters(harvesters_filepath, encryption_key_pair, visit):
	with open(harvesters_filepath, 'rb') as infile:
		for harvester_entry_payload in iter(partial(infile.read, HARVESTER_ENTRY_PAYLOAD_SIZE), b''):
			ephemeral_public_key = PublicKey(harvester_entry_payload[:PublicKey.SIZE])
			encrypted_payload = harvester_entry_payload[PublicKey.SIZE:]

			decrypted_payload = decode_aes_gcm(SharedKey, encryption_key_pair, ephemeral_public_key, encrypted_payload)

			signing_private_key = PrivateKey(decrypted_payload[:PrivateKey.SIZE])
			vrf_private_key = PrivateKey(decrypted_payload[PrivateKey.SIZE:])

			visit(signing_private_key, vrf_private_key)


def print_all_harvester_addresses(network, harvesters_filepath, key_pair):
	class ConsolePrinter:
		def __init__(self):
			self.identifier = 1

		def print(self, signing_private_key, _vrf_private_key):
			log.info(_private_key_to_address(network, signing_private_key))

			self.identifier += 1

	log.info(_('import-harvesters-list-header').format(filepath=harvesters_filepath, public_key=key_pair.public_key))

	printer = ConsolePrinter()
	_visit_harvesters(harvesters_filepath, key_pair, printer.print)


class HarvesterEncrypter:
	def __init__(self, encryption_public_key, outfile):
		self.encryption_public_key = encryption_public_key
		self.outfile = outfile

	def append(self, signing_private_key, vrf_private_key):
		payload = signing_private_key.bytes + vrf_private_key.bytes
		ephemeral_key_pair = KeyPair(PrivateKey.random())
		(tag, initialization_vector, encrypted_payload) = encode_aes_gcm(SharedKey, ephemeral_key_pair, self.encryption_public_key, payload)
		self.outfile.write(ephemeral_key_pair.public_key.bytes)
		self.outfile.write(tag)
		self.outfile.write(initialization_vector)
		self.outfile.write(encrypted_payload)


def run_main(args):
	if args.in_harvesters == args.out_harvesters:
		log.error(_('import-harvesters-error-in-harvesters-is-equal-to-out-harvesters'))
		sys.exit(1)

	config = parse_shoestring_configuration(args.config)

	in_harvesters_key_pair = KeyPair(read_private_key_from_private_key_pem_file(args.in_pem))
	print_all_harvester_addresses(config.network, args.in_harvesters, in_harvesters_key_pair)

	if not args.out_harvesters:
		return

	out_harvesters_filepath = Path(args.out_harvesters)
	with open(out_harvesters_filepath, 'wb') as outfile:
		out_harvesters_key_pair = KeyPair(read_private_key_from_private_key_pem_file(args.out_pem))
		encrypter = HarvesterEncrypter(out_harvesters_key_pair.public_key, outfile)
		_visit_harvesters(args.in_harvesters, in_harvesters_key_pair, encrypter.append)

	out_harvesters_filepath.chmod(0o600)
	print_all_harvester_addresses(config.network, out_harvesters_filepath, out_harvesters_key_pair)


def add_arguments(parser):
	parser.add_argument('--config', help=_('argument-help-config'), required=True)
	parser.add_argument('--in-harvesters', help=_('argument-help-import-harvesters-in-harvesters'), required=True)
	parser.add_argument('--in-pem', help=_('argument-help-import-harvesters-in-pem'), required=True)

	parser.add_argument('--out-harvesters', help=_('argument-help-import-harvesters-out-harvesters'))
	parser.add_argument('--out-pem', help=_('argument-help-import-harvesters-out-pem'))

	parser.set_defaults(func=run_main)
