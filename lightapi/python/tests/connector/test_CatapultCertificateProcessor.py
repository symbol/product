import unittest
from datetime import datetime, timedelta, timezone

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ed25519, rsa
from cryptography.x509.oid import NameOID
from symbolchain.CryptoTypes import PublicKey

from symbollightapi.connector.CatapultCertificateProcessor import CatapultCertificateProcessor

# region test utils


def create_name(common_name):
	return x509.Name([
		x509.NameAttribute(NameOID.COUNTRY_NAME, 'JP'),
		x509.NameAttribute(NameOID.ORGANIZATION_NAME, 'NEM'),
		x509.NameAttribute(NameOID.COMMON_NAME, common_name)
	])


def create_certificate(subject_name, issuer_name, subject_key, issuer_key):
	now = datetime.now(timezone.utc)
	builder = x509.CertificateBuilder()
	builder = builder.subject_name(subject_name)
	builder = builder.issuer_name(issuer_name)
	builder = builder.public_key(subject_key.public_key())
	builder = builder.serial_number(x509.random_serial_number())
	builder = builder.not_valid_before(now - timedelta(minutes=5))
	builder = builder.not_valid_after(now + timedelta(days=365))
	algorithm = None if isinstance(issuer_key, ed25519.Ed25519PrivateKey) else hashes.SHA256()
	return builder.sign(private_key=issuer_key, algorithm=algorithm)


def to_der(certificate):
	return certificate.public_bytes(serialization.Encoding.DER)


def create_default_certificate(common_name):
	private_key = ed25519.Ed25519PrivateKey.generate()
	name = create_name(common_name)
	return create_certificate(name, name, private_key, private_key)


def create_signed_chain(root_common_name='Alice', leaf_common_name='Bob', leaf_key=None, root_key=None):
	root_key = root_key or ed25519.Ed25519PrivateKey.generate()
	leaf_key = leaf_key or ed25519.Ed25519PrivateKey.generate()

	root_name = create_name(root_common_name)
	leaf_name = create_name(leaf_common_name)
	root = create_certificate(root_name, root_name, root_key, root_key)
	leaf = create_certificate(leaf_name, root_name, leaf_key, root_key)
	return [to_der(root), to_der(leaf)]

# endregion


class CatapultCertificateProcessorTest(unittest.TestCase):
	# region constructor

	def test_can_create_processor(self):
		# Act:
		processor = CatapultCertificateProcessor()

		# Assert:
		self.assertEqual(0, processor.size)

	# endregion

	# region verify_der_chain

	def test_can_add_two_certificates(self):
		# Arrange:
		chain_der = create_signed_chain('Alice', 'Bob')
		processor = CatapultCertificateProcessor()

		# Act:
		verify_result = processor.verify_der_chain(chain_der)

		# Assert:
		self.assertTrue(verify_result)
		self.assertEqual(2, processor.size)
		self.assertEqual('CN=Alice,O=NEM,C=JP', processor.certificate(0).subject)
		self.assertEqual('CN=Bob,O=NEM,C=JP', processor.certificate(1).subject)

	def test_cannot_add_chain_with_too_few_certificates(self):
		# Arrange:
		chain_der = [to_der(create_default_certificate('Alice'))]
		processor = CatapultCertificateProcessor()

		# Act:
		verify_result = processor.verify_der_chain(chain_der)

		# Assert:
		self.assertFalse(verify_result)
		self.assertEqual(0, processor.size)

	def test_cannot_add_chain_with_too_many_certificates(self):
		# Arrange:
		chain_der = [
			to_der(create_default_certificate('Alice')),
			to_der(create_default_certificate('Bob')),
			to_der(create_default_certificate('Charlie'))
		]
		processor = CatapultCertificateProcessor()

		# Act:
		verify_result = processor.verify_der_chain(chain_der)

		# Assert:
		self.assertFalse(verify_result)
		self.assertEqual(0, processor.size)

	def test_unparseable_certificate_takes_precedence_over_chain_status(self):
		# Arrange:
		chain_der = [b'not-a-certificate', to_der(create_default_certificate('Bob'))]
		processor = CatapultCertificateProcessor()

		# Act:
		verify_result = processor.verify_der_chain(chain_der)

		# Assert:
		self.assertFalse(verify_result)
		self.assertEqual(0, processor.size)

	def test_consecutive_certificates_with_same_public_key_are_not_collapsed(self):
		# Arrange:
		shared_key = ed25519.Ed25519PrivateKey.generate()
		chain_der = create_signed_chain('Alice', 'Bob', leaf_key=shared_key, root_key=shared_key)
		processor = CatapultCertificateProcessor()

		# Act:
		verify_result = processor.verify_der_chain(chain_der)

		# Assert:
		self.assertTrue(verify_result)
		self.assertEqual(2, processor.size)
		self.assertEqual('CN=Alice,O=NEM,C=JP', processor.certificate(0).subject)
		self.assertEqual('CN=Bob,O=NEM,C=JP', processor.certificate(1).subject)

	def test_consecutive_certificates_with_same_subject_are_not_collapsed(self):
		# Arrange:
		chain_der = create_signed_chain('Alice', 'Alice')
		processor = CatapultCertificateProcessor()

		# Act:
		verify_result = processor.verify_der_chain(chain_der)

		# Assert:
		self.assertTrue(verify_result)
		self.assertEqual(2, processor.size)
		self.assertEqual('CN=Alice,O=NEM,C=JP', processor.certificate(0).subject)
		self.assertEqual('CN=Alice,O=NEM,C=JP', processor.certificate(1).subject)

	def test_cannot_add_chain_with_invalid_signature(self):
		# Arrange:
		root_key = ed25519.Ed25519PrivateKey.generate()
		leaf_key = ed25519.Ed25519PrivateKey.generate()
		wrong_key = ed25519.Ed25519PrivateKey.generate()

		root = create_certificate(create_name('Alice'), create_name('Alice'), root_key, root_key)
		leaf = create_certificate(create_name('Bob'), create_name('Alice'), leaf_key, wrong_key)

		chain_der = [to_der(root), to_der(leaf)]
		processor = CatapultCertificateProcessor()

		# Act:
		verify_result = processor.verify_der_chain(chain_der)

		# Assert:
		self.assertFalse(verify_result)
		self.assertEqual(0, processor.size)

	def test_cannot_add_chain_without_self_signed_root(self):
		# Arrange:
		root_key = ed25519.Ed25519PrivateKey.generate()
		issuer_key = ed25519.Ed25519PrivateKey.generate()
		leaf_key = ed25519.Ed25519PrivateKey.generate()

		root = create_certificate(create_name('Alice'), create_name('Carol'), root_key, issuer_key)
		leaf = create_certificate(create_name('Bob'), create_name('Alice'), leaf_key, root_key)

		chain_der = [to_der(root), to_der(leaf)]
		processor = CatapultCertificateProcessor()

		# Act:
		verify_result = processor.verify_der_chain(chain_der)

		# Assert:
		self.assertFalse(verify_result)
		self.assertEqual(0, processor.size)

	# endregion

	# region try_extract_public_key_from_der

	def test_can_extract_public_key_from_der(self):
		# Arrange:
		private_key = ed25519.Ed25519PrivateKey.generate()
		certificate = create_certificate(create_name('Alice'), create_name('Alice'), private_key, private_key)

		# Act:
		processor = CatapultCertificateProcessor()
		public_key = processor.try_extract_public_key_from_der(to_der(certificate))

		# Assert:
		expected_public_key = PublicKey(private_key.public_key().public_bytes_raw())
		self.assertEqual(expected_public_key, public_key)

	def test_extract_public_key_from_invalid_der_returns_none(self):
		# Arrange:
		processor = CatapultCertificateProcessor()

		# Act:
		public_key = processor.try_extract_public_key_from_der(b'not-a-certificate')

		# Assert:
		self.assertIsNone(public_key)

	def test_extract_public_key_from_non_ed25519_certificate_returns_none(self):
		# Arrange:
		rsa_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
		certificate = create_certificate(create_name('Alice'), create_name('Alice'), rsa_key, rsa_key)

		# Act:
		processor = CatapultCertificateProcessor()
		public_key = processor.try_extract_public_key_from_der(to_der(certificate))

		# Assert:
		self.assertIsNone(public_key)

	# endregion
