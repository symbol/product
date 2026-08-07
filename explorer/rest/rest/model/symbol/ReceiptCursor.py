import base64
import binascii
import json
import re
from collections import namedtuple

RECEIPT_CURSOR_VERSION = 1
MAX_RECEIPT_CURSOR_LENGTH = 2048
MAX_SIGNED_BIGINT = 9223372036854775807
BASE64URL_PATTERN = re.compile(r'^[A-Za-z0-9_-]+$')
DECIMAL_PATTERN = re.compile(r'^(0|[1-9][0-9]*)$')
FILTER_HASH_PATTERN = re.compile(r'^[0-9a-f]{64}$')
CURSOR_KEYS = frozenset(['v', 'scope', 'network', 'revision', 'height', 'id', 'filterHash'])
CURSOR_SCOPES = frozenset(['receipts', 'blockReceipts'])
CURSOR_NETWORKS = frozenset(['mainnet', 'testnet'])

ReceiptCursor = namedtuple('ReceiptCursor', ['version', 'scope', 'network', 'revision', 'height', 'id', 'filter_hash'])


class ReceiptCursorError(ValueError):
	"""Raised when a receipt cursor is not a valid opaque token."""


def encode_receipt_cursor(cursor):
	"""Encodes a validated receipt cursor as unpadded Base64URL JSON."""

	payload = {
		'v': cursor.version,
		'scope': cursor.scope,
		'network': cursor.network,
		'revision': str(cursor.revision),
		'height': str(cursor.height),
		'id': str(cursor.id),
		'filterHash': cursor.filter_hash
	}
	serialized = json.dumps(payload, ensure_ascii=True, sort_keys=True, separators=(',', ':')).encode('utf-8')
	return base64.urlsafe_b64encode(serialized).decode('ascii').rstrip('=')


def decode_receipt_cursor(token):
	"""Decodes and strictly validates a receipt cursor token."""

	if not isinstance(token, str) or not token or len(token) > MAX_RECEIPT_CURSOR_LENGTH:
		raise ReceiptCursorError('Invalid receipt cursor')
	if not BASE64URL_PATTERN.fullmatch(token) or len(token) % 4 == 1:
		raise ReceiptCursorError('Invalid receipt cursor')

	try:
		padding = '=' * (-len(token) % 4)
		decoded = base64.urlsafe_b64decode((token + padding).encode('ascii'))
		if base64.urlsafe_b64encode(decoded).decode('ascii').rstrip('=') != token:
			raise ReceiptCursorError('Invalid receipt cursor')
		payload = json.loads(decoded.decode('utf-8'))
	except (ReceiptCursorError, ValueError, UnicodeDecodeError, binascii.Error) as error:
		raise ReceiptCursorError('Invalid receipt cursor') from error

	if not isinstance(payload, dict) or frozenset(payload) != CURSOR_KEYS:
		raise ReceiptCursorError('Invalid receipt cursor')
	if isinstance(payload['v'], bool) or payload['v'] != RECEIPT_CURSOR_VERSION:
		raise ReceiptCursorError('Invalid receipt cursor')
	if not isinstance(payload['scope'], str) or not isinstance(payload['network'], str):
		raise ReceiptCursorError('Invalid receipt cursor')
	if payload['scope'] not in CURSOR_SCOPES or payload['network'] not in CURSOR_NETWORKS:
		raise ReceiptCursorError('Invalid receipt cursor')

	values = {}
	for field, minimum in [('revision', 0), ('height', 1), ('id', 1)]:
		value = payload[field]
		if not isinstance(value, str) or not DECIMAL_PATTERN.fullmatch(value):
			raise ReceiptCursorError('Invalid receipt cursor')
		parsed = int(value)
		if parsed < minimum or parsed > MAX_SIGNED_BIGINT:
			raise ReceiptCursorError('Invalid receipt cursor')
		values[field] = parsed

	if not isinstance(payload['filterHash'], str) or not FILTER_HASH_PATTERN.fullmatch(payload['filterHash']):
		raise ReceiptCursorError('Invalid receipt cursor')

	return ReceiptCursor(
		RECEIPT_CURSOR_VERSION,
		payload['scope'],
		payload['network'],
		values['revision'],
		values['height'],
		values['id'],
		payload['filterHash']
	)
