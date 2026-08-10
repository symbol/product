import base64
import json

import pytest
from flask import Flask
from psycopg2 import OperationalError
from symbolchain.symbol.Network import Network

from rest import setup_error_handlers
from rest.db.SymbolDatabase import ReceiptCursorStaleError, ReceiptDataUnavailableError, ReceiptQuery
from rest.model.symbol.Receipt import ReceiptPage, ReceiptPosition
from rest.model.symbol.ReceiptCursor import MAX_RECEIPT_CURSOR_LENGTH, decode_receipt_cursor
from rest.routes.symbol import setup_symbol_routes

TEST_ADDRESS = str(Network.TESTNET.address_class(bytes.fromhex('9889432DE263BB8FE88444A4DA28D3609BD8BB8FAE18AE95')))


class ReceiptFacade:
	def __init__(self):
		self.receipts_result = ReceiptPage((), None, 0)
		self.receipt_query = None
		self.receipts_error = None

	@staticmethod
	def get_health():
		return {'isHealthy': True, 'errors': []}

	@staticmethod
	def is_block_data_available():
		return False

	@staticmethod
	def get_blocks(_from_height, _limit, _sort):
		return []

	@staticmethod
	def get_block(_height):
		return None

	def get_receipts(self, query):
		self.receipt_query = query
		if self.receipts_error:
			raise self.receipts_error
		return self.receipts_result


def _create_client(facade):
	app = Flask(__name__)
	app.config['NETWORK_NAME'] = 'testnet'
	setup_error_handlers(app)
	setup_symbol_routes(app, facade)
	return app.test_client()


def _assert_bad_request(response, message):
	assert 400 == response.status_code
	assert {'status': 400, 'message': message} == response.json


def test_receipts_builds_default_query():
	# Arrange:
	facade = ReceiptFacade()

	# Act:
	response = _create_client(facade).get('/api/symbol/receipts')

	# Assert:
	assert 200 == response.status_code
	assert {'data': [], 'pagination': {'nextCursor': None}} == response.json
	assert ReceiptQuery(10, None, None, None, None, (), None, None) == facade.receipt_query


def test_receipts_normalizes_filters():
	# Arrange:
	facade = ReceiptFacade()
	url = (
		f'/api/symbol/receipts?limit=25&group=balanceChange&'
		f'receiptType=8515&targetAddress={TEST_ADDRESS}'
	)

	# Act:
	response = _create_client(facade).get(url)

	# Assert:
	assert 200 == response.status_code
	assert ReceiptQuery(
		25,
		None,
		None,
		'balanceChange',
		'harvestFee',
		(),
		bytes.fromhex('9889432DE263BB8FE88444A4DA28D3609BD8BB8FAE18AE95'),
		None
	) == facade.receipt_query


def test_receipts_rejects_offset():
	# Arrange:
	facade = ReceiptFacade()

	# Act:
	response = _create_client(facade).get('/api/symbol/receipts?offset=1')

	# Assert:
	_assert_bad_request(response, 'Unsupported query parameter: offset')
	assert facade.receipt_query is None


def test_receipts_rejects_page_number():
	# Arrange:
	facade = ReceiptFacade()

	# Act:
	response = _create_client(facade).get('/api/symbol/receipts?pageNumber=2')

	# Assert:
	_assert_bad_request(response, 'Unsupported query parameter: pageNumber')
	assert facade.receipt_query is None


def test_receipts_rejects_bad_limit():
	# Arrange:
	facade = ReceiptFacade()

	# Act:
	response = _create_client(facade).get('/api/symbol/receipts?limit=invalid')

	# Assert:
	_assert_bad_request(response, 'limit must be an integer')
	assert facade.receipt_query is None


@pytest.mark.parametrize('query_parameter, message', [
	('limit=0', 'limit must be between 1 and 100'),
	('limit=-1', 'limit must be between 1 and 100'),
	('limit=101', 'limit must be between 1 and 100'),
])
def test_receipts_invalid_pagination(query_parameter, message):
	# Arrange:
	facade = ReceiptFacade()

	# Act:
	response = _create_client(facade).get('/api/symbol/receipts?' + query_parameter)

	# Assert:
	_assert_bad_request(response, message)
	assert facade.receipt_query is None


def test_receipts_rejects_bad_group():
	# Arrange:
	facade = ReceiptFacade()

	# Act:
	response = _create_client(facade).get('/api/symbol/receipts?group=unknown')

	# Assert:
	_assert_bad_request(response, 'group is invalid')
	assert facade.receipt_query is None


def test_receipts_rejects_bad_type_code():
	# Arrange:
	facade = ReceiptFacade()

	# Act:
	response = _create_client(facade).get('/api/symbol/receipts?receiptType=invalid')

	# Assert:
	_assert_bad_request(response, 'receiptType must be a valid numeric code')
	assert facade.receipt_query is None


def test_receipts_unknown_type_code():
	# Arrange:
	facade = ReceiptFacade()

	# Act:
	response = _create_client(facade).get('/api/symbol/receipts?receiptType=1')

	# Assert:
	_assert_bad_request(response, 'receiptType is not supported')
	assert facade.receipt_query is None


def test_receipts_normalizes_includes():
	# Arrange:
	facade = ReceiptFacade()

	# Act:
	response = _create_client(facade).get(
		'/api/symbol/receipts?includedReceiptTypes=8776&includedReceiptTypes=12616&'
		'includedReceiptTypes=8776&group=balanceChange')

	# Assert:
	assert 200 == response.status_code
	assert {'data': [], 'pagination': {'nextCursor': None}} == response.json
	assert ReceiptQuery(
		10, None, None, 'balanceChange', None,
		('lockHashCompleted', 'lockHashCreated'), None, None
	) == facade.receipt_query


def test_receipts_included_mismatch():
	# Arrange:
	facade = ReceiptFacade()

	# Act:
	response = _create_client(facade).get(
		'/api/symbol/receipts?group=inflation&includedReceiptTypes=8515')

	# Assert:
	_assert_bad_request(response, 'includedReceiptTypes contains a receipt from another group')
	assert facade.receipt_query is None


def test_receipts_bad_included_type():
	# Arrange:
	facade = ReceiptFacade()

	# Act:
	response = _create_client(facade).get('/api/symbol/receipts?includedReceiptTypes=invalid')

	# Assert:
	_assert_bad_request(response, 'includedReceiptTypes must contain numeric codes')
	assert facade.receipt_query is None


def test_receipts_unknown_included_type():
	# Arrange:
	facade = ReceiptFacade()

	# Act:
	response = _create_client(facade).get('/api/symbol/receipts?includedReceiptTypes=1')

	# Assert:
	_assert_bad_request(response, 'includedReceiptTypes contains an unsupported receipt type')
	assert facade.receipt_query is None


def test_block_receipts_path_height():
	# Arrange:
	facade = ReceiptFacade()

	# Act:
	response = _create_client(facade).get('/api/symbol/block/1234/receipts?limit=7')

	# Assert:
	assert 200 == response.status_code
	assert ReceiptQuery(7, None, 1234, None, None, (), None, None) == facade.receipt_query


@pytest.mark.parametrize('query_parameter, parameter_name', [
	('group=inflation', 'group'),
	('receiptType=8515', 'receiptType'),
	('includedReceiptTypes=8515', 'includedReceiptTypes'),
	('excludedReceiptTypes=8515', 'excludedReceiptTypes'),
	('targetAddress=' + TEST_ADDRESS, 'targetAddress'),
	('senderAddress=' + TEST_ADDRESS, 'senderAddress'),
	('height=1234', 'height'),
	('recipientAddress=' + TEST_ADDRESS, 'recipientAddress')
])
def test_block_rejects_filter(query_parameter, parameter_name):
	# Arrange:
	facade = ReceiptFacade()

	# Act:
	response = _create_client(facade).get('/api/symbol/block/1234/receipts?' + query_parameter)

	# Assert:
	_assert_bad_request(response, 'Unsupported query parameter: ' + parameter_name)
	assert facade.receipt_query is None


def test_block_receipts_bad_height():
	# Arrange:
	facade = ReceiptFacade()

	# Act:
	response = _create_client(facade).get('/api/symbol/block/0/receipts')

	# Assert:
	_assert_bad_request(response, 'Height must be greater than or equal to 1')
	assert facade.receipt_query is None


@pytest.mark.parametrize('query_parameter, parameter_name', [
	('height=1234', 'height'),
	('excludedReceiptTypes=8515', 'excludedReceiptTypes'),
	('recipientAddress=' + TEST_ADDRESS, 'recipientAddress')
])
def test_receipts_rejects_prohibited(query_parameter, parameter_name):
	# Arrange:
	facade = ReceiptFacade()

	# Act:
	response = _create_client(facade).get('/api/symbol/receipts?' + query_parameter)

	# Assert:
	_assert_bad_request(response, 'Unsupported query parameter: ' + parameter_name)
	assert facade.receipt_query is None


def test_receipts_repeated_scalar():
	# Arrange:
	facade = ReceiptFacade()

	# Act:
	response = _create_client(facade).get('/api/symbol/receipts?limit=1&limit=2')

	# Assert:
	_assert_bad_request(response, 'limit must not be repeated')
	assert facade.receipt_query is None


def test_receipts_rejects_comma_types():
	# Arrange:
	facade = ReceiptFacade()

	# Act:
	response = _create_client(facade).get('/api/symbol/receipts?includedReceiptTypes=12616,8776')

	# Assert:
	_assert_bad_request(response, 'includedReceiptTypes must use repeated query parameters')
	assert facade.receipt_query is None


def test_receipts_conflicting_types():
	# Arrange:
	facade = ReceiptFacade()

	# Act:
	response = _create_client(facade).get('/api/symbol/receipts?receiptType=8515&includedReceiptTypes=8515')

	# Assert:
	_assert_bad_request(response, 'receiptType and includedReceiptTypes cannot be combined')
	assert facade.receipt_query is None


def test_receipts_group_mismatch():
	# Arrange:
	facade = ReceiptFacade()

	# Act:
	response = _create_client(facade).get('/api/symbol/receipts?group=inflation&receiptType=8515')

	# Assert:
	_assert_bad_request(response, 'receiptType does not belong to group')
	assert facade.receipt_query is None


def test_receipts_bad_address():
	# Arrange:
	facade = ReceiptFacade()

	# Act:
	response = _create_client(facade).get('/api/symbol/receipts?targetAddress=invalid')

	# Assert:
	_assert_bad_request(response, 'targetAddress is invalid')
	assert facade.receipt_query is None


def test_receipts_bad_address_length():
	# Arrange:
	facade = ReceiptFacade()

	# Act:
	response = _create_client(facade).get('/api/symbol/receipts?targetAddress=' + TEST_ADDRESS[:-1])

	# Assert:
	_assert_bad_request(response, 'targetAddress is invalid')
	assert facade.receipt_query is None


def test_receipts_bad_address_checksum():
	# Arrange:
	facade = ReceiptFacade()
	last_character = 'A' if TEST_ADDRESS[-1] != 'A' else 'B'
	bad_address = TEST_ADDRESS[:-1] + last_character

	# Act:
	response = _create_client(facade).get('/api/symbol/receipts?targetAddress=' + bad_address)

	# Assert:
	_assert_bad_request(response, 'targetAddress is invalid')
	assert facade.receipt_query is None


def test_receipts_sender_bytes():
	# Arrange:
	facade = ReceiptFacade()

	# Act:
	response = _create_client(facade).get(
		'/api/symbol/receipts?targetAddress=' + TEST_ADDRESS + '&senderAddress=' + TEST_ADDRESS)

	# Assert:
	assert 200 == response.status_code
	assert ReceiptQuery(
		10,
		None,
		None,
		None,
		None,
		(),
		bytes.fromhex('9889432DE263BB8FE88444A4DA28D3609BD8BB8FAE18AE95'),
		bytes.fromhex('9889432DE263BB8FE88444A4DA28D3609BD8BB8FAE18AE95')
	) == facade.receipt_query


def test_block_receipts_rejects_offset():
	# Arrange:
	facade = ReceiptFacade()

	# Act:
	response = _create_client(facade).get('/api/symbol/block/1234/receipts?offset=1')

	# Assert:
	_assert_bad_request(response, 'Unsupported query parameter: offset')
	assert facade.receipt_query is None


def test_receipts_returns_empty_page():
	# Arrange:
	facade = ReceiptFacade()
	facade.receipts_result = ReceiptPage((), None, 0)

	# Act:
	response = _create_client(facade).get('/api/symbol/receipts')

	# Assert:
	assert 200 == response.status_code
	assert {'data': [], 'pagination': {'nextCursor': None}} == response.json


def test_receipts_503_missing_result():
	# Arrange:
	facade = ReceiptFacade()
	facade.receipts_result = None

	# Act:
	response = _create_client(facade).get('/api/symbol/receipts')

	# Assert:
	assert 503 == response.status_code
	assert {'status': 503, 'message': 'Symbol backend data is unavailable'} == response.json


def test_receipts_503_unavailable():
	# Arrange:
	facade = ReceiptFacade()
	facade.receipts_error = ReceiptDataUnavailableError()

	# Act:
	response = _create_client(facade).get('/api/symbol/receipts')

	# Assert:
	assert 503 == response.status_code
	assert {'status': 503, 'message': 'Symbol backend data is unavailable'} == response.json


def test_block_receipts_503_unavailable():
	# Arrange:
	facade = ReceiptFacade()
	facade.receipts_error = ReceiptDataUnavailableError()

	# Act:
	response = _create_client(facade).get('/api/symbol/block/1234/receipts')

	# Assert:
	assert 503 == response.status_code
	assert {'status': 503, 'message': 'Symbol backend data is unavailable'} == response.json


def test_block_receipts_missing_result():
	# Arrange:
	facade = ReceiptFacade()
	facade.receipts_result = None

	# Act:
	response = _create_client(facade).get('/api/symbol/block/1234/receipts')

	# Assert:
	assert 503 == response.status_code
	assert {'status': 503, 'message': 'Symbol backend data is unavailable'} == response.json


def test_receipts_maps_database_error():
	# Arrange:
	facade = ReceiptFacade()
	facade.receipts_error = OperationalError('database unavailable')

	# Act:
	response = _create_client(facade).get('/api/symbol/receipts')

	# Assert:
	assert 503 == response.status_code
	assert {'status': 503, 'message': 'Symbol backend data is unavailable'} == response.json


def _encode_payload(payload):
	return base64.urlsafe_b64encode(json.dumps(payload, sort_keys=True, separators=(',', ':')).encode('utf-8')).decode('ascii').rstrip('=')


def _valid_cursor_for_default_query(facade, path='/api/symbol/receipts'):
	facade.receipts_result = ReceiptPage(({'height': 2},), ReceiptPosition(2, 9), 3)
	response = _create_client(facade).get(path + '?limit=1')
	assert response.status_code == 200
	facade.receipt_query = None
	return response.json['pagination']['nextCursor']


def test_receipts_page_has_cursor():
	# Arrange:
	facade = ReceiptFacade()
	facade.receipts_result = ReceiptPage(({'height': 5},), ReceiptPosition(5, 44), 3)

	# Act:
	response = _create_client(facade).get('/api/symbol/receipts?limit=1')

	# Assert:
	assert 200 == response.status_code
	assert response.json == {
		'data': [{'height': 5}],
		'pagination': {'nextCursor': response.json['pagination']['nextCursor']}
	}
	assert response.json['pagination']['nextCursor']
	assert '=' not in response.json['pagination']['nextCursor']


def test_receipts_cursor_ignores_limit():
	# Arrange:
	facade = ReceiptFacade()
	cursor = _valid_cursor_for_default_query(facade)
	facade.receipts_result = ReceiptPage((), None, 3)

	# Act:
	response = _create_client(facade).get('/api/symbol/receipts?limit=5&cursor=' + cursor)

	# Assert:
	assert 200 == response.status_code
	assert {'data': [], 'pagination': {'nextCursor': None}} == response.json
	assert facade.receipt_query.limit == 5
	assert facade.receipt_query.cursor.revision == 3
	assert facade.receipt_query.cursor.height == 2
	assert facade.receipt_query.cursor.id == 9


def test_receipts_cursor_reordered():
	# Arrange:
	facade = ReceiptFacade()
	facade.receipts_result = ReceiptPage(({'height': 2},), ReceiptPosition(2, 9), 3)
	client = _create_client(facade)
	first_response = client.get(
		'/api/symbol/receipts?limit=1&group=balanceChange&'
		'includedReceiptTypes=8776&includedReceiptTypes=12616&includedReceiptTypes=8776')
	cursor = first_response.json['pagination']['nextCursor']
	facade.receipt_query = None
	facade.receipts_result = ReceiptPage((), None, 3)

	# Act:
	response = client.get(
		'/api/symbol/receipts?limit=5&cursor=' + cursor + '&group=balanceChange&'
		'includedReceiptTypes=12616&includedReceiptTypes=8776&includedReceiptTypes=12616')

	# Assert:
	assert 200 == first_response.status_code
	assert {'data': [{'height': 2}], 'pagination': {'nextCursor': cursor}} == first_response.json
	assert 200 == response.status_code
	assert {'data': [], 'pagination': {'nextCursor': None}} == response.json
	assert ReceiptQuery(
		5,
		decode_receipt_cursor(cursor),
		None,
		'balanceChange',
		None,
		('lockHashCompleted', 'lockHashCreated'),
		None,
		None
	) == facade.receipt_query


@pytest.mark.parametrize('parameter', ['pageSize=1', 'sort=desc', 'unknown=value'])
def test_receipts_rejects_unknown_query(parameter):
	# Arrange:
	facade = ReceiptFacade()

	# Act:
	response = _create_client(facade).get('/api/symbol/receipts?' + parameter)

	# Assert:
	_assert_bad_request(response, 'Unsupported query parameter: ' + parameter.split('=', 1)[0])
	assert facade.receipt_query is None


def test_receipts_rejects_duplicate():
	# Arrange:
	facade = ReceiptFacade()

	# Act:
	response = _create_client(facade).get('/api/symbol/receipts?cursor=a&cursor=b')

	# Assert:
	_assert_bad_request(response, 'cursor must not be repeated')
	assert facade.receipt_query is None


@pytest.mark.parametrize('cursor', ['', 'not-base64', 'A'])
def test_receipts_rejects_bad_base64(cursor):
	# Arrange:
	facade = ReceiptFacade()

	# Act:
	response = _create_client(facade).get('/api/symbol/receipts?cursor=' + cursor)

	# Assert:
	_assert_bad_request(response, 'Invalid receipt cursor')
	assert facade.receipt_query is None


@pytest.mark.parametrize('cursor', [
	base64.urlsafe_b64encode(b'\xff').decode('ascii').rstrip('='),
	_encode_payload({'v': 1}),
	_encode_payload({'v': 2, 'scope': 'receipts', 'network': 'testnet', 'revision': '0', 'height': '1', 'id': '1', 'filterHash': '0' * 64})
])
def test_receipts_rejects_bad_payload(cursor):
	# Arrange:
	facade = ReceiptFacade()

	# Act:
	response = _create_client(facade).get('/api/symbol/receipts?cursor=' + cursor)

	# Assert:
	_assert_bad_request(response, 'Invalid receipt cursor')
	assert facade.receipt_query is None


@pytest.mark.parametrize('field, value', [
	('scope', []),
	('scope', {}),
	('network', []),
	('network', {})
])
def test_receipts_rejects_container(field, value):
	# Arrange:
	facade = ReceiptFacade()
	payload = {
		'v': 1, 'scope': 'receipts', 'network': 'testnet', 'revision': '0', 'height': '1', 'id': '1',
		'filterHash': '0' * 64
	}
	payload[field] = value

	# Act:
	response = _create_client(facade).get('/api/symbol/receipts?cursor=' + _encode_payload(payload))

	# Assert:
	_assert_bad_request(response, 'Invalid receipt cursor')
	assert facade.receipt_query is None


def test_receipts_rejects_long_cursor():
	# Arrange:
	facade = ReceiptFacade()
	cursor = 'A' * (MAX_RECEIPT_CURSOR_LENGTH + 1)

	# Act:
	response = _create_client(facade).get('/api/symbol/receipts?cursor=' + cursor)

	# Assert:
	_assert_bad_request(response, 'Invalid receipt cursor')
	assert facade.receipt_query is None


def test_receipts_rejects_extra_key():
	# Arrange:
	facade = ReceiptFacade()
	payload = {
		'v': 1, 'scope': 'receipts', 'network': 'testnet', 'revision': '0', 'height': '1', 'id': '1',
		'filterHash': '0' * 64, 'extra': 1
	}

	# Act:
	response = _create_client(facade).get('/api/symbol/receipts?cursor=' + _encode_payload(payload))

	# Assert:
	_assert_bad_request(response, 'Invalid receipt cursor')
	assert facade.receipt_query is None


@pytest.mark.parametrize('field_value', ['x', '-1', '9223372036854775808'])
def test_receipts_rejects_bad_revision(field_value):
	# Arrange:
	facade = ReceiptFacade()
	payload = {
		'v': 1, 'scope': 'receipts', 'network': 'testnet', 'revision': field_value, 'height': '1', 'id': '1',
		'filterHash': '0' * 64
	}

	# Act:
	response = _create_client(facade).get('/api/symbol/receipts?cursor=' + _encode_payload(payload))

	# Assert:
	_assert_bad_request(response, 'Invalid receipt cursor')
	assert facade.receipt_query is None


@pytest.mark.parametrize('field, value', [
	('height', '0'), ('height', '-1'), ('height', '9223372036854775808'),
	('id', '0'), ('id', '-1'), ('id', '9223372036854775808')
])
def test_receipts_rejects_bad_position(field, value):
	# Arrange:
	facade = ReceiptFacade()
	payload = {'v': 1, 'scope': 'receipts', 'network': 'testnet', 'revision': '0', 'height': '1', 'id': '1', 'filterHash': '0' * 64}
	payload[field] = value

	# Act:
	response = _create_client(facade).get('/api/symbol/receipts?cursor=' + _encode_payload(payload))

	# Assert:
	_assert_bad_request(response, 'Invalid receipt cursor')
	assert facade.receipt_query is None


@pytest.mark.parametrize('field_hash', ['A' * 64, '0' * 63, 'g' * 64])
def test_receipts_rejects_bad_filter(field_hash):
	# Arrange:
	facade = ReceiptFacade()
	payload = {'v': 1, 'scope': 'receipts', 'network': 'testnet', 'revision': '0', 'height': '1', 'id': '1', 'filterHash': field_hash}

	# Act:
	response = _create_client(facade).get('/api/symbol/receipts?cursor=' + _encode_payload(payload))

	# Assert:
	_assert_bad_request(response, 'Invalid receipt cursor')
	assert facade.receipt_query is None


def test_receipts_rejects_bool_version():
	# Arrange:
	facade = ReceiptFacade()
	payload = {'v': True, 'scope': 'receipts', 'network': 'testnet', 'revision': '0', 'height': '1', 'id': '1', 'filterHash': '0' * 64}

	# Act:
	response = _create_client(facade).get('/api/symbol/receipts?cursor=' + _encode_payload(payload))

	# Assert:
	_assert_bad_request(response, 'Invalid receipt cursor')
	assert facade.receipt_query is None


def test_receipts_rejects_scope_mismatch():
	# Arrange:
	facade = ReceiptFacade()
	block_cursor = _valid_cursor_for_default_query(facade, '/api/symbol/block/2/receipts')

	# Act:
	response = _create_client(facade).get('/api/symbol/receipts?cursor=' + block_cursor)

	# Assert:
	_assert_bad_request(response, 'Receipt cursor scope mismatch')
	assert facade.receipt_query is None


def test_receipts_filter_mismatch():
	# Arrange:
	facade = ReceiptFacade()
	valid_cursor = _valid_cursor_for_default_query(facade)

	# Act:
	response = _create_client(facade).get('/api/symbol/receipts?cursor=' + valid_cursor + '&group=inflation')

	# Assert:
	_assert_bad_request(response, 'Receipt cursor filter mismatch')
	assert facade.receipt_query is None


def test_receipts_network_mismatch():
	# Arrange:
	facade = ReceiptFacade()
	payload = {'v': 1, 'scope': 'receipts', 'network': 'mainnet', 'revision': '0', 'height': '1', 'id': '1', 'filterHash': '0' * 64}

	# Act:
	response = _create_client(facade).get('/api/symbol/receipts?cursor=' + _encode_payload(payload))

	# Assert:
	_assert_bad_request(response, 'Receipt cursor network mismatch')
	assert facade.receipt_query is None


def test_block_cursor_rejects_path():
	# Arrange:
	facade = ReceiptFacade()
	cursor = _valid_cursor_for_default_query(facade, '/api/symbol/block/2/receipts')

	# Act:
	response = _create_client(facade).get('/api/symbol/block/3/receipts?cursor=' + cursor)

	# Assert:
	_assert_bad_request(response, 'Receipt cursor block height mismatch')
	assert facade.receipt_query is None


def test_receipts_hides_internal_details():
	# Arrange:
	facade = ReceiptFacade()
	stale_error = ReceiptCursorStaleError()
	stale_error.args = ('internal cursor details',)
	facade.receipts_error = stale_error

	# Act:
	response = _create_client(facade).get('/api/symbol/receipts')

	# Assert:
	assert 409 == response.status_code
	assert {'status': 409, 'message': 'Receipt cursor is stale'} == response.json
