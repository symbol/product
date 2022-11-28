from ..bindings.openssl import lib
from .CertificateUtils import try_parse_certificate, verify_self_signed


class CatapultCertificateProcessor:
	"""Catapult-specific certificate processor."""

	def __init__(self):
		"""Creates a new certificate processor."""

		self.certificate_infos = []

	@property
	def size(self):
		"""Gets the number of certificates in the chain."""

		return len(self.certificate_infos)

	def certificate(self, depth):
		"""
		Gets the parsed certificate information at depth.
		Depth is 0-based starting with the root certificate.
		"""

		return self.certificate_infos[depth]

	def verify(self, preverified, certificate_store_context):
		"""Verifies the current certificate in certificate_store_context given preverified result."""

		# reject all certificate chains that are not composed of two certificates
		chain = lib.X509_STORE_CTX_get0_chain(certificate_store_context)
		chain_size = lib.sk_X509_num(chain)
		if 2 != chain_size:
			print(f'rejecting certificate chain with size {chain_size}')
			return False

		certificate = lib.X509_STORE_CTX_get_current_cert(certificate_store_context)
		if not certificate:
			raise RuntimeError('rejecting certificate chain with no active certificate')

		if preverified:
			if self._push(certificate):
				return True

			lib.X509_STORE_CTX_set_error(certificate_store_context, lib.X509_V_ERR_APPLICATION_VERIFICATION)
			return False

		error_code = lib.X509_STORE_CTX_get_error(certificate_store_context)
		return self.verify_unverified_root(certificate, error_code)

	def verify_unverified_root(self, certificate, error_code):
		if self.certificate_infos:
			print('rejecting certificate chain with unverified non-root certificate')
			return False

		# only verify self signed certificates
		if lib.X509_V_ERR_SELF_SIGNED_CERT_IN_CHAIN != error_code:
			print(f'rejecting certificate chain with unverified unexpected error {error_code}')
			return False

		if not verify_self_signed(certificate):
			print('rejecting certificate chain with improperly self-signed root certificate')
			return False

		return True

	def _push(self, certificate):
		certificate_info = try_parse_certificate(certificate)
		if not certificate_info:
			print('rejecting certificate chain due to certificate parse failure')
			return False

		self.certificate_infos.append(certificate_info)
		return True
