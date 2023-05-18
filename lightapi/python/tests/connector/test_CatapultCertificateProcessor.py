import unittest

from symbollightapi.bindings.openssl import lib
from symbollightapi.connector.CatapultCertificateProcessor import CatapultCertificateProcessor

from ..test.CertificateTestUtils import (
	CertificateBuilder,
	create_certificate_store_context_from_certificates,
	generate_random_certificate_private_key,
	set_active_certificate
)

# region test utils


def get_error_from_store_context(certificate_store_context):
	return lib.X509_STORE_CTX_get_error(certificate_store_context)


def create_default_certificate(common_name):
	builder = CertificateBuilder()
	builder.set_subject('JP', 'NEM', common_name)
	builder.set_issuer('JP', 'NEM', common_name)
	builder.set_public_key(generate_random_certificate_private_key())
	return builder.build_and_sign()


def create_certificate_store_context(common_names):
	certificates = [create_default_certificate(common_name) for common_name in common_names]
	return (create_certificate_store_context_from_certificates(certificates), certificates)

# endregion


class CatapultCertificateProcessorTest(unittest.TestCase):
	# region constructor

	def test_can_create_processor(self):
		# Act:
		processor = CatapultCertificateProcessor()

		# Assert:
		self.assertEqual(0, processor.size)

	# endregion

	# region no active certificate

	def test_verify_fails_when_no_certificate_is_active(self):
		# Arrange:
		certificate_store_context, _ = create_certificate_store_context(['Alice', 'Bob'])
		set_active_certificate(certificate_store_context, [None], 0)
		processor = CatapultCertificateProcessor()

		# Act + Assert:
		with self.assertRaises(RuntimeError):
			processor.verify(True, certificate_store_context)

		self.assertEqual(0, get_error_from_store_context(certificate_store_context))

	# endregion

	# region preverified

	@staticmethod
	def _preverify_multiple(processor, certificate_store_context, certificates, count):
		results = []
		for i in range(count):
			set_active_certificate(certificate_store_context, certificates, i)
			results.append(processor.verify(True, certificate_store_context))

		return results

	def test_can_add_single_preverified_certificate(self):
		# Arrange:
		certificate_store_context, certificates = create_certificate_store_context(['Alice', 'Bob'])
		processor = CatapultCertificateProcessor()

		# Act:
		verify_results = self._preverify_multiple(processor, certificate_store_context, certificates, 1)

		# Assert:
		self.assertEqual([True], verify_results)
		self.assertEqual(0, get_error_from_store_context(certificate_store_context))
		self.assertEqual(1, processor.size)

		self.assertEqual('CN=Alice,O=NEM,C=JP', processor.certificate(0).subject)

	def test_can_add_two_preverified_certificates(self):
		# Arrange:
		certificate_store_context, certificates = create_certificate_store_context(['Alice', 'Bob'])
		processor = CatapultCertificateProcessor()

		# Act:
		verify_results = self._preverify_multiple(processor, certificate_store_context, certificates, 2)

		# Assert:
		self.assertEqual([True] * 2, verify_results)
		self.assertEqual(0, get_error_from_store_context(certificate_store_context))
		self.assertEqual(2, processor.size)

		self.assertEqual('CN=Alice,O=NEM,C=JP', processor.certificate(0).subject)
		self.assertEqual('CN=Bob,O=NEM,C=JP', processor.certificate(1).subject)

	def test_cannot_add_preverified_chain_with_too_few_certificates(self):
		# Arrange:
		certificate_store_context, certificates = create_certificate_store_context(['Alice'])
		processor = CatapultCertificateProcessor()

		# Act:
		verify_results = self._preverify_multiple(processor, certificate_store_context, certificates, 1)

		# Assert:
		self.assertEqual([False], verify_results)
		self.assertEqual(0, get_error_from_store_context(certificate_store_context))
		self.assertEqual(0, processor.size)

	def test_cannot_add_preverified_chain_with_too_many_certificates(self):
		# Arrange:
		certificate_store_context, certificates = create_certificate_store_context(['Alice', 'Bob', 'Charlie'])
		processor = CatapultCertificateProcessor()

		# Act:
		verify_results = self._preverify_multiple(processor, certificate_store_context, certificates, 3)

		# Assert:
		self.assertEqual([False] * 3, verify_results)
		self.assertEqual(0, get_error_from_store_context(certificate_store_context))
		self.assertEqual(0, processor.size)

	def test_unparseable_certificate_takes_precedence_over_preverified_status(self):
		# Arrange: create a certificate without a key
		builder = CertificateBuilder()
		builder.set_subject('JP', 'NEM', 'Alice')
		builder.set_issuer('JP', 'NEM', 'Alice')

		certificates = [
			builder.build(),
			create_default_certificate('Bob')
		]
		certificate_store_context = create_certificate_store_context_from_certificates(certificates)
		processor = CatapultCertificateProcessor()

		# Act:
		verify_result = processor.verify(True, certificate_store_context)

		# Assert:
		self.assertFalse(verify_result)
		self.assertEqual(lib.X509_V_ERR_APPLICATION_VERIFICATION, get_error_from_store_context(certificate_store_context))
		self.assertEqual(0, processor.size)

	def test_consecutive_certificates_with_same_public_key_are_not_collapsed(self):
		# Arrange:
		certificate_private_key = generate_random_certificate_private_key()

		builder1 = CertificateBuilder()
		builder1.set_subject('JP', 'NEM', 'Alice')
		builder1.set_issuer('JP', 'NEM', 'Alice')
		builder1.set_public_key(certificate_private_key)

		builder2 = CertificateBuilder()
		builder2.set_subject('CA', 'SYM', 'Bob')
		builder2.set_issuer('CA', 'SYM', 'Bob')
		builder2.set_public_key(certificate_private_key)

		certificates = [builder1.build_and_sign(), builder2.build_and_sign()]
		certificate_store_context = create_certificate_store_context_from_certificates(certificates)
		processor = CatapultCertificateProcessor()

		# Act:
		verify_results = self._preverify_multiple(processor, certificate_store_context, certificates, 2)

		# Assert:
		self.assertEqual([True] * 2, verify_results)
		self.assertEqual(0, get_error_from_store_context(certificate_store_context))
		self.assertEqual(2, processor.size)

		self.assertEqual('CN=Alice,O=NEM,C=JP', processor.certificate(0).subject)
		self.assertEqual('CN=Bob,O=SYM,C=CA', processor.certificate(1).subject)

	def test_consecutive_certificates_with_same_subject_are_not_collapsed(self):
		# Arrange:
		builder1 = CertificateBuilder()
		builder1.set_subject('JP', 'NEM', 'Alice')
		builder1.set_issuer('JP', 'NEM', 'Alice')
		builder1.set_public_key(generate_random_certificate_private_key())

		builder2 = CertificateBuilder()
		builder2.set_subject('JP', 'NEM', 'Alice')
		builder2.set_issuer('JP', 'NEM', 'Alice')
		builder2.set_public_key(generate_random_certificate_private_key())

		certificates = [builder1.build_and_sign(), builder2.build_and_sign()]
		certificate_store_context = create_certificate_store_context_from_certificates(certificates)
		processor = CatapultCertificateProcessor()

		# Act:
		verify_results = self._preverify_multiple(processor, certificate_store_context, certificates, 2)

		# Assert:
		self.assertEqual([True] * 2, verify_results)
		self.assertEqual(0, get_error_from_store_context(certificate_store_context))
		self.assertEqual(2, processor.size)

		self.assertEqual('CN=Alice,O=NEM,C=JP', processor.certificate(0).subject)
		self.assertEqual('CN=Alice,O=NEM,C=JP', processor.certificate(1).subject)

	# endregion

	# region not preverified

	def test_can_add_self_signed_root_certificate(self):
		# Arrange:
		certificate_store_context, _ = create_certificate_store_context(['Alice', 'Bob'])
		lib.X509_STORE_CTX_set_error(certificate_store_context, lib.X509_V_ERR_SELF_SIGNED_CERT_IN_CHAIN)
		processor = CatapultCertificateProcessor()

		# Act:
		verify_result = processor.verify(False, certificate_store_context)

		# Assert:
		self.assertTrue(verify_result)
		self.assertEqual(lib.X509_V_ERR_SELF_SIGNED_CERT_IN_CHAIN, get_error_from_store_context(certificate_store_context))
		self.assertEqual(0, processor.size)

	def test_cannot_add_self_signed_non_root_certificate(self):
		# Arrange:
		certificate_store_context, certificates = create_certificate_store_context(['Alice', 'Bob'])
		lib.X509_STORE_CTX_set_error(certificate_store_context, lib.X509_V_ERR_SELF_SIGNED_CERT_IN_CHAIN)
		processor = CatapultCertificateProcessor()

		verify_result1 = processor.verify(False, certificate_store_context)
		verify_result2 = processor.verify(True, certificate_store_context)
		set_active_certificate(certificate_store_context, certificates, 1)

		# Act:
		verify_result3 = processor.verify(False, certificate_store_context)

		# Assert:
		self.assertTrue(verify_result1)
		self.assertTrue(verify_result2)
		self.assertFalse(verify_result3)
		self.assertEqual(lib.X509_V_ERR_SELF_SIGNED_CERT_IN_CHAIN, get_error_from_store_context(certificate_store_context))
		self.assertEqual(1, processor.size)

		self.assertEqual('CN=Alice,O=NEM,C=JP', processor.certificate(0).subject)

	def assert_self_signed_root_certificate_error(
		self,
		subject_common_name,
		issuer_common_name,
		error_code_delta,
		should_sign
	):  # pylint: disable=invalid-name
		# Arrange:
		builder = CertificateBuilder()
		builder.set_subject('JP', 'NEM', subject_common_name)
		builder.set_issuer('JP', 'NEM', issuer_common_name)
		builder.set_public_key(generate_random_certificate_private_key())
		certificate = builder.build_and_sign() if should_sign else builder.build()

		certificates = [certificate, create_default_certificate('Bob')]
		certificate_store_context = create_certificate_store_context_from_certificates(certificates)

		error_code = lib.X509_V_ERR_SELF_SIGNED_CERT_IN_CHAIN + error_code_delta
		lib.X509_STORE_CTX_set_error(certificate_store_context, error_code)
		processor = CatapultCertificateProcessor()

		# Act:
		verify_result = processor.verify(False, certificate_store_context)

		# Assert:
		self.assertFalse(verify_result)
		self.assertEqual(error_code, get_error_from_store_context(certificate_store_context))
		self.assertEqual(0, processor.size)

	def test_cannot_add_self_signed_root_certificate_unexpected_error(self):
		self.assert_self_signed_root_certificate_error('Alice', 'Alice', 1, True)

	def test_cannot_add_self_signed_root_certificate_wrong_issuer(self):
		self.assert_self_signed_root_certificate_error('Alice', 'Bob', 0, True)

	def test_cannot_add_self_signed_root_certificate_unsigned(self):
		self.assert_self_signed_root_certificate_error('Alice', 'Alice', 0, False)

	# endregion
