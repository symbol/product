from cryptography import x509
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from symbolchain.CryptoTypes import PublicKey
from zenlog import log

from .CertificateUtils import CertificateInfo


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

	def verify_der_chain(self, chain_der):
		"""Verifies a DER-encoded certificate chain without OpenSSL verify callback."""

		self.certificate_infos = []

		if 2 != len(chain_der):
			log.warning(f'rejecting certificate chain with size {len(chain_der)}')
			return False

		certificates = []
		for der in chain_der:
			try:
				certificates.append(x509.load_der_x509_certificate(der))
			except Exception:  # pylint: disable=broad-except
				log.warning('rejecting certificate chain due to certificate parse failure')
				return False

		root = None
		leaf = None
		for certificate in certificates:
			if self._is_self_signed(certificate):
				root = certificate
			else:
				leaf = certificate

		if not root or not leaf:
			log.warning('rejecting certificate chain with unverified unexpected structure')
			return False

		if not self._is_signed_by(leaf, root):
			log.warning('rejecting certificate chain with improperly self-signed root certificate')
			return False

		root_info = self._try_parse_certificate_from_cryptography(root)
		leaf_info = self._try_parse_certificate_from_cryptography(leaf)
		if not root_info or not leaf_info:
			log.warning('rejecting certificate chain due to certificate parse failure')
			return False

		self.certificate_infos.append(root_info)
		self.certificate_infos.append(leaf_info)
		return True

	def try_extract_public_key_from_der(self, certificate_der):
		"""Tries to extract Symbol public key from a single DER certificate."""

		try:
			certificate = x509.load_der_x509_certificate(certificate_der)
		except Exception:  # pylint: disable=broad-except
			return None

		certificate_info = self._try_parse_certificate_from_cryptography(certificate)
		return certificate_info.public_key if certificate_info else None

	@staticmethod
	def _is_self_signed(certificate):
		if certificate.issuer != certificate.subject:
			return False

		try:
			certificate.public_key().verify(certificate.signature, certificate.tbs_certificate_bytes)
			return True
		except Exception:  # pylint: disable=broad-except
			return False

	@staticmethod
	def _is_signed_by(certificate, signer):
		try:
			signer.public_key().verify(certificate.signature, certificate.tbs_certificate_bytes)
			return True
		except Exception:  # pylint: disable=broad-except
			return False

	@staticmethod
	def _try_parse_certificate_from_cryptography(certificate):
		public_key = certificate.public_key()
		if not isinstance(public_key, Ed25519PublicKey):
			return None

		subject = certificate.subject.rfc4514_string()
		return CertificateInfo(subject, PublicKey(public_key.public_bytes_raw()))
