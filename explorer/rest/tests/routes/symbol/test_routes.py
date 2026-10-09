# pylint: disable=too-many-lines

import pytest
from flask import Flask
from psycopg2 import OperationalError
from symbolchain.CryptoTypes import PublicKey
from symbolchain.sc import TransactionType
from symbolchain.symbol.Network import Network

from rest import setup_error_handlers
from rest.db.SymbolDatabase import (
	AccountListQuery,
	AccountSortField,
	ReceiptQuery,
	SortOrder,
	SymbolDataUnavailable,
	SymbolMosaicAliasNotFound,
	TransactionQuery
)
from rest.model.symbol.validation import SymbolDataInvalid
from rest.routes.symbol import setup_symbol_routes


class SymbolBlockFacade:  # pylint: disable=too-many-instance-attributes
	def __init__(self):
		self.blocks_result = [{'height': 2}]
		self.block_result = {'height': 2}
		self.blocks_query = None
		self.height = None
		self.blocks_error = None
		self.block_error = None
		self.receipts_result = [{'version': 1}]
		self.receipts_query = None
		self.receipts_error = None
		self.transactions_result = []
		self.transactions_query = None
		self.transactions_error = None

	@staticmethod
	def get_health():
		return {'isHealthy': True, 'errors': []}

	def get_blocks(self, from_height, limit, sort):
		self.blocks_query = (from_height, limit, sort)
		if self.blocks_error:
			raise self.blocks_error

		return self.blocks_result

	def get_block(self, height):
		self.height = height
		if self.block_error:
			raise self.block_error

		return self.block_result

	def get_receipts(self, query):
		self.receipts_query = query
		if self.receipts_error:
			raise self.receipts_error

		return self.receipts_result

	def get_transactions(self, query):
		self.transactions_query = query
		if self.transactions_error:
			raise self.transactions_error

		return self.transactions_result


class SymbolAccountFacade:  # pylint: disable=too-many-instance-attributes
	"""Recording facade for Account and Multisig route validation tests."""

	def __init__(self):
		self.network = Network.TESTNET
		self.account_query = None
		self.multisig_query = None
		self.account_result = {'address': 'TDUMMY'}
		self.multisig_result = {'minApproval': 1}
		self.account_error = None
		self.multisig_error = None
		self.accounts_query = None
		self.accounts_result = [{'address': 'TDUMMY'}]
		self.accounts_error = None

	def get_accounts(self, query):
		self.accounts_query = query
		if self.accounts_error:
			raise self.accounts_error

		return self.accounts_result

	def get_account(self, address, public_key):
		self.account_query = (address, public_key)
		if self.account_error:
			raise self.account_error
		return self.account_result

	def get_multisig(self, address):
		self.multisig_query = address
		if self.multisig_error:
			raise self.multisig_error
		return self.multisig_result


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


def test_account_address_bytes():
	# Arrange:
	facade = SymbolAccountFacade()
	address = 'TD6TLAMJMDD3DC3S6SNFLGH2T5YSUNKNWM7N4VY'
	client = _create_symbol_test_client(facade)

	# Act:
	response = client.get(f'/api/symbol/account?address={address}')

	# Assert:
	assert 200 == response.status_code
	assert {'address': 'TDUMMY'} == response.json
	assert (bytes.fromhex('98FD35818960C7B18B72F49A5598FA9F712A354DB33EDE57'), None) == facade.account_query


def test_accounts_defaults():
	# Arrange:
	facade = SymbolAccountFacade()
	client = _create_symbol_test_client(facade)

	# Act:
	response = client.get('/api/symbol/accounts')

	# Assert:
	assert 200 == response.status_code
	assert [{'address': 'TDUMMY'}] == response.json
	assert AccountListQuery(AccountSortField.ID, None, 10, 0) == facade.accounts_query


def test_accounts_normalizes_query_case():
	# Arrange:
	facade = SymbolAccountFacade()
	client = _create_symbol_test_client(facade)

	# Act:
	response = client.get('/api/symbol/accounts?limit=1&offset=2&sort_field=balance&sort_order=desc&mosaic_id=abCDef0123456789')

	# Assert:
	assert 200 == response.status_code
	assert AccountListQuery(AccountSortField.BALANCE, 'ABCDEF0123456789', 1, 2) == facade.accounts_query


@pytest.mark.parametrize('sort_field', ['height', 'HEIGHT'])
def test_accounts_height_case(sort_field):
	# Arrange:
	facade = SymbolAccountFacade()
	client = _create_symbol_test_client(facade)

	# Act:
	response = client.get(f'/api/symbol/accounts?sort_field={sort_field}')

	# Assert:
	assert 200 == response.status_code
	assert AccountListQuery(AccountSortField.HEIGHT, None, 10, 0) == facade.accounts_query


@pytest.mark.parametrize('query', [
	pytest.param('limit=0', id='limit-zero'),
	pytest.param('limit=-1', id='limit-negative'),
	pytest.param('limit=101', id='limit-above-max'),
	pytest.param('limit=', id='limit-empty'),
	pytest.param('limit=abc', id='limit-noninteger'),
	pytest.param('offset=-1', id='offset-negative'),
	pytest.param('offset=100001', id='offset-above-max'),
	pytest.param('offset=', id='offset-empty'),
	pytest.param('offset=abc', id='offset-noninteger'),
	pytest.param('sort_field=unknown', id='unknown-sort-field'),
	pytest.param('sort_order=asc', id='ascending-sort'),
	pytest.param('sort_field=HEIGHT&sort_order=ASC', id='height-ascending-sort'),
	pytest.param('sort_order=unknown', id='unknown-sort-order'),
	pytest.param('sort_field=BALANCE', id='balance-missing-mosaic'),
	pytest.param('sort_field=ID&mosaic_id=1234567890ABCDEF', id='id-with-mosaic'),
	pytest.param('sort_field=IMPORTANCE&mosaic_id=1234567890ABCDEF', id='importance-with-mosaic'),
	pytest.param('sort_field=HEIGHT&mosaic_id=1234567890ABCDEF', id='height-with-mosaic'),
	pytest.param('sort_field=BALANCE&mosaic_id=0x1234567890ABCDEF', id='mosaic-hex-prefix'),
	pytest.param('sort_field=BALANCE&mosaic_id=1234567890ABCDE', id='mosaic-short'),
	pytest.param('sort_field=BALANCE&mosaic_id=1234567890ABCDEF%20', id='mosaic-trailing-space'),
	pytest.param('sort_field=BALANCE&mosaic_id=%201234567890ABCDEF', id='mosaic-leading-space'),
	pytest.param('sort_field=BALANCE&mosaic_id=1234567890ABCDEＦ', id='mosaic-nonascii-hex'),
	pytest.param('sort_field=BALANCE&mosaic_id=1234567890ABCDEF%0A', id='mosaic-newline'),
	pytest.param('sort_field=BALANCE&mosaic_id=１２３４５６７８９０ABCDEF', id='mosaic-fullwidth-digits'),
])
def test_accounts_rejects_invalid_values(query):
	# Arrange:
	facade = SymbolAccountFacade()
	client = _create_symbol_test_client(facade)

	# Act:
	response = client.get('/api/symbol/accounts?' + query)

	# Assert:
	assert 400 == response.status_code
	assert facade.accounts_query is None


def test_accounts_height_enum_error():
	# Arrange:
	facade = SymbolAccountFacade()
	client = _create_symbol_test_client(facade)

	# Act:
	response = client.get('/api/symbol/accounts?sort_field=unknown')

	# Assert:
	_assert_bad_request_response(response, 'sort_field must be ID, IMPORTANCE, HEIGHT, or BALANCE')
	assert facade.accounts_query is None


@pytest.mark.parametrize('query', [
	pytest.param('limit=1&limit=1', id='limit'),
	pytest.param('offset=0&offset=0', id='offset'),
	pytest.param('sort_field=ID&sort_field=ID', id='sort-field'),
	pytest.param('sort_order=DESC&sort_order=DESC', id='sort-order'),
	pytest.param('sort_field=BALANCE&mosaic_id=1234567890ABCDEF&mosaic_id=1234567890ABCDEF', id='mosaic-id'),
])
def test_accounts_rejects_scalar_repeats(query):
	# Arrange:
	facade = SymbolAccountFacade()
	client = _create_symbol_test_client(facade)

	# Act:
	response = client.get('/api/symbol/accounts?' + query)

	# Assert:
	assert 400 == response.status_code
	assert facade.accounts_query is None


@pytest.mark.parametrize('query', [
	pytest.param('unknown=1', id='unknown'),
	pytest.param('address=TDUMMY', id='address'),
	pytest.param('importance=1', id='importance'),
	pytest.param('is_harvesting_active=true', id='is-harvesting-active'),
	pytest.param('orderBy=ID', id='order-by'),
	pytest.param('isLatest=true', id='is-latest-camel'),
	pytest.param('isRichList=true', id='is-rich-list-camel'),
	pytest.param('is_latest=true', id='is-latest-snake'),
	pytest.param('is_rich_list=true', id='is-rich-list-snake'),
	pytest.param('pageNumber=1', id='page-number'),
	pytest.param('pageSize=1', id='page-size'),
	pytest.param('mosaicId=1234567890ABCDEF', id='mosaic-id-camel'),
	pytest.param('is_harvesting=true', id='is-harvesting'),
	pytest.param('is_eligible_for_harvesting=true', id='is-eligible-for-harvesting'),
])
def test_accounts_rejects_unknown_params(query):
	# Arrange:
	facade = SymbolAccountFacade()
	client = _create_symbol_test_client(facade)

	# Act:
	response = client.get('/api/symbol/accounts?' + query)

	# Assert:
	assert 400 == response.status_code
	assert facade.accounts_query is None


@pytest.mark.parametrize('query,expected', [
	pytest.param('limit=1&offset=0', AccountListQuery(AccountSortField.ID, None, 1, 0), id='minimum-limit-zero-offset'),
	pytest.param('limit=%2B1&offset=1_0', AccountListQuery(AccountSortField.ID, None, 1, 10), id='signed-limit-underscored-offset'),
	pytest.param(
		'limit=100&offset=100000&sort_order=DESC', AccountListQuery(AccountSortField.ID, None, 100, 100000), id='maximum-limit-offset')
])
def test_accounts_accepts_page_limits(query, expected):
	# Arrange:
	facade = SymbolAccountFacade()
	client = _create_symbol_test_client(facade)

	# Act:
	response = client.get('/api/symbol/accounts?' + query)

	# Assert:
	assert 200 == response.status_code
	assert [{'address': 'TDUMMY'}] == response.json
	assert expected == facade.accounts_query


def test_account_public_key_hex():
	# Arrange:
	facade = SymbolAccountFacade()
	client = _create_symbol_test_client(facade)

	# Act:
	response = client.get('/api/symbol/account?publicKey=' + ('aB' * 32))

	# Assert:
	assert 200 == response.status_code
	assert (None, bytes.fromhex('AB' * 32)) == facade.account_query


def test_mainnet_address_dispatch():
	# Arrange:
	facade = SymbolAccountFacade()
	facade.network = Network.MAINNET
	client = _create_symbol_test_client(facade)

	# Act:
	account_response = client.get('/api/symbol/account?address=NCUZDUB4XJ4XV3KSUBQ6NPZPP4RY3CUFZ7HNAPI')
	multisig_response = client.get('/api/symbol/account/ND6TLAMJMDD3DC3S6SNFLGH2T5YSUNKNWO7UY5Y/multisig')

	# Assert:
	assert 200 == account_response.status_code
	assert (bytes.fromhex('68A991D03CBA797AED52A061E6BF2F7F238D8A85CFCED03D'), None) == facade.account_query
	assert 200 == multisig_response.status_code
	assert bytes.fromhex('68FD35818960C7B18B72F49A5598FA9F712A354DB3BF4C77') == facade.multisig_query


def test_mainnet_rejects_bad_addresses():
	# Arrange:
	facade = SymbolAccountFacade()
	facade.network = Network.MAINNET
	client = _create_symbol_test_client(facade)
	invalid_addresses = (
		'TD6TLAMJMDD3DC3S6SNFLGH2T5YSUNKNWM7N4VY',
		'NCUZDUB4XJ4XV3KSUBQ6NPZPP4RY3CUFZ7HNAAI')

	# Act + Assert:
	for address in invalid_addresses:
		account_response = client.get(f'/api/symbol/account?address={address}')
		multisig_response = client.get(f'/api/symbol/account/{address}/multisig')
		_assert_bad_request_response(account_response, 'Invalid address')
		_assert_bad_request_response(multisig_response, 'Invalid address')
		assert None is facade.account_query
		assert None is facade.multisig_query


def test_account_query_errors():
	# Arrange:
	facade = SymbolAccountFacade()
	client = _create_symbol_test_client(facade)
	queries = (
		('', 'Exactly one of address or publicKey is required'),
		('?address=TD6TLAMJMDD3DC3S6SNFLGH2T5YSUNKNWM7N4VY&publicKey=' + '11' * 32,
			'Exactly one of address or publicKey is required'),
		('?address=', 'Invalid address'),
		('?address=TD6TLAMJMDD3DC3S6SNFLGH2T5YSUNKNWM7N4VY&address=TD6TLAMJMDD3DC3S6SNFLGH2T5YSUNKNWM7N4VY',
			'address must not be repeated'),
		('?publicKey=' + '11' * 32 + '&publicKey=' + '11' * 32, 'publicKey must not be repeated'),
		('?publicKey=' + '00' * 32, 'Invalid publicKey'),
		('?publicKey=' + '11' * 31, 'Invalid publicKey'),
		('?publicKey=', 'Invalid publicKey'),
		('?address= TD6TLAMJMDD3DC3S6SNFLGH2T5YSUNKNWM7N4VY', 'Invalid address'),
		('?address=TD6TLAMJMDD3DC3S6SNFLGH2T5YSUNKNWM7N4VY%20', 'Invalid address'),
		('?unknown=1', 'Unsupported query parameter'))

	# Act + Assert:
	for query, message in queries:
		response = client.get('/api/symbol/account' + query)
		_assert_bad_request_response(response, message)
		assert None is facade.account_query, query


def test_multisig_rejects_invalid_input():
	# Arrange:
	facade = SymbolAccountFacade()
	client = _create_symbol_test_client(facade)

	# Act + Assert:
	for path in (
		'/api/symbol/account/TD6TLAMJMDD3DC3S6SNFLGH2T5YSUNKNWM7N4VY/multisig?address=x',
		'/api/symbol/account/ND6TLAMJMDD3DC3S6SNFLGH2T5YSUNKNWO7UY5Y/multisig'):
		response = client.get(path)
		_assert_bad_request_response(response, 'Unsupported query parameter' if '?' in path else 'Invalid address')
		assert None is facade.multisig_query, path


def test_multisig_not_found():
	# Arrange:
	facade = SymbolAccountFacade()
	facade.multisig_result = None
	client = _create_symbol_test_client(facade)

	# Act:
	response = client.get('/api/symbol/account/TD6TLAMJMDD3DC3S6SNFLGH2T5YSUNKNWM7N4VY/multisig')

	# Assert:
	_assert_not_found_response(response)
	assert bytes.fromhex('98FD35818960C7B18B72F49A5598FA9F712A354DB33EDE57') == facade.multisig_query


def test_account_data_503():
	# Arrange:
	facade = SymbolAccountFacade()
	facade.account_error = SymbolDataInvalid('accounts.voting_public_keys[0].endEpoch', 'invalid integer')
	client = _create_symbol_test_client(facade)

	# Act:
	response = client.get('/api/symbol/account?publicKey=' + ('11' * 32))

	# Assert:
	_assert_symbol_backend_unavailable_response(response)


def test_multisig_data_503():
	# Arrange:
	facade = SymbolAccountFacade()
	facade.multisig_error = SymbolDataInvalid('multisig.cosignatory_addresses[0]', 'invalid address')
	client = _create_symbol_test_client(facade)

	# Act:
	response = client.get('/api/symbol/account/TD6TLAMJMDD3DC3S6SNFLGH2T5YSUNKNWM7N4VY/multisig')

	# Assert:
	_assert_symbol_backend_unavailable_response(response)


def test_account_unexpected_error_is_500():
	# Arrange:
	facade = SymbolAccountFacade()
	facade.account_error = RuntimeError('unexpected programming error')
	client = _create_symbol_test_client(facade)

	# Act:
	response = client.get('/api/symbol/account?publicKey=' + ('11' * 32))

	# Assert:
	assert 500 == response.status_code


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


def test_receipts_map_db_error_to_503():
	# Arrange:
	facade = SymbolBlockFacade()
	client = _create_symbol_test_client(facade)

	# Act:
	facade.receipts_error = OperationalError('database unavailable')
	error_response = client.get('/api/symbol/receipts')

	# Assert:
	_assert_symbol_backend_unavailable_response(error_response)


def test_transactions_default_empty():
	# Arrange:
	facade = SymbolBlockFacade()

	# Act:
	response = _create_symbol_test_client(facade).get('/api/symbol/transactions')

	# Assert:
	assert 200 == response.status_code
	assert [] == response.json
	assert TransactionQuery() == facade.transactions_query


def test_transactions_embedded_false():
	# Arrange:
	facade = SymbolBlockFacade()

	# Act:
	response = _create_symbol_test_client(facade).get('/api/symbol/transactions?embedded=FALSE')

	# Assert:
	assert 200 == response.status_code
	assert facade.transactions_query.include_embedded is False


def test_transactions_parsed_filters():
	# Arrange:
	facade = SymbolBlockFacade()
	mainnet_address = Network.NETWORKS[0].public_key_to_address(PublicKey('00' * 32))
	public_key = 'AB' * 32

	# Act:
	response = _create_symbol_test_client(facade).get(
		'/api/symbol/transactions?limit=%20%2B001&offset=%20000&height=%20%2B0001'
		f'&type={TransactionType.TRANSFER.value}&type={TransactionType.AGGREGATE_COMPLETE.value}'
		f'&signerPublicKey={public_key}&recipientAddress={mainnet_address}'
		'&transferMosaicId=72c0212e67a08bce&embedded=TrUe&order=desc')

	# Assert:
	assert 200 == response.status_code
	assert TransactionQuery(
		limit=1,
		offset=0,
		height=1,
		transaction_types=(TransactionType.TRANSFER.value, TransactionType.AGGREGATE_COMPLETE.value),
		address=None,
		signer_public_key=bytes.fromhex(public_key),
		recipient_address=bytes.fromhex('682F0A4E106CBC9224DF7AC5E2C6A9D5252E70CB6517D829'),
		transfer_mosaic_id='72C0212E67A08BCE',
		include_embedded=True) == facade.transactions_query


def test_transactions_address_embedded():
	# Arrange:
	facade = SymbolBlockFacade()
	address = Network.NETWORKS[0].public_key_to_address(PublicKey('11' * 32))

	# Act:
	response = _create_symbol_test_client(facade).get(
		f'/api/symbol/transactions?address={address}&type={TransactionType.TRANSFER.value}&embedded=TRUE')

	# Assert:
	assert 200 == response.status_code
	assert bytes.fromhex('68FD35818960C7B18B72F49A5598FA9F712A354DB3BF4C77') == facade.transactions_query.address
	assert (TransactionType.TRANSFER.value,) == facade.transactions_query.transaction_types
	assert facade.transactions_query.include_embedded is True


def test_transactions_repeat_type():
	# Arrange:
	facade = SymbolBlockFacade()

	# Act:
	response = _create_symbol_test_client(facade).get(
		f'/api/symbol/transactions?type={TransactionType.TRANSFER.value}&type={TransactionType.TRANSFER.value}')

	# Assert:
	assert 200 == response.status_code
	assert (TransactionType.TRANSFER.value, TransactionType.TRANSFER.value) == facade.transactions_query.transaction_types


def test_transactions_address_conflicts():
	# Arrange:
	facade = SymbolBlockFacade()
	address = 'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI'
	public_key = 'AB' * 32
	client = _create_symbol_test_client(facade)

	# Act + Assert:
	for query in (f'address={address}&signerPublicKey={public_key}', f'address={address}&recipientAddress={address}'):
		response = client.get(f'/api/symbol/transactions?{query}')
		_assert_bad_request_response(response, 'address cannot be combined with signerPublicKey or recipientAddress')
		assert None is facade.transactions_query, query


def test_transactions_bad_numeric():
	# Arrange:
	facade = SymbolBlockFacade()
	client = _create_symbol_test_client(facade)

	# Act + Assert:
	for query, message in (
		('limit=0', 'limit must be between 1 and 100'),
		('limit=101', 'limit must be between 1 and 100'),
		('limit=', 'limit must be an integer'),
		('offset=-1', 'offset must be between 0 and 100000'),
		('offset=100001', 'offset must be between 0 and 100000'),
		('offset=', 'offset must be an integer'),
		('height=0', 'height must be between 1 and 9223372036854775807'),
		('height=9223372036854775808', 'height must be between 1 and 9223372036854775807'),
		('height=', 'height must be an integer'),
		('type=', 'type must be an integer')
	):
		response = client.get(f'/api/symbol/transactions?{query}')
		_assert_bad_request_response(response, message)
		assert None is facade.transactions_query, query


def test_transactions_numeric_limits():
	# Arrange:
	facade = SymbolBlockFacade()

	# Act:
	response = _create_symbol_test_client(facade).get(
		'/api/symbol/transactions?limit=100&offset=100000&height=9223372036854775807')

	# Assert:
	assert 200 == response.status_code
	assert 100 == facade.transactions_query.limit
	assert 100000 == facade.transactions_query.offset
	assert 9223372036854775807 == facade.transactions_query.height


def test_transactions_unknown_params():
	# Arrange:
	facade = SymbolBlockFacade()
	client = _create_symbol_test_client(facade)

	# Act + Assert:
	for parameter in ('pageNumber', 'pageSize', 'cursor', 'orderBy', 'types', 'group', 'unknown'):
		response = client.get(f'/api/symbol/transactions?{parameter}=1')
		_assert_bad_request_response(response, f'Unsupported query parameter: {parameter}')
		assert None is facade.transactions_query, parameter


def test_transactions_scalar_duplicates():
	# Arrange:
	facade = SymbolBlockFacade()
	client = _create_symbol_test_client(facade)

	# Act + Assert:
	for parameter in (
		'limit', 'offset', 'height', 'address', 'signerPublicKey', 'recipientAddress',
		'transferMosaicId', 'embedded', 'order'
	):
		response = client.get(f'/api/symbol/transactions?{parameter}=1&{parameter}=1')
		_assert_bad_request_response(response, f'{parameter} must not be repeated')
		assert None is facade.transactions_query, parameter


def test_transactions_bad_types():
	# Arrange:
	facade = SymbolBlockFacade()
	client = _create_symbol_test_client(facade)

	# Act + Assert:
	for value, message in (
		('TRANSFER', 'type must be an integer'),
		('16724,16972', 'type must be an integer'),
		('999999', 'Unsupported transaction type')
	):
		response = client.get(f'/api/symbol/transactions?type={value}')
		_assert_bad_request_response(response, message)
		assert None is facade.transactions_query, value


def test_transactions_bad_address_key():
	# Arrange:
	facade = SymbolBlockFacade()
	client = _create_symbol_test_client(facade)

	# Act + Assert:
	for query, message in (
		('address=INVALID', 'Invalid address'),
		('recipientAddress=INVALID', 'Invalid recipientAddress'),
		('signerPublicKey=1234', 'Invalid signerPublicKey')
	):
		response = client.get(f'/api/symbol/transactions?{query}')
		_assert_bad_request_response(response, message)
		assert None is facade.transactions_query, query


def test_transfer_mosaic_filter_normalizes_ids_and_converts_namespace_names():  # pylint: disable=invalid-name
	# Arrange:
	facade = SymbolBlockFacade()
	client = _create_symbol_test_client(facade)

	# Act + Assert:
	for value, expected in (
		('72c0212e67a08bce', '72C0212E67A08BCE'),
		('8000000000000000', '8000000000000000'),
		('887e5db6bb0b21f5', '887E5DB6BB0B21F5'),
		('a' * 64, 'D940DD54960E74B8'),
		('.'.join(['a' * 64] * 3), 'FE5ED24675AB2E09'),
		('123', 'A8FD86E7F0F23F1F'),
		('0xabc', '925E72121973547B'),
		('daoka.my_coin', 'D9ED29F89BC43892'),
		('daoka.my-coin', '9CCC5B8BC198D8BD'),
		('namespace.xym', 'B006234ECB50F6DD')
	):
		response = client.get('/api/symbol/transactions', query_string={'transferMosaicId': value})
		assert 200 == response.status_code, value
		assert expected == facade.transactions_query.transfer_mosaic_id, value


def test_transfer_hierarchical_name():
	# Arrange:
	facade = SymbolBlockFacade()

	# Act:
	response = _create_symbol_test_client(facade).get('/api/symbol/transactions?transferMosaicId=namespace.xym.child')

	# Assert:
	assert 200 == response.status_code
	assert '8C820498A7C8F866' == facade.transactions_query.transfer_mosaic_id


def test_transfer_rejects_bad_input():
	# Arrange:
	facade = SymbolBlockFacade()
	client = _create_symbol_test_client(facade)

	# Act + Assert:
	for value in (
		'GGGGGGGGGGGGGGGG', ' 72C0212E67A08BCE', 'Namespace.xym', 'a.b.c.d', 'a' * 65,
		'', '.', '.a', 'a.', 'a..b', '_a', '-a', '日本語', 'a/coin', 'a@coin', 'a#coin', 'a coin', 'a+'
	):
		response = client.get('/api/symbol/transactions', query_string={'transferMosaicId': value})
		_assert_bad_request_response(response, 'Invalid transferMosaicId')
		assert None is facade.transactions_query, value


def test_transfer_unresolved_404():
	# Arrange:
	facade = SymbolBlockFacade()
	facade.transactions_error = SymbolMosaicAliasNotFound('alias missing')

	# Act:
	response = _create_symbol_test_client(facade).get('/api/symbol/transactions?transferMosaicId=8000000000000000')

	# Assert:
	_assert_not_found_response(response)


def test_embedded_rejects_invalid_values():
	# Arrange:
	facade = SymbolBlockFacade()
	client = _create_symbol_test_client(facade)
	values = ('1', '0', '', ' true', 'true ')

	# Act:
	responses = [(value, client.get(f'/api/symbol/transactions?embedded={value}')) for value in values]

	# Assert:
	for value, response in responses:
		_assert_bad_request_response(response, 'embedded must be true or false')
		assert None is facade.transactions_query, value


def test_order_rejects_invalid_values():
	# Arrange:
	facade = SymbolBlockFacade()
	client = _create_symbol_test_client(facade)
	values = ('ASC', '', ' DESC')

	# Act:
	responses = [(value, client.get(f'/api/symbol/transactions?order={value}')) for value in values]

	# Assert:
	for value, response in responses:
		_assert_bad_request_response(response, 'order must be DESC')
		assert None is facade.transactions_query, value


def test_transactions_db_failure():
	# Arrange:
	facade = SymbolBlockFacade()
	facade.transactions_error = OperationalError('database unavailable')

	# Act:
	response = _create_symbol_test_client(facade).get('/api/symbol/transactions')

	# Assert:
	_assert_symbol_backend_unavailable_response(response)


def test_block_receipts_missing_404():
	# Arrange:
	facade = SymbolBlockFacade()
	facade.receipts_result = None
	client = _create_symbol_test_client(facade)

	# Act:
	not_found_response = client.get('/api/symbol/block/12/receipts')

	# Assert:
	_assert_not_found_response(not_found_response)


def test_block_receipts_db_error_503():
	# Arrange:
	facade = SymbolBlockFacade()
	facade.receipts_error = OperationalError('database unavailable')
	client = _create_symbol_test_client(facade)

	# Act:
	unavailable_response = client.get('/api/symbol/block/12/receipts')

	# Assert:
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
