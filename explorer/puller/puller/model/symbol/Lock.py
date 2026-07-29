"""Normalization helpers for Symbol hash and secret lock current state."""

from collections import namedtuple

from symbolchain.sc import LockHashAlgorithm

from puller.model.symbol.format import label_for_type

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

	if not isinstance(status, int) or isinstance(status, bool):
		raise ValueError(f'Unsupported Symbol lock status type {status}')

	return label_for_type(LOCK_STATUS_LABELS, status, 'lock status')


def lock_hash_algorithm_label(hash_algorithm):
	"""Maps a Symbol Lock hash algorithm number to its canonical database label."""

	if not isinstance(hash_algorithm, int) or isinstance(hash_algorithm, bool):
		raise ValueError(f'Unsupported Symbol lock hash algorithm type {hash_algorithm}')

	return label_for_type(LOCK_HASH_ALGORITHM_LABELS, hash_algorithm, 'lock hash algorithm')


def create_hash_lock_key(hash_value):
	"""Creates a validated Hash Lock dirty key from a 32-byte value."""

	if not isinstance(hash_value, bytes) or 32 != len(hash_value):
		raise ValueError('Invalid Symbol Hash Lock key')

	return HashLockKey(hash_value)


def create_hash_lock_key_from_hex(hash_value):
	"""Creates a validated Hash Lock dirty key from a hexadecimal hash."""

	if not isinstance(hash_value, str):
		raise ValueError('Invalid Symbol Hash Lock key')

	try:
		return create_hash_lock_key(bytes.fromhex(hash_value))
	except ValueError as exception:
		raise ValueError('Invalid Symbol Hash Lock key') from exception


def create_secret_lock_search_key_from_hex_secret(owner_address, recipient_address, secret, hash_algorithm):  # pylint: disable=invalid-name
	"""Creates a Secret Lock logical search key from a hexadecimal secret and mapped algorithm."""

	if not isinstance(secret, str):
		raise ValueError('Invalid Symbol Secret Lock secret')

	try:
		secret_bytes = bytes.fromhex(secret)
	except ValueError as exception:
		raise ValueError('Invalid Symbol Secret Lock secret') from exception

	return create_secret_lock_search_key(owner_address, recipient_address, secret_bytes, hash_algorithm)


def create_secret_lock_search_key(owner_address, recipient_address, secret, hash_algorithm):
	"""Creates a validated Secret Lock logical search key."""

	if owner_address is not None and (not isinstance(owner_address, bytes) or 24 != len(owner_address)):
		raise ValueError('Invalid Symbol Secret Lock owner address')
	if not isinstance(recipient_address, bytes) or 24 != len(recipient_address):
		raise ValueError('Invalid Symbol Secret Lock recipient address')
	if not isinstance(secret, bytes) or 32 != len(secret):
		raise ValueError('Invalid Symbol Secret Lock secret')
	if hash_algorithm not in LOCK_HASH_ALGORITHM_LABELS.values():
		raise ValueError(f'Unsupported Symbol Secret Lock hash algorithm {hash_algorithm}')

	return SecretLockSearchKey(owner_address, recipient_address, secret, hash_algorithm)


def _required_lock(item, lock_type):
	if not isinstance(item, dict) or not isinstance(item.get('lock'), dict):
		raise ValueError(f'Malformed Symbol {lock_type} Lock response')

	return item['lock']


def _hex_bytes(lock, field_name, byte_length, lock_type):
	value = lock.get(field_name)
	if not isinstance(value, str) or len(value) != byte_length * 2:
		raise ValueError(f'Invalid Symbol {lock_type} Lock {field_name}')

	try:
		return bytes.fromhex(value)
	except ValueError as exception:
		raise ValueError(f'Invalid Symbol {lock_type} Lock {field_name}') from exception


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
	if isinstance(value, int) and not isinstance(value, bool) and 0 <= value:
		return value
	if isinstance(value, str) and value.isascii() and value.isdecimal():
		return int(value)

	raise ValueError(f'Invalid Symbol {lock_type} Lock {field_name}')


def create_hash_lock_row(item, observed_height):
	"""Creates one persisted Hash Lock row from a Symbol node response wrapper."""

	lock = _required_lock(item, 'Hash')
	return {
		'hash': _hex_bytes(lock, 'hash', 32, 'Hash'),
		'owner_address': _hex_bytes(lock, 'ownerAddress', 24, 'Hash'),
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
	composite_hash = _hex_bytes(lock, 'compositeHash', 32, 'Secret')
	owner_address = _hex_bytes(lock, 'ownerAddress', 24, 'Secret')
	recipient_address = _hex_bytes(lock, 'recipientAddress', 24, 'Secret')
	secret = _hex_bytes(lock, 'secret', 32, 'Secret')
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
