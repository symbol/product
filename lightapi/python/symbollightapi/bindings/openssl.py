from cryptography.hazmat.bindings.openssl.binding import Binding as OpensslBinding

from ._openssl_symbol import ffi, lib  # pylint: disable=no-name-in-module, unused-import

# initialize openssl
if not OpensslBinding.lib:
	OpensslBinding()
