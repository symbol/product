import os
from pathlib import Path

from cffi import FFI

ffi_builder = FFI()

# if specified, add openssl to the include path
include_dirs = []
library_dirs = []
openssl_root_dir = os.environ.get('OPENSSL_ROOT_DIR', None)
if openssl_root_dir:
	include_dirs += [Path(openssl_root_dir) / 'include']
	library_dirs += [str(Path(openssl_root_dir) / 'lib')]

# build '_openssl_symbol' module and include openssl headers
ffi_builder.set_source(
	'_openssl_symbol',
	r'''
		#include <openssl/ssl.h>
		typedef STACK_OF(X509) Cryptography_STACK_OF_X509; // replacement for STACK_OF(X509)
	''',
	include_dirs=include_dirs,
	library_dirs=library_dirs,
	libraries=['crypto', 'ssl'])

# add all openssl constants, types and functions being used
ffi_builder.cdef('''
	// constants
	static const int MBSTRING_ASC;
	static const int XN_FLAG_RFC2253;

	static const int SSL_VERIFY_PEER;
	static const int SSL_VERIFY_FAIL_IF_NO_PEER_CERT;

	static const int EVP_PKEY_ED25519;
	static const int EVP_PKEY_X25519;

	static const int X509_V_ERR_APPLICATION_VERIFICATION;
	static const int X509_V_ERR_SELF_SIGNED_CERT_IN_CHAIN;

	static const int X509_V_FLAG_CHECK_SS_SIGNATURE;

	// types
	typedef ... SSL_CTX;
	typedef ... BIO;
	typedef ... BIO_METHOD;
	typedef ... ENGINE;
	typedef ... EVP_MD;
	typedef ... EVP_PKEY;
	typedef ... X509;
	typedef ... Cryptography_STACK_OF_X509;
	typedef ... X509_STORE;
	typedef ... X509_STORE_CTX;
	typedef ... X509_NAME;
	typedef ... ASN1_INTEGER;
	typedef ... ASN1_TIME;

	// SSL_CTX
	void SSL_CTX_set_verify(SSL_CTX *ctx, int mode, int (*verify_callback)(int, X509_STORE_CTX *));

	// BIO_METHOD
	const BIO_METHOD * BIO_s_mem(void);

	// BIO
	BIO* BIO_new(const BIO_METHOD *type);
	int BIO_free(BIO *a);
	long BIO_get_mem_data(BIO *b, char **pp);

	// EVP_PKEY
	EVP_PKEY *EVP_PKEY_new_raw_private_key(int type, ENGINE *e, const unsigned char *key, size_t keylen);
	void EVP_PKEY_free(EVP_PKEY *key);
	int EVP_PKEY_id(const EVP_PKEY *pkey);
	int EVP_PKEY_get_raw_public_key(const EVP_PKEY *pkey, unsigned char *pub, size_t *len);

	// X509
	X509 *X509_new(void);
	void X509_free(X509 *a);
	EVP_PKEY *X509_get0_pubkey(const X509 *x);
	X509_NAME *X509_get_subject_name(const X509 *x);
	X509_NAME *X509_get_issuer_name(const X509 *x);
	ASN1_INTEGER *X509_get_serialNumber(X509 *x);
	ASN1_TIME *X509_getm_notBefore(const X509 *x);
	ASN1_TIME *X509_getm_notAfter(const X509 *x);
	int X509_set_pubkey(X509 *x, EVP_PKEY *pkey);
	int X509_set_version(X509 *x, long version);
	int X509_sign(X509 *x, EVP_PKEY *pkey, const EVP_MD *md);

	// STACK_OF(X509)
	Cryptography_STACK_OF_X509 *sk_X509_new_null(void);
	void sk_X509_free(Cryptography_STACK_OF_X509 *sk);
	int sk_X509_num(const Cryptography_STACK_OF_X509 *sk);
	int sk_X509_push(Cryptography_STACK_OF_X509 *sk, X509 *ptr);

	// X509_STORE
	X509_STORE *X509_STORE_new(void);
	void X509_STORE_free(X509_STORE *v);
	int X509_STORE_add_cert(X509_STORE *ctx, X509 *x);

	// X509_STORE_CTX
	X509_STORE_CTX *X509_STORE_CTX_new(void);
	void X509_STORE_CTX_free(X509_STORE_CTX *ctx);
	int X509_STORE_CTX_init(X509_STORE_CTX *ctx, X509_STORE *trust_store, X509 *target, Cryptography_STACK_OF_X509 *untrusted);
	Cryptography_STACK_OF_X509 *X509_STORE_CTX_get0_chain(X509_STORE_CTX *ctx);
	X509 *X509_STORE_CTX_get_current_cert(X509_STORE_CTX *ctx);
	int X509_STORE_CTX_get_error(X509_STORE_CTX *ctx);
	void X509_STORE_CTX_set_error(X509_STORE_CTX *ctx, int s);
	void X509_STORE_CTX_set_current_cert(X509_STORE_CTX *ctx, X509 *x);
	void X509_STORE_CTX_set0_verified_chain(X509_STORE_CTX *ctx, Cryptography_STACK_OF_X509 *chain);
	void X509_STORE_CTX_set_flags(X509_STORE_CTX *ctx, unsigned long flags);
	int X509_verify_cert(X509_STORE_CTX *ctx);

	// X509_NAME
	int X509_NAME_add_entry_by_txt(X509_NAME *name, const char *field, int type, const unsigned char *bytes, int len, int loc, int set);
	int X509_NAME_print_ex(BIO *out, const X509_NAME *nm, int indent, unsigned long flags);

	// ASN1_INTEGER
	int ASN1_INTEGER_set(ASN1_INTEGER *a, long v);

	// ASN1_TIME
	ASN1_TIME *X509_gmtime_adj(ASN1_TIME *asn1_time, long offset_sec);
''')

if '__main__' == __name__:
	ffi_builder.compile(verbose=True)
