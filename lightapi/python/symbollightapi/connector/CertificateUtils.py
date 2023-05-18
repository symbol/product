from collections import namedtuple

from symbolchain.CryptoTypes import PublicKey

from symbollightapi.bindings.openssl import ffi, lib

CertificateInfo = namedtuple('CertificateInfo', ['subject', 'public_key'])

# region try_parse_certificate


def _extract_one_line(name):
	bio = ffi.gc(lib.BIO_new(lib.BIO_s_mem()), lib.BIO_free)

	if -1 == lib.X509_NAME_print_ex(bio, name, 0, lib.XN_FLAG_RFC2253):
		return None

	raw_data = ffi.new('char **')
	data_size = lib.BIO_get_mem_data(bio, raw_data)
	data = ffi.buffer(raw_data[0], data_size)[:]
	return data.decode('utf8')


def try_parse_certificate(certificate):
	"""Tries to extract information about certificate."""

	subject_x509_name = lib.X509_get_subject_name(certificate)
	subject = _extract_one_line(subject_x509_name)

	certificate_public_key = lib.X509_get0_pubkey(certificate)
	if not certificate_public_key:
		return None

	if lib.EVP_PKEY_ED25519 != lib.EVP_PKEY_id(ffi.cast('EVP_PKEY *', certificate_public_key)):
		return None

	public_key = PublicKey(bytes(PublicKey.SIZE))
	key_size_pointer = ffi.new('size_t *', PublicKey.SIZE)
	if not lib.EVP_PKEY_get_raw_public_key(certificate_public_key, public_key.bytes, key_size_pointer):
		return None

	if PublicKey.SIZE != key_size_pointer[0]:
		return None

	return CertificateInfo(subject, public_key)

# endregion


# region verify_self_signed

def verify_self_signed(certificate):
	"""Returns True if self-signed certificate signature is correct."""

	certificate_store = ffi.gc(lib.X509_STORE_new(), lib.X509_STORE_free)
	if not lib.X509_STORE_add_cert(certificate_store, certificate):
		return False

	certificate_store_context = ffi.gc(lib.X509_STORE_CTX_new(), lib.X509_STORE_CTX_free)
	if not lib.X509_STORE_CTX_init(certificate_store_context, certificate_store, certificate, ffi.cast('Cryptography_STACK_OF_X509 *', 0)):
		return False

	lib.X509_STORE_CTX_set_flags(certificate_store_context, lib.X509_V_FLAG_CHECK_SS_SIGNATURE)
	return 1 == lib.X509_verify_cert(certificate_store_context)

# endregion
