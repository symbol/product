from flask import Flask
from psycopg2 import OperationalError

from rest import setup_error_handlers
from rest.routes.symbol import setup_symbol_routes


class SymbolBlockFacade:
    def __init__(self):
        self.blocks_result = [{'height': 2}]
        self.block_result = {'height': 2}
        self.database_available = True
        self.block_data_available = True
        self.blocks_query = None
        self.height = None
        self.blocks_error = None
        self.block_error = None

    @staticmethod
    def get_health():
        return {'isHealthy': True, 'errors': []}

    def is_database_available(self):
        return self.database_available

    def is_block_data_available(self):
        return self.database_available and self.block_data_available

    def get_blocks(self, limit, from_height, sort):
        self.blocks_query = (limit, from_height, sort)
        if self.blocks_error:
            raise self.blocks_error

        return self.blocks_result

    def get_block(self, height):
        self.height = height
        if self.block_error:
            raise self.block_error

        return self.block_result


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
    assert (5, 10, 'ASC') == facade.blocks_query


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


def test_blocks_503_when_result_missing():
    # Arrange:
    facade = SymbolBlockFacade()
    facade.blocks_result = None

    # Act:
    response = _create_symbol_test_client(facade).get('/api/symbol/blocks')

    # Assert:
    _assert_symbol_backend_unavailable_response(response)


def test_blocks_503_when_data_missing():
    # Arrange:
    facade = SymbolBlockFacade()
    facade.block_data_available = False

    # Act:
    response = _create_symbol_test_client(facade).get('/api/symbol/blocks')

    # Assert:
    _assert_symbol_backend_unavailable_response(response)
    assert facade.blocks_query is None


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


def test_block_503_when_db_unavailable():
    # Arrange:
    facade = SymbolBlockFacade()
    facade.database_available = False

    # Act:
    response = _create_symbol_test_client(facade).get('/api/symbol/block/2')

    # Assert:
    _assert_symbol_backend_unavailable_response(response)
    assert facade.height is None


def test_block_503_when_data_missing():
    # Arrange:
    facade = SymbolBlockFacade()
    facade.block_data_available = False

    # Act:
    response = _create_symbol_test_client(facade).get('/api/symbol/block/2')

    # Assert:
    _assert_symbol_backend_unavailable_response(response)
    assert facade.height is None


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
