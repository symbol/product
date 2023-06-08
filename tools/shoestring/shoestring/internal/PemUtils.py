import os

from cryptography.hazmat.primitives import serialization
from symbolchain.CryptoTypes import PrivateKey, PublicKey

from .OpensslExecutor import OpensslExecutor


def read_public_key_from_public_key_pem_file(filepath):  # pylint: disable=invalid-name
	"""Reads a public key from a public key pem file."""

	with open(filepath, 'rb') as infile:
		wrapped_public_key = serialization.load_pem_public_key(infile.read())
		public_key_bytes = wrapped_public_key.public_bytes(
			encoding=serialization.Encoding.Raw,
			format=serialization.PublicFormat.Raw)
		return PublicKey(public_key_bytes)


def _parse_stdout_key(lines, start_section_name, end_section_name):
	is_key_line = False
	raw_key_str = ''
	for line in lines:
		if line.startswith(f'{start_section_name}:'):
			is_key_line = True
		elif line.startswith(f'{end_section_name}:'):
			break
		elif is_key_line:
			raw_key_str += line

	return ''.join([ch.upper() for ch in raw_key_str if '0' <= ch <= '9' or 'a' <= ch <= 'f'])


def _dispatch_openssl(filepath, password, text_option_name):
	# use OpensslExecutor instead of cryptography API to support all openssl password input formats automatically
	openssl_executor = OpensslExecutor(os.environ.get('OPENSSL_EXECUTABLE', 'openssl'))
	return openssl_executor.dispatch([
		'pkey',
		'-in', filepath,
		'-noout',
		f'-{text_option_name}'
	] + ([] if not password else ['-passin', password]), show_output=False)


def read_private_key_from_private_key_pem_file(filepath, password=None):  # pylint: disable=invalid-name
	"""Reads a private key from a private key pem file."""

	if not password:
		with open(filepath, 'rb') as infile:
			wrapped_private_key = serialization.load_pem_private_key(infile.read(), password=None)
			private_key_bytes = wrapped_private_key.private_bytes(
				encoding=serialization.Encoding.Raw,
				format=serialization.PrivateFormat.Raw,
				encryption_algorithm=serialization.NoEncryption())
			return PrivateKey(private_key_bytes)

	lines = _dispatch_openssl(filepath, password, 'text')
	return PrivateKey(_parse_stdout_key(lines, 'priv', 'pub'))


def read_public_key_from_private_key_pem_file(filepath, password=None):  # pylint: disable=invalid-name
	"""Reads a public key from a private key pem file."""

	lines = _dispatch_openssl(filepath, password, 'text_pub')
	return PublicKey(_parse_stdout_key(lines, 'pub', '<eof>'))
