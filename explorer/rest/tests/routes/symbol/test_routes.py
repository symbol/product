from flask import Flask
from psycopg2 import OperationalError

from rest import setup_error_handlers
from rest.db.SymbolDatabase import ReceiptQuery, SortOrder, SymbolDataUnavailable
from rest.routes.symbol import setup_symbol_routes


class SymbolBlockFacade:  # pylint: disable=too-many-instance-attributes
	def __init__(self):
		self.blocks_result = [{'height': 2}]
		self.block_result = {'height': 2}
		self.database_available = True
		self.blocks_query = None
		self.height = None
		self.blocks_error = None
		self.block_error = None
		self.receipts_result = [{'version': 1}]
		self.receipts_query = None
		self.receipts_error = None

	@staticmethod
	def get_health():
		return {'isHealthy': True, 'errors': []}

	def get_blocks(self, from_height, limit, sort):
		if not self.database_available:
			return None
		self.blocks_query = (from_height, limit, sort)
		if self.blocks_error:
			raise self.blocks_error

		return self.blocks_result

	def get_block(self, height):
		if not self.database_available:
			return None
		self.height = height
		if self.block_error:
			raise self.block_error

		return self.block_result

	def is_database_available(self):
		return self.database_available

	def get_receipts(self, query):
		if not self.database_available:
			return None
		self.receipts_query = query
		if self.receipts_error:
			raise self.receipts_error

		return self.receipts_result


def _create_symbol_test_client(facade):
	app = Flask(__name__)
	setup_error_handlers(app)
	setup_symbol_routes(app, facade)

	return app.test_client()


def _assert_symbol_backend_unavailable_response(response):
	assert 503 == response.status_code
	assert {
		'status': 503,
		'message': 'Symbol backend data is unavailable'
	} == response.json


def _assert_bad_request_response(response, expected_message):
	assert 400 == response.status_code
	assert {
		'status': 400,
		'message': expected_message
	} == response.json


def _assert_not_found_response(response):
	assert 404 == response.status_code
	assert {
		'status': 404,
		'message': 'Resource not found'
	} == response.json


def test_blocks_uses_cursor_sort():
	# Arrange:
	facade = SymbolBlockFacade()
	blocks_url = '/api/symbol/blocks?limit=5&fromHeight=10&sort=asc'

	# Act:
	response = _create_symbol_test_client(facade).get(blocks_url)

	# Assert:
	assert 200 == response.status_code
	assert [{'height': 2}] == response.json
	assert (10, 5, SortOrder.ASC) == facade.blocks_query


def test_blocks_rejects_limit():
	# Arrange:
	client = _create_symbol_test_client(SymbolBlockFacade())

	# Act + Assert:
	_assert_bad_request_response(
		client.get('/api/symbol/blocks?limit=101'),
		'Limit must be between 1 and 100')


def test_blocks_rejects_zero_limit():
	# Arrange:
	client = _create_symbol_test_client(SymbolBlockFacade())

	# Act + Assert:
	_assert_bad_request_response(
		client.get('/api/symbol/blocks?limit=0'),
		'Limit must be between 1 and 100')


def test_blocks_rejects_from_height():
	# Arrange:
	client = _create_symbol_test_client(SymbolBlockFacade())

	# Act + Assert:
	_assert_bad_request_response(
		client.get('/api/symbol/blocks?fromHeight=0'),
		'fromHeight must be greater than or equal to 1')


def test_blocks_rejects_sort():
	# Arrange:
	client = _create_symbol_test_client(SymbolBlockFacade())

	# Act + Assert:
	_assert_bad_request_response(
		client.get('/api/symbol/blocks?sort=height'),
		'Sort must be either ASC or DESC')


def test_blocks_rejects_offset():
	# Arrange:
	client = _create_symbol_test_client(SymbolBlockFacade())

	# Act + Assert:
	_assert_bad_request_response(
		client.get('/api/symbol/blocks?offset=1'),
		'Unsupported query parameter: offset')


def test_blocks_rejects_page_number():
	# Arrange:
	client = _create_symbol_test_client(SymbolBlockFacade())

	# Act + Assert:
	_assert_bad_request_response(
		client.get('/api/symbol/blocks?pageNumber=1'),
		'Unsupported query parameter: pageNumber')


def test_blocks_rejects_page_size():
	# Arrange:
	client = _create_symbol_test_client(SymbolBlockFacade())

	# Act + Assert:
	_assert_bad_request_response(
		client.get('/api/symbol/blocks?pageSize=10'),
		'Unsupported query parameter: pageSize')


def test_blocks_503_unreadable():
	# Arrange:
	facade = SymbolBlockFacade()
	facade.blocks_error = SymbolDataUnavailable()

	# Act:
	response = _create_symbol_test_client(facade).get('/api/symbol/blocks')

	# Assert:
	_assert_symbol_backend_unavailable_response(response)
	assert (None, 10, SortOrder.DESC) == facade.blocks_query


def test_blocks_503_when_db_unavailable():
	# Arrange:
	facade = SymbolBlockFacade()
	facade.database_available = False

	# Act:
	response = _create_symbol_test_client(facade).get('/api/symbol/blocks')

	# Assert:
	_assert_symbol_backend_unavailable_response(response)


def test_blocks_503_when_db_read_fails():
	# Arrange:
	facade = SymbolBlockFacade()
	facade.blocks_error = OperationalError('database unavailable')

	# Act:
	response = _create_symbol_test_client(facade).get('/api/symbol/blocks')

	# Assert:
	_assert_symbol_backend_unavailable_response(response)


def test_block_detail():
	# Arrange:
	facade = SymbolBlockFacade()

	# Act:
	response = _create_symbol_test_client(facade).get('/api/symbol/block/2')

	# Assert:
	assert 200 == response.status_code
	assert {'height': 2} == response.json
	assert 2 == facade.height


def test_block_404_when_db_unavailable():
	# Arrange:
	facade = SymbolBlockFacade()
	facade.database_available = False

	# Act:
	response = _create_symbol_test_client(facade).get('/api/symbol/block/2')

	# Assert:
	assert 404 == response.status_code
	assert {'status': 404, 'message': 'Resource not found'} == response.json
	assert facade.height is None


def test_block_503_unreadable():
	# Arrange:
	facade = SymbolBlockFacade()
	facade.block_error = SymbolDataUnavailable()

	# Act:
	response = _create_symbol_test_client(facade).get('/api/symbol/block/2')

	# Assert:
	_assert_symbol_backend_unavailable_response(response)
	assert 2 == facade.height


def test_block_503_when_db_read_fails():
	# Arrange:
	facade = SymbolBlockFacade()
	facade.block_error = OperationalError('database unavailable')

	# Act:
	response = _create_symbol_test_client(facade).get('/api/symbol/block/2')

	# Assert:
	_assert_symbol_backend_unavailable_response(response)


def test_block_rejects_zero_height():
	# Arrange:
	client = _create_symbol_test_client(SymbolBlockFacade())

	# Act + Assert:
	_assert_bad_request_response(
		client.get('/api/symbol/block/0'),
		'Height must be greater than or equal to 1')


def test_block_rejects_bad_height():
	# Arrange:
	client = _create_symbol_test_client(SymbolBlockFacade())

	# Act + Assert:
	_assert_bad_request_response(
		client.get('/api/symbol/block/not-a-height'),
		"invalid literal for int() with base 10: 'not-a-height'")


def test_block_returns_404():
	# Arrange:
	facade = SymbolBlockFacade()
	facade.block_result = None
	client = _create_symbol_test_client(facade)

	# Act + Assert:
	_assert_not_found_response(client.get('/api/symbol/block/999'))


def test_receipts_uses_default_query():
	# Arrange:
	facade = SymbolBlockFacade()

	# Act:
	response = _create_symbol_test_client(facade).get('/api/symbol/receipts')

	# Assert:
	assert 200 == response.status_code
	assert [{'version': 1}] == response.json
	assert ReceiptQuery(limit=10, offset=0) == facade.receipts_query


def test_receipts_normalizes_filters():
	# Arrange:
	facade = SymbolBlockFacade()
	target_address = 'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI'

	# Act:
	response = _create_symbol_test_client(facade).get(
		'/api/symbol/receipts?limit=25&offset=100000&group=balanceChange'
		'&includedReceiptTypes=12616&includedReceiptTypes=8776&targetAddress=' + target_address)

	# Assert:
	assert 200 == response.status_code
	assert ReceiptQuery(
		25,
		100000,
		None,
		'balanceChange',
		None,
		('lockHashCreated', 'lockHashCompleted'),
		bytes.fromhex('9889432DE263BB8FE88444A4DA28D3609BD8BB8FAE18AE95'),
		None) == facade.receipts_query


def test_block_receipts_path_pagination():
	# Arrange:
	facade = SymbolBlockFacade()

	# Act:
	response = _create_symbol_test_client(facade).get('/api/symbol/block/12/receipts?limit=2&offset=100')

	# Assert:
	assert 200 == response.status_code
	assert ReceiptQuery(2, 100, 12, None, None, (), None, None) == facade.receipts_query


def test_receipts_accept_limit_100():
	# Arrange:
	# Exercise both public receipt routes through their shared query parser.
	endpoints = (
		'/api/symbol/receipts?limit=100',
		'/api/symbol/block/12/receipts?limit=100'
	)

	# Act + Assert:
	for endpoint in endpoints:
		facade = SymbolBlockFacade()
		response = _create_symbol_test_client(facade).get(endpoint)
		assert 200 == response.status_code, endpoint
		assert 100 == facade.receipts_query.limit, endpoint


def test_receipts_reject_bad_pagination():
	# Arrange:
	facade = SymbolBlockFacade()
	client = _create_symbol_test_client(facade)

	# Act + Assert:
	for query in ('limit=0', 'limit=-1', 'limit=101', 'limit=not-an-integer', 'offset=-1', 'offset=100001', 'offset=not-an-integer'):
		response = client.get(f'/api/symbol/receipts?{query}')
		_assert_bad_request_response(response, {
			'limit=0': 'limit must be between 1 and 100',
			'limit=-1': 'limit must be between 1 and 100',
			'limit=101': 'limit must be between 1 and 100',
			'limit=not-an-integer': 'limit must be an integer',
			'offset=-1': 'offset must be between 0 and 100000',
			'offset=100001': 'offset must be between 0 and 100000',
			'offset=not-an-integer': 'offset must be an integer'
		}[query])
		assert facade.receipts_query is None, query


def test_block_receipts_offset_boundary():
	# Arrange:
	facade = SymbolBlockFacade()
	client = _create_symbol_test_client(facade)

	# Act:
	accepted_response = client.get('/api/symbol/block/12/receipts?offset=100000')
	rejected_response = client.get('/api/symbol/block/12/receipts?offset=100001')

	# Assert:
	assert 200 == accepted_response.status_code
	assert 100000 == facade.receipts_query.offset
	_assert_bad_request_response(rejected_response, 'offset must be between 0 and 100000')


def test_receipts_reject_legacy_params():
	# Arrange:
	client = _create_symbol_test_client(SymbolBlockFacade())

	# Act + Assert:
	for parameter in ('cursor', 'pageNumber', 'pageSize'):
		_assert_bad_request_response(
			client.get(f'/api/symbol/receipts?{parameter}=1'),
			f'Unsupported query parameter: {parameter}')


def test_block_receipts_reject_filters():
	# Arrange:
	client = _create_symbol_test_client(SymbolBlockFacade())

	# Act + Assert:
	for parameter in (
		'unknown', 'group', 'receiptType', 'includedReceiptTypes', 'targetAddress', 'senderAddress',
		'height', 'excludedReceiptTypes', 'recipientAddress'):
		_assert_bad_request_response(
			client.get(f'/api/symbol/block/12/receipts?{parameter}=1'),
			f'Unsupported query parameter: {parameter}')


def test_receipts_reject_unknown_params():
	# Arrange:
	client = _create_symbol_test_client(SymbolBlockFacade())

	# Act + Assert:
	for parameter in ('height', 'excludedReceiptTypes', 'recipientAddress', 'unknown'):
		_assert_bad_request_response(
			client.get(f'/api/symbol/receipts?{parameter}=1'),
			f'Unsupported query parameter: {parameter}')


def test_receipts_reject_duplicates():
	# Arrange:
	facade = SymbolBlockFacade()
	client = _create_symbol_test_client(facade)

	# Act + Assert:
	for parameter in ('limit', 'offset', 'group', 'receiptType', 'targetAddress', 'senderAddress'):
		_assert_bad_request_response(
			client.get(f'/api/symbol/receipts?{parameter}=1&{parameter}=2'),
			f'{parameter} must not be repeated')

	assert facade.receipts_query is None


def test_receipts_reject_comma_types():
	# Arrange:
	facade = SymbolBlockFacade()

	# Act:
	response = _create_symbol_test_client(facade).get('/api/symbol/receipts?includedReceiptTypes=12616,8776')

	# Assert:
	_assert_bad_request_response(response, 'includedReceiptTypes must be repeated query parameters')
	assert facade.receipts_query is None


def test_receipts_reject_type_conflict():
	# Arrange:
	facade = SymbolBlockFacade()

	# Act:
	response = _create_symbol_test_client(facade).get(
		'/api/symbol/receipts?receiptType=12616&includedReceiptTypes=8776')

	# Assert:
	_assert_bad_request_response(response, 'receiptType and includedReceiptTypes cannot be used together')
	assert facade.receipts_query is None


def test_receipts_reject_group_mismatch():
	# Arrange:
	client = _create_symbol_test_client(SymbolBlockFacade())

	# Act + Assert:
	for query in (
		'group=balanceChange&receiptType=4685',
		'group=balanceChange&includedReceiptTypes=4685',
		'group=balanceTransfer&includedReceiptTypes=4685&includedReceiptTypes=12616'
	):
		_assert_bad_request_response(client.get(f'/api/symbol/receipts?{query}'), 'Receipt type does not belong to group')


def test_receipts_reject_invalid_values():
	# Arrange:
	facade = SymbolBlockFacade()
	client = _create_symbol_test_client(facade)

	# Act + Assert:
	for query, error in (
		('group=unknown', 'Invalid receipt group'),
		('receiptType=999', 'Unsupported receipt type'),
		('receiptType=not-an-integer', 'Receipt type must be an integer'),
		('receiptType=12616,8776', 'Receipt type must be an integer'),
		('targetAddress=INVALID', 'Invalid targetAddress'),
		('targetAddress=ND43EI7FXCHVNOBA3PFFTGM4GP2VUAUFX72OASA', 'Invalid targetAddress'),
		('senderAddress=ND43EI7FXCHVNOBA3PFFTGM4GP2VUAUFX72OASA', 'Invalid senderAddress')
	):
		response = client.get(f'/api/symbol/receipts?{query}')
		_assert_bad_request_response(response, error)
		assert facade.receipts_query is None, query


def test_receipts_map_unavailable():
	# Arrange:
	facade = SymbolBlockFacade()
	client = _create_symbol_test_client(facade)

	# Act:
	facade.receipts_result = None
	none_response = client.get('/api/symbol/receipts')
	facade.receipts_result = [{'version': 1}]
	facade.receipts_error = OperationalError('database unavailable')
	error_response = client.get('/api/symbol/receipts')

	# Assert:
	_assert_symbol_backend_unavailable_response(none_response)
	_assert_symbol_backend_unavailable_response(error_response)


def test_block_receipts_map_503_or_404():
	# Arrange:
	facade = SymbolBlockFacade()
	facade.receipts_result = None
	client = _create_symbol_test_client(facade)

	# Act:
	not_found_response = client.get('/api/symbol/block/12/receipts')
	facade.database_available = False
	unavailable_response = client.get('/api/symbol/block/12/receipts')

	# Assert:
	_assert_not_found_response(not_found_response)
	_assert_symbol_backend_unavailable_response(unavailable_response)


def test_block_receipts_bad_height():
	# Arrange:
	client = _create_symbol_test_client(SymbolBlockFacade())

	# Act + Assert:
	_assert_bad_request_response(
		client.get('/api/symbol/block/0/receipts'),
		'Height must be greater than or equal to 1')
	_assert_bad_request_response(
		client.get('/api/symbol/block/not-a-height/receipts'),
		"invalid literal for int() with base 10: 'not-a-height'")
