"""Normalization helpers for Symbol hash and secret lock current state."""

from collections import namedtuple

from symbolchain.CryptoTypes import Hash256
from symbolchain.sc import LockHashAlgorithm
from symbolchain.symbol.Network import Address

from puller.model.symbol.format import decoded_address_bytes_from_hex, hash_bytes_from_hex, is_exact_integer, label_for_type

LOCK_STATUS_LABELS = {0: 'unused', 1: 'used'}
LOCK_HASH_ALGORITHM_LABELS = {
	LockHashAlgorithm.SHA3_256.value: 'sha3_256',
	LockHashAlgorithm.HASH_160.value: 'hash160',
	LockHashAlgorithm.HASH_256.value: 'hash256'
}

HashLockKey = namedtuple('HashLockKey', ['hash'])
SecretLockSearchKey = namedtuple(
	'SecretLockSearchKey',
	['owner_address', 'recipient_address', 'secret', 'hash_algorithm'])
RollbackLockKeys = namedtuple('RollbackLockKeys', ['hash_keys', 'secret_keys'], defaults=((), ()))


def lock_status_label(status):
	"""Maps a Symbol Lock status number to its canonical database label."""

	if not is_exact_integer(status):
		raise ValueError(f'Unsupported Symbol lock status type {status}')

	return label_for_type(LOCK_STATUS_LABELS, status, 'lock status')


def lock_hash_algorithm_label(hash_algorithm):
	"""Maps a Symbol Lock hash algorithm number to its canonical database label."""

	if not is_exact_integer(hash_algorithm):
		raise ValueError(f'Unsupported Symbol lock hash algorithm type {hash_algorithm}')

	return label_for_type(LOCK_HASH_ALGORITHM_LABELS, hash_algorithm, 'lock hash algorithm')


def create_hash_lock_key(hash_value):
	"""Creates a validated Hash Lock dirty key from bytes or hexadecimal text."""

	if not isinstance(hash_value, (bytes, str)):
		raise ValueError('Invalid Symbol Hash Lock key')

	try:
		normalized_hash = Hash256(hash_value).bytes
	except ValueError as exception:
		raise ValueError('Invalid Symbol Hash Lock key') from exception

	return HashLockKey(normalized_hash)


def create_secret_lock_search_key_from_hex_secret(owner_address, recipient_address, secret, hash_algorithm):  # pylint: disable=invalid-name
	"""Creates a Secret Lock logical search key from a hexadecimal secret and mapped algorithm."""

	if not isinstance(secret, str):
		raise ValueError('Invalid Symbol Secret Lock secret')

	try:
		secret_bytes = Hash256(secret).bytes
	except ValueError as exception:
		raise ValueError('Invalid Symbol Secret Lock secret') from exception

	return create_secret_lock_search_key(owner_address, recipient_address, secret_bytes, hash_algorithm)


def create_secret_lock_search_key(owner_address, recipient_address, secret, hash_algorithm):
	"""Creates a validated Secret Lock logical search key."""

	normalized_owner_address = None
	if owner_address is not None:
		normalized_owner_address = _address_from_bytes(owner_address, 'owner address')
	normalized_recipient_address = _address_from_bytes(recipient_address, 'recipient address')
	normalized_secret = _hash_from_bytes(secret, 'secret')
	if hash_algorithm not in LOCK_HASH_ALGORITHM_LABELS.values():
		raise ValueError(f'Unsupported Symbol Secret Lock hash algorithm {hash_algorithm}')

	return SecretLockSearchKey(normalized_owner_address, normalized_recipient_address, normalized_secret, hash_algorithm)


def _required_lock(item, lock_type):
	if not isinstance(item, dict) or not isinstance(item.get('lock'), dict):
		raise ValueError(f'Malformed Symbol {lock_type} Lock response')

	return item['lock']


def _address_from_bytes(value, field_name):
	if not isinstance(value, bytes):
		raise ValueError(f'Invalid Symbol Secret Lock {field_name}')

	try:
		return Address(value).bytes
	except ValueError as exception:
		raise ValueError(f'Invalid Symbol Secret Lock {field_name}') from exception


def _hash_from_bytes(value, field_name):
	if not isinstance(value, bytes):
		raise ValueError(f'Invalid Symbol Secret Lock {field_name}')

	try:
		return Hash256(value).bytes
	except ValueError as exception:
		raise ValueError(f'Invalid Symbol Secret Lock {field_name}') from exception


def _mosaic_id(lock, lock_type):
	value = lock.get('mosaicId')
	if not isinstance(value, str) or len(value) != 16:
		raise ValueError(f'Invalid Symbol {lock_type} Lock mosaicId')

	try:
		bytes.fromhex(value)
	except ValueError as exception:
		raise ValueError(f'Invalid Symbol {lock_type} Lock mosaicId') from exception

	return value.upper()


def _integer(lock, field_name, lock_type):
	value = lock.get(field_name)
	if is_exact_integer(value) and 0 <= value:
		return value
	if isinstance(value, str) and value.isascii() and value.isdecimal():
		return int(value)

	raise ValueError(f'Invalid Symbol {lock_type} Lock {field_name}')


def create_hash_lock_row(item, observed_height):
	"""Creates one persisted Hash Lock row from a Symbol node response wrapper."""

	lock = _required_lock(item, 'Hash')
	return {
		'hash': hash_bytes_from_hex(lock, 'hash', 'Symbol Hash Lock'),
		'owner_address': decoded_address_bytes_from_hex(lock, 'ownerAddress', 'Symbol Hash Lock'),
		'mosaic_id': _mosaic_id(lock, 'Hash'),
		'amount': _integer(lock, 'amount', 'Hash'),
		'end_height': _integer(lock, 'endHeight', 'Hash'),
		'status': lock_status_label(lock.get('status')),
		'raw_payload': item,
		'updated_at_height': observed_height
	}


def create_secret_lock_row(item, observed_height):
	"""Creates one persisted Secret Lock row from a Symbol node response wrapper."""

	lock = _required_lock(item, 'Secret')
	composite_hash = hash_bytes_from_hex(lock, 'compositeHash', 'Symbol Secret Lock')
	owner_address = decoded_address_bytes_from_hex(lock, 'ownerAddress', 'Symbol Secret Lock')
	recipient_address = decoded_address_bytes_from_hex(lock, 'recipientAddress', 'Symbol Secret Lock')
	secret = hash_bytes_from_hex(lock, 'secret', 'Symbol Secret Lock')
	hash_algorithm = lock_hash_algorithm_label(lock.get('hashAlgorithm'))
	create_secret_lock_search_key(owner_address, recipient_address, secret, hash_algorithm)

	return {
		'composite_hash': composite_hash,
		'owner_address': owner_address,
		'recipient_address': recipient_address,
		'secret': secret,
		'hash_algorithm': hash_algorithm,
		'mosaic_id': _mosaic_id(lock, 'Secret'),
		'amount': _integer(lock, 'amount', 'Secret'),
		'end_height': _integer(lock, 'endHeight', 'Secret'),
		'status': lock_status_label(lock.get('status')),
		'raw_payload': item,
		'updated_at_height': observed_height
	}
