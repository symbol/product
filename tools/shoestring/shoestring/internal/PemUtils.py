from cryptography.hazmat.primitives import serialization
from symbolchain.CryptoTypes import PrivateKey, PublicKey


def read_public_key_from_public_key_pem_file(filepath):  # pylint: disable=invalid-name
	"""Reads a public key from a public key pem file."""

	with open(filepath, 'rb') as infile:
		wrapped_public_key = serialization.load_pem_public_key(infile.read())
		public_key_bytes = wrapped_public_key.public_bytes(
			encoding=serialization.Encoding.Raw,
			format=serialization.PublicFormat.Raw)
		return PublicKey(public_key_bytes)


def read_private_key_from_private_key_pem_file(filepath):  # pylint: disable=invalid-name
	"""Reads a private key from a private key pem file."""

	with open(filepath, 'rb') as infile:
		wrapped_private_key = serialization.load_pem_private_key(infile.read(), password=None)
		private_key_bytes = wrapped_private_key.private_bytes(
			encoding=serialization.Encoding.Raw,
			format=serialization.PrivateFormat.Raw,
			encryption_algorithm=serialization.NoEncryption())
		return PrivateKey(private_key_bytes)
