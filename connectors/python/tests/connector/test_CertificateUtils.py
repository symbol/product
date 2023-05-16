import unittest

from symbolchain.CryptoTypes import PrivateKey
from symbolchain.symbol.KeyPair import KeyPair

from symbolconnectors.bindings.openssl import ffi, lib
from symbolconnectors.connector.CertificateUtils import try_parse_certificate, verify_self_signed

from ..test.CertificateTestUtils import CertificateBuilder, generate_certificate_private_key, generate_random_certificate_private_key


class CertificateUtilsTest(unittest.TestCase):
	# region try_parse_certificate

	def test_try_parse_certificate_can_parse_certificate_with_subject_and_public_key(self):
		# Arrange:
		key_pair = KeyPair(PrivateKey.random())
		builder = CertificateBuilder()
		builder.set_subject('JP', 'NEM', 'Alice')
		builder.set_public_key(generate_certificate_private_key(key_pair.private_key))
		certificate = builder.build()

		# Act:
		certificate_info = try_parse_certificate(certificate)

		# Assert:
		self.assertEqual('CN=Alice,O=NEM,C=JP', certificate_info.subject)
		self.assertEqual(key_pair.public_key, certificate_info.public_key)

	def test_try_parse_certificate_can_parse_certificate_with_subject_with_control_characters_and_public_key(self):
		# Arrange:
		key_pair = KeyPair(PrivateKey.random())
		builder = CertificateBuilder()
		builder.set_subject('JP', 'NEM', 'Al\1ce')
		builder.set_public_key(generate_certificate_private_key(key_pair.private_key))
		certificate = builder.build()

		# Act:
		certificate_info = try_parse_certificate(certificate)

		# Assert:
		self.assertEqual('CN=Al\\01ce,O=NEM,C=JP', certificate_info.subject)
		self.assertEqual(key_pair.public_key, certificate_info.public_key)

	def test_try_parse_certificate_can_parse_certificate_without_subject(self):
		# Arrange:
		key_pair = KeyPair(PrivateKey.random())
		builder = CertificateBuilder()
		builder.set_public_key(generate_certificate_private_key(key_pair.private_key))
		certificate = builder.build()

		# Act:
		certificate_info = try_parse_certificate(certificate)

		# Assert:
		self.assertEqual('', certificate_info.subject)
		self.assertEqual(key_pair.public_key, certificate_info.public_key)

	def test_try_parse_certificate_can_parse_certificate_with_long_subject(self):
		# Arrange:
		key_pair = KeyPair(PrivateKey.random())
		builder = CertificateBuilder()
		builder.set_subject('JP', 'b' * 64, 'c' * 64)
		builder.set_subject('CA', 'e' * 64, 'f' * 64)
		builder.set_public_key(generate_certificate_private_key(key_pair.private_key))
		certificate = builder.build()

		# Act:
		certificate_info = try_parse_certificate(certificate)

		# Assert:
		self.assertEqual(f'CN={"f" * 64},O={"e" * 64},C=CA,CN={"c" * 64},O={"b" * 64},C=JP', certificate_info.subject)
		self.assertEqual(key_pair.public_key, certificate_info.public_key)

	def test_try_parse_certificate_cannot_parse_certificate_without_public_key(self):
		# Arrange:
		builder = CertificateBuilder()
		builder.set_subject('JP', 'NEM', 'Alice')
		certificate = builder.build()

		# Act:
		certificate_info = try_parse_certificate(certificate)

		# Assert:
		self.assertEqual(None, certificate_info)

	@staticmethod
	def _generate_certificate_private_key_wrong_type(private_key):
		default_engine = ffi.cast('ENGINE *', 0)
		certificate_private_key = lib.EVP_PKEY_new_raw_private_key(lib.EVP_PKEY_X25519, default_engine, private_key.bytes, len(private_key.bytes))
		return ffi.gc(certificate_private_key, lib.EVP_PKEY_free)

	def test_try_parse_certificate_cannot_parse_certificate_with_wrong_public_key_type(self):
		# Arrange:
		key_pair = KeyPair(PrivateKey.random())
		builder = CertificateBuilder()
		builder.set_subject('JP', 'NEM', 'Alice')
		builder.set_public_key(self._generate_certificate_private_key_wrong_type(key_pair.private_key))
		certificate = builder.build()

		# Act:
		certificate_info = try_parse_certificate(certificate)

		# Assert:
		self.assertEqual(None, certificate_info)

	# endregion

	# region verify_self_signed

	def test_verify_self_signed_returns_true_for_properly_signed_certificate(self):
		# Arrange:
		builder = CertificateBuilder()
		builder.set_subject('JP', 'NEM', 'Alice')
		builder.set_issuer('JP', 'NEM', 'Alice')
		builder.set_public_key(generate_random_certificate_private_key())
		certificate = builder.build_and_sign()

		# Act:
		is_verified = verify_self_signed(certificate)

		# Assert:
		self.assertTrue(is_verified)

	def test_verify_self_signed_returns_false_for_unsigned_certificate(self):
		# Arrange:
		builder = CertificateBuilder()
		builder.set_subject('JP', 'NEM', 'Alice')
		builder.set_issuer('JP', 'NEM', 'Alice')
		builder.set_public_key(generate_random_certificate_private_key())
		certificate = builder.build()

		# Act:
		is_verified = verify_self_signed(certificate)

		# Assert:
		self.assertFalse(is_verified)

	def test_verify_self_signed_returns_false_for_certificate_with_wrong_issuer(self):
		# Arrange:
		builder = CertificateBuilder()
		builder.set_subject('JP', 'NEM', 'Alice')
		builder.set_issuer('JP', 'NEM', 'Bob')
		builder.set_public_key(generate_random_certificate_private_key())
		certificate = builder.build_and_sign()

		# Act:
		is_verified = verify_self_signed(certificate)

		# Assert:
		self.assertFalse(is_verified)

	def test_verify_self_signed_returns_false_for_certificate_with_external_signer(self):
		# Arrange:
		builder = CertificateBuilder()
		builder.set_subject('JP', 'NEM', 'Alice')
		builder.set_issuer('JP', 'NEM', 'Alice')
		builder.set_public_key(generate_random_certificate_private_key())
		builder.certificate_private_key = generate_random_certificate_private_key()  # change key used to sign certificate
		certificate = builder.build_and_sign()

		# Act:
		is_verified = verify_self_signed(certificate)

		# Assert:
		self.assertFalse(is_verified)

	# endregion
