import tempfile
import unittest
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ed25519
from symbolchain.CryptoTypes import PrivateKey
from symbolchain.symbol.KeyPair import KeyPair

from shoestring.internal.PemUtils import read_public_key_from_public_key_pem_file


class PemUtilsTest(unittest.TestCase):
	def test_can_read_public_key_from_public_key_pem_file(self):
		# Arrange:
		key_pair = KeyPair(PrivateKey.random())
		wrapped_public_key = ed25519.Ed25519PublicKey.from_public_bytes(key_pair.public_key.bytes)

		with tempfile.TemporaryDirectory() as directory:
			pem_filepath = Path(directory) / 'foo.pem'
			with open(pem_filepath, 'wb') as outfile:
				outfile.write(wrapped_public_key.public_bytes(
					encoding=serialization.Encoding.PEM,
					format=serialization.PublicFormat.SubjectPublicKeyInfo))

			# Act:
			public_key = read_public_key_from_public_key_pem_file(pem_filepath)

			# Assert:
			self.assertEqual(key_pair.public_key, public_key)
