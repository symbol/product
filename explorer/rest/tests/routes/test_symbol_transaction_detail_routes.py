from datetime import datetime

import pytest
from common.symbol.NativeMosaic import NativeMosaicInfo
from flask import Flask
from psycopg2 import Error as PsycopgError
from symbolchain.CryptoTypes import PublicKey
from symbolchain.sc import TransactionType
from symbolchain.symbol.Network import Network

from rest import setup_error_handlers
from rest.db.SymbolDatabaseCommon import TransactionMosaicRecord
from rest.db.SymbolTransactionDetail import (
	TransactionDetailBlockRecord,
	TransactionDetailReadResult,
	TransactionDetailRecord,
	TransactionDetailTransactionRecord
)
from rest.facade.SymbolRestFacade import SymbolRestFacade
from rest.facade.SymbolTransactionNodeBacking import SymbolNodeNotFound, SymbolNodeUnavailable, SymbolTransactionNodeBacking
from rest.routes.symbol import setup_symbol_routes

HASH = 'AB' * 32
NATIVE_MOSAIC_INFO = NativeMosaicInfo('72C0212E67A08BCE', 6)
NODE_ADDRESS = '98' + '01' * 23


class FakeNodeConfig:
	def __init__(self):
		self.base_url = 'http://node.test:3000'
		self.timeout_seconds = 10

	@staticmethod
	def assert_request_allowed(_url):
		pass


class FakeTransport:
	def __init__(self, responses):
		self.responses = responses
		self.paths = []

	async def get_json(self, path):
		self.paths.append(path)
		result = self.responses[path]
		if isinstance(result, BaseException):
			raise result
		return result


class FakeDatabase:
	def __init__(self, result):
		self.result = result
		self.hashes = []

	def get_transaction_detail(self, transaction_hash):
		self.hashes.append(transaction_hash)
		return self.result

	@staticmethod
	def supplement_transaction_detail(_transaction_hash, record):
		return record


class FailingDetailDatabase(FakeDatabase):
	def get_transaction_detail(self, transaction_hash):
		self.hashes.append(transaction_hash)
		raise PsycopgError


def _transaction_payload(network=Network.TESTNET):
	return {
		'meta': {'hash': HASH},
		'transaction': {
			'network': network.identifier,
			'type': 16724,
			'version': 1,
			'signerPublicKey': '01' * 32,
			'signature': 'CD' * 64,
			'size': 120,
			'maxFee': '1000',
			'deadline': '1000',
			'recipientAddress': NODE_ADDRESS,
			'message': '004869',
			'mosaics': [{'id': '72C0212E67A08BCE', 'amount': '1000000'}]
		}
	}


def _bonded_payload(network=Network.TESTNET):
	return {
		'meta': {'hash': HASH},
		'transaction': {
			'network': network.identifier,
			'type': 16961,
			'version': 1,
			'signerPublicKey': '01' * 32,
			'signature': 'CD' * 64,
			'size': 180,
			'maxFee': '1000',
			'deadline': '1000',
			'transactionsHash': HASH,
			'cosignatures': [{'signerPublicKey': '02' * 32, 'signature': 'EF' * 64}],
			'transactions': [
				{
					'meta': {'aggregateHash': HASH, 'index': 0},
					'transaction': {
						'network': network.identifier,
						'type': 16724,
						'version': 1,
						'signerPublicKey': '03' * 32,
						'recipientAddress': NODE_ADDRESS,
						'message': '004869',
						'mosaics': []
					}
				}
			]
		}
	}


def _confirmed_record():
	transaction = TransactionDetailTransactionRecord(
		1, bytes.fromhex(HASH), False, None, None, 7, 16724, 'transfer', 1,
		bytes.fromhex('01' * 32), bytes.fromhex('98' + '01' * 23), bytes.fromhex('98' + '02' * 23),
		None, None, 100, datetime(2026, 1, 7), datetime(2026, 1, 8), 1000, 120, bytes.fromhex('CD' * 64),
		None, None, {'network': Network.TESTNET.identifier},
		{'transaction': {'network': Network.TESTNET.identifier, 'signature': 'CD' * 64}},
		(TransactionMosaicRecord('72C0212E67A08BCE', 1000000, 'transfer', 0, None, ()),))
	block = TransactionDetailBlockRecord(7, bytes.fromhex('EF' * 32), datetime(2026, 1, 7), 123)
	return TransactionDetailRecord(transaction, block, (), (), None, {})


def _confirmed_mainnet_aggregate_record():
	base = _confirmed_record()
	embedded_fields = {
		'effective_fee': None, 'deadline': None, 'max_fee': None, 'size': None, 'signature': None}
	parent = base.transaction._replace(
		transaction_type=TransactionType.AGGREGATE_COMPLETE.value,
		type_name='aggregate_complete',
		signer_address=Network.MAINNET.public_key_to_address(PublicKey(bytes.fromhex('01' * 32))).bytes,
		recipient_address=None,
		body={'network': Network.MAINNET.identifier, 'transactionsHash': 'AA' * 32},
		raw_payload={'transaction': {'network': Network.MAINNET.identifier, 'signature': 'CD' * 64}},
		mosaics=())
	child = base.transaction._replace(
		transaction_id=2,
		hash=None,
		is_embedded=True,
		aggregate_hash=bytes.fromhex(HASH),
		embedded_index=0,
		type_name='account_key_link',
		transaction_type=TransactionType.ACCOUNT_KEY_LINK.value,
		signer_public_key=bytes.fromhex('03' * 32),
		signer_address=Network.MAINNET.public_key_to_address(PublicKey(bytes.fromhex('03' * 32))).bytes,
		recipient_address=None,
		**embedded_fields,
		body={'network': Network.MAINNET.identifier, 'linkAction': 1, 'linkedPublicKey': '01' * 32},
		raw_payload={'transaction': {'network': Network.MAINNET.identifier}},
		mosaics=())
	return base._replace(
		transaction=parent,
		children=(child,),
		cosignatures=({'signerPublicKey': '02' * 32, 'signature': 'EF' * 64},))


def _client(facade):
	app = Flask(__name__)
	setup_error_handlers(app)
	setup_symbol_routes(app, facade)
	return app.test_client()


def _facade(database, responses):
	config = FakeNodeConfig()
	backing = SymbolTransactionNodeBacking(
		config, Network.TESTNET, transport=FakeTransport(responses), native_mosaic_info=NATIVE_MOSAIC_INFO)
	return SymbolRestFacade(database, config, NATIVE_MOSAIC_INFO, Network.TESTNET, node_backing=backing)


def test_invalid_hash_no_io():
	# Arrange:
	database = FakeDatabase(TransactionDetailReadResult(None, 'miss', 10, 10))
	client = _client(_facade(database, {}))

	# Act:
	response = client.get('/api/symbol/transaction/not-a-hash?unused=1')

	# Assert:
	assert 400 == response.status_code
	assert {'status': 400, 'message': 'Hash must be a 64-character hexadecimal string'} == response.json
	assert not database.hashes


@pytest.mark.parametrize('query', ('?unused=', '?unused=first&unused=second'))
def test_hash_query_rejected_pre_io(query):
	# Arrange:
	database = FakeDatabase(TransactionDetailReadResult(None, 'miss', 10, 10))
	transport = FakeTransport({})
	backing = SymbolTransactionNodeBacking(FakeNodeConfig(), Network.TESTNET, transport=transport, native_mosaic_info=NATIVE_MOSAIC_INFO)
	facade = SymbolRestFacade(
		database, FakeNodeConfig(), NATIVE_MOSAIC_INFO, Network.TESTNET, node_backing=backing)
	client = _client(facade)

	# Act:
	response = client.get(f'/api/symbol/transaction/{HASH}{query}')

	# Assert:
	assert 400 == response.status_code
	assert {'status': 400, 'message': 'Unsupported query parameter: unused'} == response.json
	assert not database.hashes
	assert not transport.paths


def test_miss_status_then_pending_detail():
	# Arrange:
	status_path = f'transactionStatus/{HASH}'
	detail_path = f'transactions/unconfirmed/{HASH}'
	transport = FakeTransport({status_path: {'group': 'unconfirmed', 'hash': HASH}, detail_path: _transaction_payload()})
	database = FakeDatabase(TransactionDetailReadResult(None, 'miss', 10, 10))
	config = FakeNodeConfig()
	backing = SymbolTransactionNodeBacking(config, Network.TESTNET, transport=transport, native_mosaic_info=NATIVE_MOSAIC_INFO)
	client = _client(SymbolRestFacade(database, config, NATIVE_MOSAIC_INFO, Network.TESTNET, node_backing=backing))

	# Act:
	response = client.get(f'/api/symbol/transaction/{HASH.lower()}')

	# Assert:
	assert 200 == response.status_code
	assert HASH == database.hashes[0].hex().upper()
	assert 'unconfirmed' == response.json['group']
	assert response.json['info']['height'] is None
	assert response.json['info']['timestamp'] is None
	assert response.json['info']['fee'] is None
	assert response.json['info']['value'] is None
	assert response.json['info']['amount'] is None
	assert 0.001 == response.json['info']['maxFee']
	assert '2022-10-31 21:07:48' == response.json['info']['deadline']
	assert [status_path, detail_path] == transport.paths


def test_confirmed_status_503():
	# Arrange:
	status_path = f'transactionStatus/{HASH}'
	transport = FakeTransport({status_path: {'group': 'confirmed', 'hash': HASH, 'height': 11}})
	database = FakeDatabase(TransactionDetailReadResult(None, 'miss', 10, 10))
	backing = SymbolTransactionNodeBacking(FakeNodeConfig(), Network.TESTNET, transport=transport, native_mosaic_info=NATIVE_MOSAIC_INFO)
	client = _client(SymbolRestFacade(database, FakeNodeConfig(), NATIVE_MOSAIC_INFO, Network.TESTNET, node_backing=backing))

	# Act:
	response = client.get(f'/api/symbol/transaction/{HASH}')

	# Assert:
	assert 503 == response.status_code
	assert {'status': 503, 'message': 'Symbol backend data is unavailable'} == response.json
	assert [status_path] == transport.paths


def test_confirmed_hit_skips_node():
	# Arrange:
	transport = FakeTransport({})
	database = FakeDatabase(TransactionDetailReadResult(_confirmed_record(), 'hit', 10, 10))
	config = FakeNodeConfig()
	backing = SymbolTransactionNodeBacking(config, Network.TESTNET, transport=transport, native_mosaic_info=NATIVE_MOSAIC_INFO)
	client = _client(SymbolRestFacade(database, config, NATIVE_MOSAIC_INFO, Network.TESTNET, node_backing=backing))

	# Act:
	response = client.get(f'/api/symbol/transaction/{HASH}')

	# Assert:
	assert 200 == response.status_code
	assert HASH == response.json['hash']
	assert [bytes.fromhex(HASH)] == database.hashes
	assert not transport.paths


def test_confirmed_lag_returns_503():
	# Arrange:
	status_path = f'transactionStatus/{HASH}'
	transport = FakeTransport({status_path: {'group': 'confirmed', 'hash': HASH, 'height': 11}})
	database = FakeDatabase(TransactionDetailReadResult(None, 'confirmed_lag', 10, 10))
	config = FakeNodeConfig()
	backing = SymbolTransactionNodeBacking(config, Network.TESTNET, transport=transport, native_mosaic_info=NATIVE_MOSAIC_INFO)
	client = _client(SymbolRestFacade(database, config, NATIVE_MOSAIC_INFO, Network.TESTNET, node_backing=backing))

	# Act:
	response = client.get(f'/api/symbol/transaction/{HASH}')

	# Assert:
	assert 503 == response.status_code
	assert {'status': 503, 'message': 'Symbol backend data is unavailable'} == response.json
	assert [status_path] == transport.paths


def test_node_missing_status_returns_404():
	# Arrange:
	status_path = f'transactionStatus/{HASH}'
	database = FakeDatabase(TransactionDetailReadResult(None, 'miss', 10, 10))
	client = _client(_facade(database, {status_path: SymbolNodeNotFound()}))

	# Act:
	response = client.get(f'/api/symbol/transaction/{HASH}')

	# Assert:
	assert 404 == response.status_code
	assert {'status': 404, 'message': 'Resource not found'} == response.json
	assert [bytes.fromhex(HASH)] == database.hashes


@pytest.mark.parametrize('group', ('unconfirmed', 'partial'))
def test_pending_detail_404_returns_503(group):
	# Arrange:
	status_path = f'transactionStatus/{HASH}'
	detail_path = f'transactions/{group}/{HASH}'
	transport = FakeTransport({status_path: {'group': group, 'hash': HASH}, detail_path: SymbolNodeNotFound()})
	database = FakeDatabase(TransactionDetailReadResult(None, 'miss', 10, 10))
	backing = SymbolTransactionNodeBacking(
		FakeNodeConfig(), Network.TESTNET, transport=transport, clock=lambda: 100,
		native_mosaic_info=NATIVE_MOSAIC_INFO)
	client = _client(SymbolRestFacade(database, FakeNodeConfig(), NATIVE_MOSAIC_INFO, Network.TESTNET, node_backing=backing))

	# Act:
	responses = [client.get(f'/api/symbol/transaction/{HASH}') for _ in range(2)]

	# Assert:
	assert [503, 503] == [response.status_code for response in responses]
	assert [{'status': 503, 'message': 'Symbol backend data is unavailable'}] * 2 == [response.json for response in responses]
	assert [status_path, detail_path, detail_path] == transport.paths
	assert [bytes.fromhex(HASH)] * 2 == database.hashes


def test_node_status_unavailable_503():
	# Arrange:
	status_path = f'transactionStatus/{HASH}'
	database = FakeDatabase(TransactionDetailReadResult(None, 'miss', 10, 10))
	client = _client(_facade(database, {status_path: SymbolNodeUnavailable()}))

	# Act:
	response = client.get(f'/api/symbol/transaction/{HASH}')

	# Assert:
	assert 503 == response.status_code
	assert {'status': 503, 'message': 'Symbol backend data is unavailable'} == response.json
	assert [bytes.fromhex(HASH)] == database.hashes


@pytest.mark.parametrize(('status_payload', 'expected_status', 'expected_body'), (
	({'group': 'failed', 'hash': '00' * 32}, 503, {'status': 503, 'message': 'Symbol backend data is unavailable'}),
	({'group': 'failed'}, 503, {'status': 503, 'message': 'Symbol backend data is unavailable'}),
	({'group': 'failed', 'hash': HASH}, 404, {'status': 404, 'message': 'Resource not found'})
))
def test_failed_status_hash_must_match(status_payload, expected_status, expected_body):
	# Arrange:
	status_path = f'transactionStatus/{HASH}'
	transport = FakeTransport({status_path: status_payload})
	config = FakeNodeConfig()
	backing = SymbolTransactionNodeBacking(config, Network.TESTNET, transport=transport, native_mosaic_info=NATIVE_MOSAIC_INFO)
	database = FakeDatabase(TransactionDetailReadResult(None, 'miss', 10, 10))
	client = _client(SymbolRestFacade(database, config, NATIVE_MOSAIC_INFO, Network.TESTNET, node_backing=backing))

	# Act:
	response = client.get(f'/api/symbol/transaction/{HASH}')

	# Assert:
	assert expected_status == response.status_code
	assert expected_body == response.json
	assert [status_path] == transport.paths


def test_db_error_503_skips_node():
	# Arrange:
	database = FailingDetailDatabase(None)
	transport = FakeTransport({})
	config = FakeNodeConfig()
	backing = SymbolTransactionNodeBacking(config, Network.TESTNET, transport=transport, native_mosaic_info=NATIVE_MOSAIC_INFO)
	client = _client(SymbolRestFacade(database, config, NATIVE_MOSAIC_INFO, Network.TESTNET, node_backing=backing))

	# Act:
	response = client.get(f'/api/symbol/transaction/{HASH}')

	# Assert:
	assert 503 == response.status_code
	assert {'status': 503, 'message': 'Symbol backend data is unavailable'} == response.json
	assert [bytes.fromhex(HASH)] == database.hashes
	assert not transport.paths


def test_bad_message_hex_returns_503():
	# Arrange:
	status_path = f'transactionStatus/{HASH}'
	detail_path = f'transactions/unconfirmed/{HASH}'
	invalid_payload = _transaction_payload()
	invalid_payload['transaction']['message'] = '00GG'
	transport = FakeTransport({
		status_path: {'group': 'unconfirmed', 'hash': HASH},
		detail_path: invalid_payload
	})
	config = FakeNodeConfig()
	backing = SymbolTransactionNodeBacking(
		config, Network.TESTNET, transport=transport, native_mosaic_info=NATIVE_MOSAIC_INFO)
	database = FakeDatabase(TransactionDetailReadResult(None, 'miss', 10, 10))
	client = _client(SymbolRestFacade(database, config, NATIVE_MOSAIC_INFO, Network.TESTNET, node_backing=backing))

	# Act:
	response = client.get(f'/api/symbol/transaction/{HASH}')

	# Assert:
	assert 503 == response.status_code
	assert {'status': 503, 'message': 'Symbol backend data is unavailable'} == response.json


def test_bad_message_type_cache():
	# Arrange:
	status_path = f'transactionStatus/{HASH}'
	detail_path = f'transactions/unconfirmed/{HASH}'
	invalid_payload = _transaction_payload()
	invalid_payload['transaction']['message'] = {'type': {'invalid': 'object'}, 'payload': 'AA'}
	transport = FakeTransport({
		status_path: {'group': 'unconfirmed', 'hash': HASH},
		detail_path: invalid_payload
	})
	config = FakeNodeConfig()
	backing = SymbolTransactionNodeBacking(
		config, Network.TESTNET, transport=transport, native_mosaic_info=NATIVE_MOSAIC_INFO)
	database = FakeDatabase(TransactionDetailReadResult(None, 'miss', 10, 10))
	client = _client(SymbolRestFacade(database, config, NATIVE_MOSAIC_INFO, Network.TESTNET, node_backing=backing))

	# Act:
	first = client.get(f'/api/symbol/transaction/{HASH}')
	transport.responses[detail_path] = _transaction_payload()
	transport.responses[detail_path]['transaction']['message'] = 'FF'
	second = client.get(f'/api/symbol/transaction/{HASH}')

	# Assert:
	assert (503, {'status': 503, 'message': 'Symbol backend data is unavailable'}) == (first.status_code, first.json)
	assert 200 == second.status_code
	assert {'type': None, 'text': 'FF'} == second.json['detail']['message']
	assert [status_path, detail_path, detail_path] == transport.paths


def test_bad_mosaic_flags_returns_503():
	# Arrange:
	status_path = f'transactionStatus/{HASH}'
	detail_path = f'transactions/unconfirmed/{HASH}'
	invalid_payload = _transaction_payload()
	invalid_payload['transaction'].update({
		'type': TransactionType.MOSAIC_DEFINITION.value,
		'id': '0000000000000001', 'divisibility': 0, 'duration': 1, 'nonce': 1, 'flags': 16, 'mosaics': []
	})
	transport = FakeTransport({
		status_path: {'group': 'unconfirmed', 'hash': HASH},
		detail_path: invalid_payload
	})
	config = FakeNodeConfig()
	backing = SymbolTransactionNodeBacking(
		config, Network.TESTNET, transport=transport, native_mosaic_info=NATIVE_MOSAIC_INFO)
	database = FakeDatabase(TransactionDetailReadResult(None, 'miss', 10, 10))
	client = _client(SymbolRestFacade(database, config, NATIVE_MOSAIC_INFO, Network.TESTNET, node_backing=backing))

	# Act:
	response = client.get(f'/api/symbol/transaction/{HASH}')

	# Assert:
	assert 503 == response.status_code
	assert {'status': 503, 'message': 'Symbol backend data is unavailable'} == response.json


def test_bonded_lock_uses_parent_hash():
	# Arrange:
	status_path = f'transactionStatus/{HASH}'
	detail_path = f'transactions/partial/{HASH}'
	lock_path = f'lock/hash/{HASH}'
	responses = {
		status_path: {'group': 'partial', 'hash': HASH},
		detail_path: _bonded_payload(),
		lock_path: {
			'lock': {
				'hash': HASH,
				'ownerAddress': NODE_ADDRESS,
				'mosaicId': '72C0212E67A08BCE',
				'amount': '1000000',
				'endHeight': '20',
				'status': 0
			}
		}
	}
	database = FakeDatabase(TransactionDetailReadResult(None, 'miss', 10, 10))
	config = FakeNodeConfig()
	transport = FakeTransport(responses)
	backing = SymbolTransactionNodeBacking(config, Network.TESTNET, transport=transport, native_mosaic_info=NATIVE_MOSAIC_INFO)
	client = _client(SymbolRestFacade(database, config, NATIVE_MOSAIC_INFO, Network.TESTNET, node_backing=backing))

	# Act:
	response = client.get(f'/api/symbol/transaction/{HASH}')

	# Assert:
	assert 200 == response.status_code
	assert 'partial' == response.json['group']
	assert HASH == response.json['hash']
	assert 'unused' == response.json['hashLock']['status']
	assert [status_path, detail_path, lock_path] == transport.paths


def test_pending_mainnet_cosigner():
	# Arrange:
	mainnet = Network.MAINNET
	unconfirmed_status_path = f'transactionStatus/{HASH}'
	unconfirmed_detail_path = f'transactions/unconfirmed/{HASH}'
	partial_detail_path = f'transactions/partial/{HASH}'
	lock_path = f'lock/hash/{HASH}'
	responses = {
		unconfirmed_status_path: {'group': 'unconfirmed', 'hash': HASH},
		unconfirmed_detail_path: _transaction_payload(mainnet),
		partial_detail_path: _bonded_payload(mainnet),
		lock_path: {
			'lock': {
				'hash': HASH, 'ownerAddress': NODE_ADDRESS, 'mosaicId': '72C0212E67A08BCE',
				'amount': '1000000', 'endHeight': '20', 'status': 0}}
	}
	responses[partial_detail_path]['transaction']['transactions'][0]['transaction'].update({
		'type': TransactionType.ACCOUNT_KEY_LINK.value, 'linkAction': 1, 'linkedPublicKey': '01' * 32})
	database = FakeDatabase(TransactionDetailReadResult(None, 'miss', 10, 10))
	config = FakeNodeConfig()
	transport = FakeTransport(responses)
	backing = SymbolTransactionNodeBacking(config, mainnet, transport=transport, native_mosaic_info=NATIVE_MOSAIC_INFO)
	client = _client(SymbolRestFacade(database, config, NATIVE_MOSAIC_INFO, mainnet, node_backing=backing))

	# Act:
	unconfirmed = client.get(f'/api/symbol/transaction/{HASH}')
	responses[unconfirmed_status_path] = {'group': 'partial', 'hash': HASH}
	partial_backing = SymbolTransactionNodeBacking(config, mainnet, transport=transport, native_mosaic_info=NATIVE_MOSAIC_INFO)
	partial_client = _client(SymbolRestFacade(database, config, NATIVE_MOSAIC_INFO, mainnet, node_backing=partial_backing))
	partial = partial_client.get(f'/api/symbol/transaction/{HASH}')

	# Assert:
	assert 200 == unconfirmed.status_code
	assert 'unconfirmed' == unconfirmed.json['group']
	assert 'NCUZDUB4XJ4XV3KSUBQ6NPZPP4RY3CUFZ7HNAPI' == unconfirmed.json['info']['sender']
	assert '2021-03-16 00:06:26' == unconfirmed.json['info']['deadline']
	assert 200 == partial.status_code
	assert 'partial' == partial.json['group']
	assert 'NCUZDUB4XJ4XV3KSUBQ6NPZPP4RY3CUFZ7HNAPI' == partial.json['info']['sender']
	assert '2021-03-16 00:06:26' == partial.json['info']['deadline']
	assert 'ND3I6ZLS22YLJIL7AIQHOAN34AOUSRNK6NTDVKQ' == partial.json['aggregate']['cosignatures'][0]['signer']
	assert 'NCUZDUB4XJ4XV3KSUBQ6NPZPP4RY3CUFZ7HNAPI' == partial.json['aggregate']['embeddedTransactions'][0]['detail']['linkedAccountAddress']


def test_confirmed_mainnet_cosigner():
	# Arrange:
	database = FakeDatabase(TransactionDetailReadResult(_confirmed_mainnet_aggregate_record(), 'hit', 10, 10))
	config = FakeNodeConfig()
	backing = SymbolTransactionNodeBacking(config, Network.MAINNET, transport=FakeTransport({}), native_mosaic_info=NATIVE_MOSAIC_INFO)
	client = _client(SymbolRestFacade(database, config, NATIVE_MOSAIC_INFO, Network.MAINNET, node_backing=backing))

	# Act:
	response = client.get(f'/api/symbol/transaction/{HASH}')

	# Assert:
	assert 200 == response.status_code
	assert 'NCUZDUB4XJ4XV3KSUBQ6NPZPP4RY3CUFZ7HNAPI' == response.json['info']['sender']
	assert '2026-01-08 00:00:00' == response.json['info']['deadline']
	assert 'ND3I6ZLS22YLJIL7AIQHOAN34AOUSRNK6NTDVKQ' == response.json['aggregate']['cosignatures'][0]['signer']
	assert 'NCUZDUB4XJ4XV3KSUBQ6NPZPP4RY3CUFZ7HNAPI' == response.json['aggregate']['embeddedTransactions'][0]['detail']['linkedAccountAddress']


def test_pending_restriction_codes():
	# Arrange:
	status_path = f'transactionStatus/{HASH}'
	detail_path = f'transactions/unconfirmed/{HASH}'
	payload = _transaction_payload()
	payload['transaction'].update({
		'type': TransactionType.ACCOUNT_OPERATION_RESTRICTION.value,
		'restrictionFlags': 4, 'restrictionAdditions': [TransactionType.TRANSFER.value],
		'restrictionDeletions': [TransactionType.ACCOUNT_KEY_LINK.value]})
	transport = FakeTransport({status_path: {'group': 'unconfirmed', 'hash': HASH}, detail_path: payload})
	database = FakeDatabase(TransactionDetailReadResult(None, 'miss', 10, 10))
	config = FakeNodeConfig()
	backing = SymbolTransactionNodeBacking(config, Network.TESTNET, transport=transport, native_mosaic_info=NATIVE_MOSAIC_INFO)
	client = _client(SymbolRestFacade(database, config, NATIVE_MOSAIC_INFO, Network.TESTNET, node_backing=backing))

	# Act:
	response = client.get(f'/api/symbol/transaction/{HASH}')

	# Assert:
	assert 200 == response.status_code
	assert ['TRANSFER'] == response.json['detail']['restrictionOperationAdditions']
	assert ['ACCOUNT_KEY_LINK'] == response.json['detail']['restrictionOperationDeletions']


def test_pending_lock_mosaic_id_range():
	for mosaic_id in (-1, 2 ** 64):
		# Arrange:
		status_path = f'transactionStatus/{HASH}'
		detail_path = f'transactions/partial/{HASH}'
		lock_path = f'lock/hash/{HASH}'
		transport = FakeTransport({
			status_path: {'group': 'partial', 'hash': HASH}, detail_path: _bonded_payload(),
			lock_path: {'lock': {
				'hash': HASH, 'ownerAddress': NODE_ADDRESS, 'mosaicId': mosaic_id,
				'amount': '1000000', 'endHeight': '20', 'status': 0}}})
		database = FakeDatabase(TransactionDetailReadResult(None, 'miss', 10, 10))
		config = FakeNodeConfig()
		backing = SymbolTransactionNodeBacking(config, Network.TESTNET, transport=transport, native_mosaic_info=NATIVE_MOSAIC_INFO)
		client = _client(SymbolRestFacade(database, config, NATIVE_MOSAIC_INFO, Network.TESTNET, node_backing=backing))

		# Act:
		response = client.get(f'/api/symbol/transaction/{HASH}')

		# Assert:
		assert 503 == response.status_code
