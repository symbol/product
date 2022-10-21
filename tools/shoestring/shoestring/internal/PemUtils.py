from cryptography.hazmat.primitives import serialization
from symbolchain.CryptoTypes import PublicKey


def read_public_key_from_public_key_pem_file(filepath):  # pylint: disable=invalid-name
	"""Reads a public key from a public key pem file."""

	with open(filepath, 'rb') as infile:
		wrapped_public_key = serialization.load_pem_public_key(infile.read())
		public_key_bytes = wrapped_public_key.public_bytes(
			encoding=serialization.Encoding.Raw,
			format=serialization.PublicFormat.Raw)
		return PublicKey(public_key_bytes)
