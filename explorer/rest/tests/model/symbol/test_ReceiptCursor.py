import base64
import json

import pytest

from rest.model.symbol.ReceiptCursor import ReceiptCursor, ReceiptCursorError, decode_receipt_cursor, encode_receipt_cursor


def _cursor(**overrides):
	values = {
		'version': 1,
		'scope': 'receipts',
		'network': 'mainnet',
		'revision': 3,
		'height': 5660900,
		'id': 28471002,
		'filter_hash': '64' * 32
	}
	values.update(overrides)
	return ReceiptCursor(**values)


def _payload(**overrides):
	values = {
		'v': 1,
		'scope': 'receipts',
		'network': 'mainnet',
		'revision': '3',
		'height': '5660900',
		'id': '28471002',
		'filterHash': '64' * 32
	}
	values.update(overrides)
	return values


def _encode_payload(payload):
	return base64.urlsafe_b64encode(json.dumps(payload, sort_keys=True, separators=(',', ':')).encode('utf-8')).decode('ascii').rstrip('=')


def test_encode_is_deterministic():
	# Arrange / Act:
	result = encode_receipt_cursor(_cursor())

	# Assert:
	assert result == _encode_payload(_payload())


def test_round_trip_and_unpadded_output():
	# Arrange:
	cursor = _cursor(revision=0, height=1, id=1)

	# Act:
	encoded = encode_receipt_cursor(cursor)

	# Assert:
	assert '=' not in encoded
	assert cursor == decode_receipt_cursor(encoded)


@pytest.mark.parametrize('payload', [
	_payload(v=True),
	_payload(v=2),
	_payload(extra=1),
	_payload(scope='other'),
	_payload(network='other'),
	_payload(revision='-1'),
	_payload(height='0'),
	_payload(id='9223372036854775808'),
	_payload(filterHash='A' * 64)
])
def test_decode_rejects_invalid_payload(payload):
	# Act / Assert:
	with pytest.raises(ReceiptCursorError, match='Invalid receipt cursor'):
		decode_receipt_cursor(_encode_payload(payload))


@pytest.mark.parametrize('token', ['', 'bad.token', 'A', base64.urlsafe_b64encode(b'\xff').decode('ascii').rstrip('=')])
def test_decode_rejects_malformed_tokens(token):
	# Act / Assert:
	with pytest.raises(ReceiptCursorError, match='Invalid receipt cursor'):
		decode_receipt_cursor(token)
