from symbolchain.CryptoTypes import PrivateKey

from symbolconnectors.bindings.openssl import ffi, lib


class CertificateException(Exception):
	pass


# region key utils

def generate_random_certificate_private_key():  # pylint: disable=invalid-name
	return generate_certificate_private_key(PrivateKey.random())


def generate_certificate_private_key(private_key):
	certificate_private_key = lib.EVP_PKEY_new_raw_private_key(
		lib.EVP_PKEY_ED25519,
		ffi.cast('ENGINE *', 0),
		private_key.bytes,
		len(private_key.bytes))
	return ffi.gc(certificate_private_key, lib.EVP_PKEY_free)

# endregion


# region certificate store context utils

def set_active_certificate(certificate_store_context, certificates, index):
	active_certificate = ffi.cast('X509 *', 0) if certificates[index] is None else certificates[index]
	lib.X509_STORE_CTX_set_current_cert(certificate_store_context, active_certificate)


def create_certificate_store_context_from_certificates(certificates):  # pylint: disable=invalid-name
	certificate_stack = ffi.gc(lib.sk_X509_new_null(), lib.sk_X509_free)

	for certificate in certificates:
		if not lib.sk_X509_push(certificate_stack, certificate):
			raise CertificateException('failed to add certificate to stack')

	certificate_store_context = ffi.gc(lib.X509_STORE_CTX_new(), lib.X509_STORE_CTX_free)
	if not lib.X509_STORE_CTX_init(
		certificate_store_context,
		ffi.cast('X509_STORE *', 0),
		ffi.cast('X509 *', 0),
		ffi.cast('Cryptography_STACK_OF_X509 *', 0)
	):
		raise CertificateException('failed to initialize certificate store context')

	ffi.gc(certificate_stack, None)  # ownership is transferred in X509_STORE_CTX_set0_verified_chain
	lib.X509_STORE_CTX_set0_verified_chain(certificate_store_context, certificate_stack)

	set_active_certificate(certificate_store_context, certificates, 0)
	return certificate_store_context

# endregion


# region CertificateBuilder

def _add_text_entry(name, key, value):
	result = lib.X509_NAME_add_entry_by_txt(name, key.encode('utf8'), lib.MBSTRING_ASC, value.encode('utf8'), -1, -1, 0)
	if not result:
		raise CertificateException(f'failed to add text entry "{key}"')


def _add_text_entries(name, country, organization, common_name):
	_add_text_entry(name, 'C', country)
	_add_text_entry(name, 'O', organization)
	_add_text_entry(name, 'CN', common_name)


class CertificateBuilder:
	def __init__(self):
		self.certificate_private_key = None
		self.certificate = ffi.gc(lib.X509_new(), lib.X509_free)

		# set the version
		if not lib.X509_set_version(self.certificate, 0):
			raise CertificateException('failed to set certificate version')

		# set the serial number
		if not lib.ASN1_INTEGER_set(lib.X509_get_serialNumber(self.certificate), 1):
			raise CertificateException('failed to set certificate serial number')

		# set expiration from now until one year from now
		if not lib.X509_gmtime_adj(lib.X509_getm_notBefore(self.certificate), 0) or (
			not lib.X509_gmtime_adj(lib.X509_getm_notAfter(self.certificate), 31536000)
		):
			raise CertificateException('failed to set certificate expiration')

	def set_subject(self, country, organization, common_name):
		_add_text_entries(lib.X509_get_subject_name(self.certificate), country, organization, common_name)

	def set_issuer(self, country, organization, common_name):
		_add_text_entries(lib.X509_get_issuer_name(self.certificate), country, organization, common_name)

	def set_public_key(self, certificate_private_key):
		if not lib.X509_set_pubkey(self.certificate, certificate_private_key):
			raise CertificateException('failed to set certificate public key')

		self.certificate_private_key = certificate_private_key

	def build(self):
		return self.certificate

	def build_and_sign(self):
		default_evp = ffi.cast('EVP_MD *', 0)
		if not lib.X509_sign(self.certificate, self.certificate_private_key, default_evp):
			raise CertificateException('failed to sign certificate')

		return self.certificate

# endregion
