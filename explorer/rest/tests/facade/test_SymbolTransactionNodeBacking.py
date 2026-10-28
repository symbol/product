# pylint: disable=too-many-lines  # Node transaction validation matrix shares one contract fixture.

import asyncio
from threading import Event, Thread, current_thread
from unittest import TestCase

from common.symbol.NativeMosaic import NativeMosaicInfo
from common.symbol.NodeConfiguration import SymbolNodeConfigurationError
from symbolchain.sc import MosaicFlags, TransactionType
from symbolchain.symbol.Network import Network

from rest.db.SymbolDatabaseCommon import TransactionMosaicRecord
from rest.facade.SymbolTransactionNodeBacking import (
	AiohttpTransport,
	AsyncLruCache,
	SymbolNodeNotFound,
	SymbolNodeUnavailable,
	SymbolTransactionNodeBacking
)

HASH = 'AB' * 32
PUBLIC_KEY = '01' * 32
SIGNATURE = 'CD' * 64
ADDRESS = '98' + '01' * 23
NATIVE_MOSAIC_INFO = NativeMosaicInfo('72C0212E67A08BCE', 6)


class FakeNodeConfig:
	def __init__(self):
		self.base_url = 'http://node.test:3000'
		self.timeout_seconds = 10
		self.allowed_calls = []

	def assert_request_allowed(self, url):
		self.allowed_calls.append(url)


class FakeTransport:
	def __init__(self, responses):
		self.responses = responses
		self.paths = []

	async def get_json(self, path):
		self.paths.append(path)
		response = self.responses[path]
		if isinstance(response, BaseException):
			raise response
		return response


class FakeResponse:
	def __init__(self, status, payload=None, error=None):
		self.status = status
		self.payload = payload
		self.error = error
		self.enter_count = 0
		self.exit_count = 0
		self.json_call_count = 0

	async def __aenter__(self):
		self.enter_count += 1
		return self

	async def __aexit__(self, _exception_type, _exception, _traceback):
		self.exit_count += 1

	async def json(self, **_kwargs):
		self.json_call_count += 1
		if self.error:
			raise self.error
		return self.payload


class FakeSession:
	def __init__(self, response):
		self.response = response
		self.path = None
		self.get_options = None
		self.enter_count = 0
		self.exit_count = 0

	async def __aenter__(self):
		self.enter_count += 1
		return self

	async def __aexit__(self, _exception_type, _exception, _traceback):
		self.exit_count += 1

	def get(self, path, **kwargs):
		self.path = path
		self.get_options = kwargs
		return self.response


def _transaction_payload(transaction_hash=HASH):
	return {
		'meta': {'hash': transaction_hash},
		'transaction': {
			'network': Network.TESTNET.identifier,
			'type': 16724,
			'version': 1,
			'signerPublicKey': PUBLIC_KEY,
			'signature': SIGNATURE,
			'size': 120,
			'maxFee': '1000',
			'deadline': '1000',
			'recipientAddress': ADDRESS,
			'message': '004869',
			'mosaics': [{'id': '72C0212E67A08BCE', 'amount': '1000000'}]
		}
	}


def _validate_node_payload(response):
	transport = FakeTransport({f'transactions/unconfirmed/{HASH}': response})
	backing = SymbolTransactionNodeBacking(
		FakeNodeConfig(), Network.TESTNET, transport=transport, native_mosaic_info=NATIVE_MOSAIC_INFO)
	return asyncio.run(backing.get_transaction('unconfirmed', HASH))


class SymbolTransactionNodeBackingConversionTest(TestCase):
	def test_rejects_missing_native_mosaic_information(self):
		# Arrange:
		# Act + Assert:
		with self.assertRaises(ValueError) as error:
			SymbolTransactionNodeBacking(
				FakeNodeConfig(), Network.TESTNET, None, transport=FakeTransport({}))
		self.assertEqual('Native mosaic information is required', str(error.exception))

	def test_rejects_invalid_native_mosaic_information_type(self):
		# Arrange:
		# Act + Assert:
		with self.assertRaises(ValueError) as error:
			SymbolTransactionNodeBacking(
				FakeNodeConfig(), Network.TESTNET, object(), transport=FakeTransport({}))
		self.assertEqual('Native mosaic information is required', str(error.exception))

	def test_detail_conversion_rejects_unknown_types_and_invalid_identity_fields(self):
		# Arrange:
		def payload(**updates):
			result = _transaction_payload()
			result['transaction'].update(updates)
			return result

		def backing_for(response):
			return SymbolTransactionNodeBacking(
				FakeNodeConfig(), Network.TESTNET, transport=FakeTransport({f'transactions/unconfirmed/{HASH}': response}),
				native_mosaic_info=NATIVE_MOSAIC_INFO)

		invalid_payloads = (
			payload(type=65535),
			payload(type=TransactionType.HASH_LOCK.value),
			payload(type=TransactionType.MOSAIC_SUPPLY_REVOCATION.value, sourceAddress=ADDRESS, mosaicId='01'),
			payload(version='9' * 5000),
			payload(size=None)
		)

		# Act + Assert:
		for invalid_payload in invalid_payloads:
			with self.assertRaises(SymbolNodeUnavailable):
				asyncio.run(backing_for(invalid_payload).get_transaction('unconfirmed', HASH))

	def test_detail_conversion_rejects_missing_required_recipient(self):
		# Arrange:
		payload = _transaction_payload()
		payload['transaction']['recipientAddress'] = None
		backing = SymbolTransactionNodeBacking(
			FakeNodeConfig(), Network.TESTNET,
			transport=FakeTransport({f'transactions/unconfirmed/{HASH}': payload}),
			native_mosaic_info=NATIVE_MOSAIC_INFO)

		# Act + Assert:
		with self.assertRaises(SymbolNodeUnavailable):
			asyncio.run(backing.get_transaction('unconfirmed', HASH))

	def test_detail_conversion_rejects_malformed_mosaic_payloads(self):
		# Arrange:
		payload = _transaction_payload()
		payload['transaction'].update({
			'type': TransactionType.MOSAIC_SUPPLY_CHANGE.value,
			'mosaicId': '01', 'action': 1, 'delta': '1', 'mosaics': [1]})
		backing = SymbolTransactionNodeBacking(
			FakeNodeConfig(), Network.TESTNET,
			transport=FakeTransport({}),
			native_mosaic_info=NATIVE_MOSAIC_INFO)

		# Act + Assert:
		with self.assertRaises(SymbolNodeUnavailable):
			backing.to_detail_record(payload, 'partial', HASH)

	def test_detail_conversion_rejects_malformed_multisig_address_arrays(self):
		# Arrange:
		payload = _transaction_payload()
		payload['transaction'].update({'type': TransactionType.MULTISIG_ACCOUNT_MODIFICATION.value, 'addressAdditions': {}})
		backing = SymbolTransactionNodeBacking(
			FakeNodeConfig(),
			Network.TESTNET,
			transport=FakeTransport({}),
			native_mosaic_info=NATIVE_MOSAIC_INFO
		)

		# Act + Assert:
		with self.assertRaises(SymbolNodeUnavailable):
			backing.to_detail_record(payload, 'partial', HASH)

	def test_detail_conversion_rejects_non_array_multisig_address_additions(self):
		# Arrange:
		payload = _transaction_payload()
		payload['transaction'].update({
			'type': TransactionType.MULTISIG_ACCOUNT_MODIFICATION.value,
			'minApprovalDelta': 0, 'minRemovalDelta': 0, 'addressAdditions': {}, 'addressDeletions': []})
		backing = SymbolTransactionNodeBacking(
			FakeNodeConfig(),
			Network.TESTNET,
			transport=FakeTransport({}),
			native_mosaic_info=NATIVE_MOSAIC_INFO
		)

		# Act + Assert:
		with self.assertRaises(SymbolNodeUnavailable):
			backing.to_detail_record(payload, 'partial', HASH)

	def test_detail_conversion_rejects_nested_aggregate_transactions(self):
		# Arrange:
		payload = _transaction_payload()
		payload['transaction'].update({
			'type': TransactionType.AGGREGATE_COMPLETE.value,
			'transactionsHash': HASH,
			'cosignatures': [],
			'transactions': [{
				'meta': {'aggregateHash': HASH, 'index': 0},
				'transaction': {
					'network': Network.TESTNET.identifier, 'type': TransactionType.AGGREGATE_COMPLETE.value,
					'version': 1, 'signerPublicKey': PUBLIC_KEY, 'signature': SIGNATURE,
					'transactionsHash': HASH, 'cosignatures': [], 'transactions': []
				}
			}]
		})
		backing = SymbolTransactionNodeBacking(
			FakeNodeConfig(), Network.TESTNET,
			transport=FakeTransport({f'transactions/unconfirmed/{HASH}': payload}),
			native_mosaic_info=NATIVE_MOSAIC_INFO)

		# Act + Assert:
		with self.assertRaises(SymbolNodeUnavailable):
			asyncio.run(backing.get_transaction('unconfirmed', HASH))

	def test_detail_conversion_preserves_valid_message_hex(self):
		# Arrange:
		message = 'FE2A8061577301E2' + 'AB' * 4
		payload = _transaction_payload()
		payload['transaction']['message'] = message
		backing = SymbolTransactionNodeBacking(
			FakeNodeConfig(), Network.TESTNET,
			transport=FakeTransport({f'transactions/unconfirmed/{HASH}': payload}),
			native_mosaic_info=NATIVE_MOSAIC_INFO)

		# Act:
		validated = asyncio.run(backing.get_transaction('unconfirmed', HASH))

		# Assert:
		self.assertEqual(message, validated['transaction']['message'])

	def test_detail_conversion_rejects_missing_required_addresses_for_each_transaction_type(self):
		# Arrange:
		backing = SymbolTransactionNodeBacking(
			FakeNodeConfig(),
			Network.TESTNET,
			transport=FakeTransport({}),
			native_mosaic_info=NATIVE_MOSAIC_INFO
		)
		required_addresses = (
			(TransactionType.TRANSFER.value, 'recipientAddress'),
			(TransactionType.SECRET_LOCK.value, 'recipientAddress'),
			(TransactionType.SECRET_PROOF.value, 'recipientAddress'),
			(TransactionType.ACCOUNT_METADATA.value, 'targetAddress'),
			(TransactionType.MOSAIC_METADATA.value, 'targetAddress'),
			(TransactionType.NAMESPACE_METADATA.value, 'targetAddress'),
			(TransactionType.MOSAIC_ADDRESS_RESTRICTION.value, 'targetAddress'),
			(TransactionType.MOSAIC_SUPPLY_REVOCATION.value, 'sourceAddress')
		)

		# Act + Assert:
		for transaction_type, field in required_addresses:
			with self.subTest(transaction_type=transaction_type, field=field):
				transaction = _transaction_payload()
				transaction['transaction'].update({'type': transaction_type, field: None})
				with self.assertRaises(SymbolNodeUnavailable):
					backing.to_detail_record(transaction, 'partial', HASH)

		address_alias = _transaction_payload()
		address_alias['transaction'].update({
			'type': TransactionType.ADDRESS_ALIAS.value, 'namespaceId': '01', 'aliasAction': 1, 'address': None})
		with self.assertRaises(SymbolNodeUnavailable):
			backing.to_detail_record(address_alias, 'partial', HASH)

	def test_detail_conversion_rejects_invalid_message_hex(self):
		# Arrange:
		backing = SymbolTransactionNodeBacking(
			FakeNodeConfig(),
			Network.TESTNET,
			transport=FakeTransport({}),
			native_mosaic_info=NATIVE_MOSAIC_INFO
		)

		# Act + Assert:
		for message in ('0', 'GG', '00GG', {'type': 'plain', 'payload': '0'}, {'type': 'plain', 'payload': None}):
			with self.subTest(message=message):
				payload = _transaction_payload()
				payload['transaction']['message'] = message
				with self.assertRaises(SymbolNodeUnavailable):
					backing.to_detail_record(payload, 'partial', HASH)

	def test_detail_conversion_rejects_negative_unknown_or_invalid_mosaic_definition_flags(self):
		# Arrange:
		invalid_flags = (-1, 16, '1', True)

		for flags in invalid_flags:
			with self.subTest(flags=flags):
				# Arrange:
				payload = _transaction_payload()
				payload['transaction'].update({
					'type': TransactionType.MOSAIC_DEFINITION.value,
					'id': '01', 'divisibility': 0, 'duration': 1, 'nonce': 1, 'flags': flags})
				backing = SymbolTransactionNodeBacking(
					FakeNodeConfig(), Network.TESTNET,
					transport=FakeTransport({f'transactions/unconfirmed/{HASH}': payload}),
					native_mosaic_info=NATIVE_MOSAIC_INFO)

				# Act + Assert:
				with self.assertRaises(SymbolNodeUnavailable):
					asyncio.run(backing.get_transaction('unconfirmed', HASH))

	def test_detail_conversion_preserves_zero_and_known_mosaic_definition_flags(self):
		# Arrange:
		known_flags = sum(flag.value for flag in MosaicFlags)

		# Act:
		results = []
		for flags in (0, known_flags):
			payload = _transaction_payload()
			payload['transaction'].update({
				'type': TransactionType.MOSAIC_DEFINITION.value,
				'id': '01', 'divisibility': 0, 'duration': 1, 'nonce': 1, 'flags': flags})
			backing = SymbolTransactionNodeBacking(
				FakeNodeConfig(), Network.TESTNET,
				transport=FakeTransport({f'transactions/unconfirmed/{HASH}': payload}),
				native_mosaic_info=NATIVE_MOSAIC_INFO)
			results.append(asyncio.run(backing.get_transaction('unconfirmed', HASH))['meta']['hash'])

		# Assert:
		self.assertEqual([HASH, HASH], results)


class SymbolTransactionNodeBackingBodyValidationTest(TestCase):
	def test_node_detail_body_validation_accepts_root_and_subnamespace(self):
		# Arrange:
		cases = (
			('root', {
				'type': TransactionType.NAMESPACE_REGISTRATION.value, 'id': '0000000000000001', 'name': 'root',
				'registrationType': 'root', 'duration': '100', 'parentId': None}),
			('child', {
				'type': TransactionType.NAMESPACE_REGISTRATION.value, 'id': '0000000000000002', 'name': 'child',
				'registrationType': 'sub', 'parentId': '01', 'duration': None})
		)

		for expected_name, body in cases:
			with self.subTest(registration_type=body['registrationType']):
				response = _transaction_payload()
				response['transaction'].update(body)

				# Act:
				result = _validate_node_payload(response)

				# Assert:
				self.assertEqual(expected_name, result['transaction']['name'])

	def test_node_detail_body_validation_preserves_multisig_and_address_restriction_arrays(self):
		# Arrange:
		cases = (
			(TransactionType.MULTISIG_ACCOUNT_MODIFICATION.value, {
				'minApprovalDelta': 0, 'minRemovalDelta': 0, 'addressAdditions': [ADDRESS], 'addressDeletions': [ADDRESS]
			}, 'addressAdditions'),
			(TransactionType.ACCOUNT_ADDRESS_RESTRICTION.value, {
				'restrictionFlags': 1, 'restrictionAdditions': [ADDRESS], 'restrictionDeletions': [ADDRESS]
			}, 'restrictionAdditions')
		)

		for transaction_type, fields, returned_field in cases:
			with self.subTest(transaction_type=transaction_type):
				response = _transaction_payload()
				response['transaction'].update({'type': transaction_type, **fields})

				# Act:
				result = _validate_node_payload(response)

				# Assert:
				self.assertEqual([ADDRESS], result['transaction'][returned_field])

	def test_node_detail_body_validation_rejects_invalid_namespace_fields(self):
		# Arrange:
		invalid_bodies = (
			{'type': TransactionType.NAMESPACE_REGISTRATION.value, 'id': '01', 'name': 'root', 'registrationType': 'root'},
			{'type': TransactionType.NAMESPACE_REGISTRATION.value, 'id': '01', 'name': 'child', 'registrationType': 'sub'},
			{
				'type': TransactionType.NAMESPACE_REGISTRATION.value, 'id': '01', 'name': 'child',
				'registrationType': 'unknown', 'parentId': '01'}
		)

		# Act + Assert:
		for body in invalid_bodies:
			with self.subTest(registration_type=body['registrationType']):
				response = _transaction_payload()
				response['transaction'].update(body)
				with self.assertRaises(SymbolNodeUnavailable):
					_validate_node_payload(response)

	def test_node_detail_body_validation_rejects_invalid_key_link_values(self):
		# Arrange:
		invalid_bodies = (
			{'type': TransactionType.ACCOUNT_KEY_LINK.value, 'linkAction': True, 'linkedPublicKey': PUBLIC_KEY},
			{
				'type': TransactionType.VOTING_KEY_LINK.value, 'linkAction': 1, 'linkedPublicKey': PUBLIC_KEY,
				'startEpoch': -1, 'endEpoch': 1}
		)

		# Act + Assert:
		for body in invalid_bodies:
			with self.subTest(transaction_type=body['type']):
				response = _transaction_payload()
				response['transaction'].update(body)
				with self.assertRaises(SymbolNodeUnavailable):
					_validate_node_payload(response)

	def test_node_detail_body_validation_rejects_invalid_operation_restriction_values(self):
		# Arrange:
		invalid_additions = ([True], [65536])

		# Act + Assert:
		for additions in invalid_additions:
			with self.subTest(additions=additions):
				response = _transaction_payload()
				response['transaction'].update({
					'type': TransactionType.ACCOUNT_OPERATION_RESTRICTION.value,
					'restrictionFlags': 4, 'restrictionAdditions': additions, 'restrictionDeletions': []})
				with self.assertRaises(SymbolNodeUnavailable):
					_validate_node_payload(response)

	def test_node_detail_body_validation_rejects_non_string_address_restriction_values(self):
		# Arrange:
		response = _transaction_payload()
		response['transaction'].update({
			'type': TransactionType.ACCOUNT_ADDRESS_RESTRICTION.value,
			'restrictionFlags': 1, 'restrictionAdditions': [1], 'restrictionDeletions': []})

		# Act + Assert:
		with self.assertRaises(SymbolNodeUnavailable):
			_validate_node_payload(response)

	def test_node_detail_body_validation_rejects_malformed_cosignature_items(self):
		# Arrange:
		response = _transaction_payload()
		response['transaction'].update({
			'type': TransactionType.AGGREGATE_COMPLETE.value, 'transactionsHash': HASH, 'cosignatures': [1]})

		# Act + Assert:
		with self.assertRaises(SymbolNodeUnavailable):
			_validate_node_payload(response)

	def test_node_detail_body_validation_rejects_non_array_cosignatures(self):
		# Arrange:
		response = _transaction_payload()
		response['transaction'].update({
			'type': TransactionType.AGGREGATE_COMPLETE.value, 'transactionsHash': HASH, 'cosignatures': {}})

		# Act + Assert:
		with self.assertRaises(SymbolNodeUnavailable):
			_validate_node_payload(response)

	def test_record_conversion_rejects_invalid_groups_and_aggregate_shapes(self):
		# Arrange:
		backing = SymbolTransactionNodeBacking(
			FakeNodeConfig(),
			Network.TESTNET,
			transport=FakeTransport({}),
			native_mosaic_info=NATIVE_MOSAIC_INFO
		)

		def payload(**updates):
			result = _transaction_payload()
			result['transaction'].update(updates)
			return result

		def unavailable(action):
			with self.assertRaises(SymbolNodeUnavailable):
				action()

		# Act + Assert:
		unavailable(lambda: backing.to_detail_record(payload(), 'confirmed', HASH))
		aggregate = payload(type=TransactionType.AGGREGATE_COMPLETE.value, transactionsHash=HASH)
		unavailable(lambda: backing.to_detail_record(aggregate, 'partial', HASH))
		aggregate['transaction']['cosignatures'] = []
		unavailable(lambda: backing.to_detail_record(aggregate, 'partial', HASH))
		aggregate['transaction']['transactions'] = {}
		unavailable(lambda: backing.to_detail_record(aggregate, 'partial', HASH))
		aggregate['transaction']['transactions'] = [{
			'meta': {'index': 0, 'aggregateHash': '00' * 32}, 'transaction': payload()['transaction']
		}]
		unavailable(lambda: backing.to_detail_record(aggregate, 'partial', HASH))
		aggregate['transaction']['transactions'][0]['meta']['aggregateHash'] = HASH
		aggregate['transaction']['transactions'].append(aggregate['transaction']['transactions'][0])
		unavailable(lambda: backing.to_detail_record(aggregate, 'partial', HASH))
		non_aggregate = payload(transactions=[{
			'meta': {'index': 0, 'aggregateHash': HASH}, 'transaction': payload()['transaction']}])
		unavailable(lambda: backing.to_detail_record(non_aggregate, 'partial', HASH))

	def test_record_conversion_rejects_malformed_identity_and_mosaic_payloads(self):  # pylint: disable=too-many-statements
		# Arrange:
		backing = SymbolTransactionNodeBacking(
			FakeNodeConfig(),
			Network.TESTNET,
			transport=FakeTransport({}),
			native_mosaic_info=NATIVE_MOSAIC_INFO
		)

		def payload(**updates):
			result = _transaction_payload()
			result['transaction'].update(updates)
			return result

		invalid_payloads = (
			[], {'transaction': 1}, payload(network=None), payload(signerPublicKey='bad'),
			payload(type=True), payload(type='bad'), payload(type=-1), payload(deadline='bad'), payload(deadline=None),
			payload(recipientAddress='bad'), payload(recipientAddress='T' + 'A' * 38),
			payload(type=TransactionType.HASH_LOCK.value, duration=1, hash=HASH),
			payload(maxFee='18446744073709551616'), payload(message=1), payload(mosaics={}), payload(mosaics=[1]),
			payload(mosaics=[{'id': 'bad', 'amount': 1}]), payload(mosaics=[{'id': None, 'amount': 1}])
		)

		# Act:
		for invalid_payload in invalid_payloads:
			with self.subTest(payload=invalid_payload):
				with self.assertRaises(SymbolNodeUnavailable):
					backing.to_detail_record(invalid_payload, 'partial', HASH)

		# Assert:
		self.assertEqual(len(invalid_payloads), 18)

	def test_record_conversion_preserves_message_hex_forms(self):
		# Arrange:
		backing = SymbolTransactionNodeBacking(
			FakeNodeConfig(),
			Network.TESTNET,
			transport=FakeTransport({}),
			native_mosaic_info=NATIVE_MOSAIC_INFO
		)

		def payload(**updates):
			result = _transaction_payload()
			result['transaction'].update(updates)
			return result

		# Act:
		message_record = backing.to_detail_record(
			payload(message={'type': 'plain', 'payload': 'AA'}), 'partial', HASH).transaction
		unknown_message = backing.to_detail_record(payload(message='FF'), 'partial', HASH).transaction

		# Assert:
		self.assertEqual(('plain', 'AA'), (message_record.message_type, message_record.message_payload))
		self.assertEqual('FF', unknown_message.message_payload)

	def test_record_conversion_normalizes_mosaic_ids_and_roles(self):  # pylint: disable=too-many-statements
		# Arrange:
		backing = SymbolTransactionNodeBacking(
			FakeNodeConfig(),
			Network.TESTNET,
			transport=FakeTransport({}),
			native_mosaic_info=NATIVE_MOSAIC_INFO
		)

		def payload(**updates):
			result = _transaction_payload()
			result['transaction'].update(updates)
			return result

		role_cases = (
			(TransactionType.MOSAIC_DEFINITION.value, 'id', '1234567890ABCDEF', {'divisibility': 0, 'duration': 1, 'nonce': 1, 'flags': 0}),
			(TransactionType.MOSAIC_SUPPLY_CHANGE.value, 'mosaicId', '1234567890ABCDEF', {'action': 1, 'delta': 1}),
			(TransactionType.MOSAIC_ADDRESS_RESTRICTION.value, 'mosaicId', '1234567890ABCDEF', {
				'restrictionKey': '01', 'previousRestrictionValue': 0, 'newRestrictionValue': 1, 'targetAddress': ADDRESS}),
			(TransactionType.MOSAIC_GLOBAL_RESTRICTION.value, 'mosaicId', '1234567890ABCDEF', {
				'referenceMosaicId': '00', 'restrictionKey': '01', 'previousRestrictionType': 0,
				'previousRestrictionValue': 0, 'newRestrictionType': 1, 'newRestrictionValue': 1}),
			(TransactionType.MOSAIC_SUPPLY_REVOCATION.value, 'mosaicId', '1234567890ABCDEF', {
				'amount': 1, 'sourceAddress': ADDRESS}),
			(TransactionType.MOSAIC_METADATA.value, 'targetMosaicId', '1234567890ABCDEF', {
				'scopedMetadataKey': '01', 'value': 'AA', 'valueSizeDelta': 1, 'targetAddress': ADDRESS})
		)

		# Act:
		mosaic_record = backing.to_detail_record(
			payload(mosaics=[{'id': 1, 'amount': 1}]), 'partial', HASH).transaction
		role_records = []
		for transaction_type, field, value, fields in role_cases:
			updates = {field: value, 'mosaics': []}
			updates.update(fields)
			role_records.append(backing.to_detail_record(
				payload(type=transaction_type, **updates), 'partial', HASH).transaction)

		# Assert:
		self.assertEqual('0000000000000001', mosaic_record.mosaics[0].mosaic_id)
		self.assertEqual(
			(TransactionMosaicRecord('0000000000000001', 1, 'transfer', 0, None, None),), mosaic_record.mosaics)
		self.assertEqual((
			(TransactionMosaicRecord('1234567890ABCDEF', 0, 'definition', 0, None, None),),
			(TransactionMosaicRecord('1234567890ABCDEF', 1, 'definition', 0, None, None),),
			(TransactionMosaicRecord('1234567890ABCDEF', 0, 'restriction', 0, None, None),),
			(TransactionMosaicRecord('1234567890ABCDEF', 0, 'restriction', 0, None, None),),
			(TransactionMosaicRecord('1234567890ABCDEF', 1, 'revocation', 0, None, None),),
			(TransactionMosaicRecord('1234567890ABCDEF', 0, 'metadata_target', 0, None, None),)
		), tuple(record.mosaics for record in role_records))

	def test_hash_lock_record_conversion_preserves_absence(self):
		# Arrange:
		backing = SymbolTransactionNodeBacking(
			FakeNodeConfig(),
			Network.TESTNET,
			transport=FakeTransport({}),
			native_mosaic_info=NATIVE_MOSAIC_INFO
		)

		# Act:
		absent = backing.to_hash_lock_record(None)

		# Assert:
		self.assertIsNone(absent)

	def test_hash_lock_record_conversion_rejects_malformed_values(self):
		# Arrange:
		backing = SymbolTransactionNodeBacking(
			FakeNodeConfig(),
			Network.TESTNET,
			transport=FakeTransport({}),
			native_mosaic_info=NATIVE_MOSAIC_INFO
		)

		# Act + Assert:
		with self.assertRaises(SymbolNodeUnavailable):
			backing.to_hash_lock_record({'hash': 'bad'})


class AiohttpTransportTest(TestCase):
	def test_aiohttp_transport_closes_acquired_resources_for_response_outcomes(self):
		# Arrange:
		config = FakeNodeConfig()
		config.timeout_seconds = 17
		cases = (
			(200, {'ok': True}, None, None),
			(404, None, None, SymbolNodeNotFound),
			(503, None, None, SymbolNodeUnavailable),
			(200, None, ValueError('invalid json'), SymbolNodeUnavailable),
			(200, None, asyncio.TimeoutError(), SymbolNodeUnavailable)
		)

		def assert_closed_resources(status, payload, json_error, expected_error):
			# Arrange:
			response = FakeResponse(status, payload, json_error)
			session = FakeSession(response)
			factory_options = {}

			def create_session(**options):
				factory_options.update(options)
				return session

			transport = AiohttpTransport(config, create_session)

			# Act:
			if expected_error:
				with self.assertRaises(expected_error):
					asyncio.run(transport.get_json('transactionStatus/' + HASH))
				result = None
			else:
				result = asyncio.run(transport.get_json('transactionStatus/' + HASH))

			# Assert:
			self.assertEqual(17, factory_options['timeout'].total)
			self.assertEqual({'allow_redirects': False}, session.get_options)
			self.assertEqual('http://node.test:3000/transactionStatus/' + HASH, session.path)
			self.assertEqual(1, session.enter_count)
			self.assertEqual(1, session.exit_count)
			self.assertEqual(1, response.enter_count)
			self.assertEqual(1, response.exit_count)
			self.assertEqual(1 if status == 200 else 0, response.json_call_count)
			if expected_error is None:
				self.assertEqual({'ok': True}, result)

		# Act:
		for case in cases:
			with self.subTest(status=case[0], json_error=case[2]):
				assert_closed_resources(*case)

	def test_aiohttp_transport_maps_timeout_before_resource_acquisition(self):
		# Arrange:
		config = FakeNodeConfig()
		factory_options = {}

		def timeout_before_acquisition(**options):
			factory_options.update(options)
			raise asyncio.TimeoutError

		transport = AiohttpTransport(config, timeout_before_acquisition)

		# Act + Assert:
		with self.assertRaises(SymbolNodeUnavailable):
			asyncio.run(transport.get_json('transactionStatus/' + HASH))

		# Assert:
		self.assertEqual(config.timeout_seconds, factory_options['timeout'].total)


class AsyncLruCacheTest(TestCase):
	def test_async_cache_evicts_least_recently_used_entry(self):
		# Arrange:
		cache = AsyncLruCache(5, 2, lambda: 1)
		loader_calls = []

		async def load(key):
			loader_calls.append(key)
			return f'{key}-{loader_calls.count(key)}'

		# Act:
		values = (
			asyncio.run(cache.get_or_load('A', lambda: load('A'))),
			asyncio.run(cache.get_or_load('B', lambda: load('B'))),
			asyncio.run(cache.get_or_load('A', lambda: load('A'))),
			asyncio.run(cache.get_or_load('C', lambda: load('C'))),
			asyncio.run(cache.get_or_load('B', lambda: load('B')))
		)

		# Assert:
		self.assertEqual(('A-1', 'B-1', 'A-1', 'C-1', 'B-2'), values)
		self.assertEqual(['A', 'B', 'C', 'B'], loader_calls)
		self.assertEqual(['C', 'B'], list(cache.entries.keys()))

	def test_async_cache_expires_at_exact_ttl(self):
		# Arrange:
		clock_value = [0]
		cache = AsyncLruCache(5, 2, lambda: clock_value[0])
		loader_calls = []

		async def load(value):
			loader_calls.append(value)
			return value

		# Act:
		self.assertEqual('first', asyncio.run(cache.get_or_load('key', lambda: load('first'))))
		clock_value[0] = 5
		self.assertEqual('expired', asyncio.run(cache.get_or_load('key', lambda: load('expired'))))

		# Assert:
		self.assertEqual(['first', 'expired'], loader_calls)

	def test_async_cache_keeps_threaded_access_within_capacity(self):  # pylint: disable=too-many-locals,too-many-statements
		# Arrange:
		read_clock_entered = Event()
		release_read = Event()
		pause_read = [False]

		def clock():
			if pause_read[0]:
				pause_read[0] = False
				read_clock_entered.set()
				if not release_read.wait(timeout=5):
					raise RuntimeError('timed out waiting for cache read release')

			return 1

		cache = AsyncLruCache(5, 2, clock)
		loader_calls = []

		async def load(value):
			loader_calls.append(value)
			return value

		asyncio.run(cache.get_or_load('A', lambda: load('A')))
		asyncio.run(cache.get_or_load('B', lambda: load('B')))
		pause_read[0] = True

		results = {}
		errors = []
		insert_attempted = Event()
		insert_lock_probe = []
		read_done = Event()
		insert_done = Event()
		threads = []
		started_threads = []
		insert_thread = [None]
		underlying_lock = cache.lock

		class RecordingLock:
			def __init__(self, lock):
				self.lock = lock

			def acquire(self, blocking=True):
				return self.lock.acquire(blocking=blocking)

			def release(self):
				self.lock.release()

			def __enter__(self):
				if current_thread() is insert_thread[0]:
					probe = self.acquire(blocking=False)
					insert_lock_probe.append(probe)
					insert_attempted.set()
					if probe:
						self.release()

				self.acquire()
				return self

			def __exit__(self, _exception_type, _exception, _traceback):
				self.release()

		cache.lock = RecordingLock(underlying_lock)
		try:
			def read_a():
				try:
					results['read'] = asyncio.run(cache.get_or_load('A', lambda: load('unexpected-A')))
				except Exception as error:  # pylint: disable=broad-exception-caught
					errors.append(error)
				finally:
					read_done.set()

			def insert_c():
				insert_thread[0] = current_thread()
				try:
					results['insert'] = asyncio.run(cache.get_or_load('C', lambda: load('C')))
				except Exception as error:  # pylint: disable=broad-exception-caught
					errors.append(error)
				finally:
					insert_done.set()

			threads = [Thread(target=read_a), Thread(target=insert_c)]
			threads[0].start()
			started_threads.append(threads[0])
			self.assertTrue(read_clock_entered.wait(timeout=5))
			threads[1].start()
			started_threads.append(threads[1])
			self.assertTrue(insert_attempted.wait(timeout=5))
			self.assertEqual([False], insert_lock_probe)
			self.assertFalse(read_done.is_set())
			self.assertFalse(insert_done.is_set())
			release_read.set()
			for thread in started_threads:
				thread.join(timeout=5)
				self.assertFalse(thread.is_alive())
		finally:
			release_read.set()
			for thread in started_threads:
				thread.join(timeout=5)

		# Assert:
		self.assertEqual(['A', 'B', 'C'], loader_calls)
		self.assertEqual([], errors)
		self.assertEqual({'read': 'A', 'insert': 'C'}, results)
		self.assertEqual(['A', 'C'], list(cache.entries))
		self.assertEqual(2, len(cache.entries))

	def test_async_cache_allows_other_key_while_loader_awaits(self):
		# Arrange:
		cache = AsyncLruCache(5, 2, lambda: 1)
		loader_started = Event()
		release_loader = Event()
		other_finished = Event()
		results = []
		loader_calls = []
		threads = []
		started_threads = []

		async def blocked_loader():
			loader_calls.append('A')
			loader_started.set()
			if not release_loader.wait(timeout=5):
				raise RuntimeError('timed out waiting for blocked cache loader')
			return 'A'

		async def other_loader():
			loader_calls.append('B')
			return 'B'

		def load_a():
			results.append(asyncio.run(cache.get_or_load('A', blocked_loader)))

		def load_b():
			results.append(asyncio.run(cache.get_or_load('B', other_loader)))
			other_finished.set()

		try:
			# Act: keep A's loader suspended while B must complete independently.
			threads = [Thread(target=load_a), Thread(target=load_b)]
			threads[0].start()
			started_threads.append(threads[0])
			self.assertTrue(loader_started.wait(timeout=5))
			threads[1].start()
			started_threads.append(threads[1])
			self.assertTrue(other_finished.wait(timeout=5))
		finally:
			release_loader.set()
			for thread in started_threads:
				thread.join(timeout=5)

		# Assert:
		self.assertTrue(all(not thread.is_alive() for thread in threads))
		self.assertEqual(['A', 'B'], loader_calls)
		self.assertEqual({'A', 'B'}, set(results))
		self.assertEqual({'A', 'B'}, set(cache.entries))


class SymbolTransactionNodeBackingStatusTest(TestCase):
	def test_status_validation_rejects_unknown_groups_mismatched_hashes_and_invalid_heights(self):
		# Arrange:
		config = FakeNodeConfig()
		invalid_statuses = (
			None, {'group': 'unknown', 'hash': HASH}, {'group': 'partial', 'hash': '00' * 32},
			{'group': 'confirmed', 'hash': HASH, 'height': True}, {'group': 'confirmed', 'hash': HASH, 'height': 'bad'},
			{'group': 'confirmed', 'hash': HASH, 'height': 1.5}, {'group': 'confirmed', 'hash': HASH, 'height': {}},
			{'group': 'confirmed', 'hash': HASH, 'height': 0}, {'group': 'failed', 'hash': '00' * 32}
		)

		# Act + Assert:
		for payload in invalid_statuses:
			with self.subTest(status=payload):
				backing = SymbolTransactionNodeBacking(
					config, Network.TESTNET, transport=FakeTransport({f'transactionStatus/{HASH}': payload}), native_mosaic_info=NATIVE_MOSAIC_INFO)
				with self.assertRaises(SymbolNodeUnavailable):
					asyncio.run(backing.get_status(HASH))

	def test_transaction_get_rejects_missing_node_payload(self):
		# Arrange:
		backing = SymbolTransactionNodeBacking(
			FakeNodeConfig(),
			Network.TESTNET,
			transport=FakeTransport({}),
			native_mosaic_info=NATIVE_MOSAIC_INFO
		)

		# Act + Assert:
		with self.assertRaises(SymbolNodeUnavailable):
			asyncio.run(backing.get_transaction('confirmed', HASH))

	def test_transaction_record_validation_rejects_malformed_node_shapes(self):
		# Arrange:
		invalid_payloads = (None, {'transaction': 1}, {'transaction': {}, 'meta': {'hash': '00' * 32}})

		# Act + Assert:
		for payload in invalid_payloads:
			with self.subTest(payload=payload):
				backing = SymbolTransactionNodeBacking(
					FakeNodeConfig(), Network.TESTNET,
					transport=FakeTransport({f'transactions/unconfirmed/{HASH}': payload}), native_mosaic_info=NATIVE_MOSAIC_INFO)
				with self.assertRaises(SymbolNodeUnavailable):
					asyncio.run(backing.get_transaction('unconfirmed', HASH))

	def test_hash_lock_validation_rejects_malformed_node_shapes(self):
		# Arrange:
		invalid_payloads = (
			None, {'lock': 1}, {'lock': {'hash': '00' * 32}},
			{'lock': {'hash': HASH, 'status': 2, 'ownerAddress': ADDRESS, 'mosaicId': '72C0212E67A08BCE', 'amount': 1, 'endHeight': 2}},
			{'lock': {'hash': HASH, 'status': 0, 'ownerAddress': ADDRESS}})

		# Act + Assert:
		for payload in invalid_payloads:
			with self.subTest(payload=payload):
				backing = SymbolTransactionNodeBacking(
					FakeNodeConfig(), Network.TESTNET,
					transport=FakeTransport({f'lock/hash/{HASH}': payload}), native_mosaic_info=NATIVE_MOSAIC_INFO)
				with self.assertRaises(SymbolNodeUnavailable):
					asyncio.run(backing.try_get_hash_lock(HASH))

	def test_formal_failed_status_is_not_cached(self):
		# Arrange:
		path = f'transactionStatus/{HASH}'
		transport = FakeTransport({path: {'group': 'failed', 'hash': HASH}})
		backing = SymbolTransactionNodeBacking(FakeNodeConfig(), Network.TESTNET, transport=transport, native_mosaic_info=NATIVE_MOSAIC_INFO)

		# Act + Assert:
		with self.assertRaises(SymbolNodeNotFound):
			asyncio.run(backing.get_status(HASH))
		self.assertEqual({}, backing.caches['status'].entries)

		transport.responses[path] = {'group': 'unconfirmed', 'hash': HASH}
		self.assertEqual('unconfirmed', asyncio.run(backing.get_status(HASH))['group'])
		self.assertEqual([path, path], transport.paths)

	def test_invalid_status_is_not_cached(self):
		# Arrange:
		path = f'transactionStatus/{HASH}'
		transport = FakeTransport({path: {'group': 'unconfirmed', 'hash': '00' * 32}})
		backing = SymbolTransactionNodeBacking(FakeNodeConfig(), Network.TESTNET, transport=transport, native_mosaic_info=NATIVE_MOSAIC_INFO)

		# Act + Assert:
		with self.assertRaises(SymbolNodeUnavailable):
			asyncio.run(backing.get_status(HASH))
		self.assertEqual({}, backing.caches['status'].entries)

		transport.responses[path] = {'group': 'unconfirmed', 'hash': HASH}
		self.assertEqual('unconfirmed', asyncio.run(backing.get_status(HASH))['group'])
		self.assertEqual([path, path], transport.paths)

	def test_invalid_message_hex_is_not_cached(self):
		# Arrange:
		path = f'transactions/unconfirmed/{HASH}'
		invalid = _transaction_payload()
		invalid['transaction']['message'] = '00GG'
		transport = FakeTransport({path: invalid})
		backing = SymbolTransactionNodeBacking(FakeNodeConfig(), Network.TESTNET, transport=transport, native_mosaic_info=NATIVE_MOSAIC_INFO)

		# Act + Assert:
		with self.assertRaises(SymbolNodeUnavailable):
			asyncio.run(backing.get_transaction('unconfirmed', HASH))
		self.assertEqual({}, backing.caches['unconfirmed'].entries)

		transport.responses[path] = _transaction_payload()
		transport.responses[path]['transaction']['message'] = '00'
		self.assertEqual('00', asyncio.run(backing.get_transaction('unconfirmed', HASH))['transaction']['message'])
		self.assertEqual([path, path], transport.paths)

	def test_invalid_message_type_is_not_cached_then_accepts_unknown_hex_marker(self):
		# Arrange:
		path = f'transactions/unconfirmed/{HASH}'
		transport = FakeTransport({path: _transaction_payload()})
		backing = SymbolTransactionNodeBacking(
			FakeNodeConfig(), Network.TESTNET, transport=transport, native_mosaic_info=NATIVE_MOSAIC_INFO)

		for message in (
			{'type': {'invalid': 'object'}, 'payload': 'AA'},
			{'type': 'GARBAGE', 'payload': 'AA'},
			{'type': [], 'payload': 'AA'},
			{'type': True, 'payload': 'AA'}):
			transport.responses[path]['transaction']['message'] = message
			# Act + Assert:
			with self.assertRaises(SymbolNodeUnavailable):
				asyncio.run(backing.get_transaction('unconfirmed', HASH))

		# Act: an unknown hex marker is valid and must retain its original payload.
		transport.responses[path] = _transaction_payload()
		transport.responses[path]['transaction']['message'] = 'FF'
		result = asyncio.run(backing.get_transaction('unconfirmed', HASH))
		result['transaction']['message'] = 'mutated-result'
		transport.responses[path] = _transaction_payload()
		transport.responses[path]['transaction']['message'] = {'type': [], 'payload': 'AA'}
		cached_result = asyncio.run(backing.get_transaction('unconfirmed', HASH))

		# Assert:
		self.assertEqual('mutated-result', result['transaction']['message'])
		self.assertEqual('FF', cached_result['transaction']['message'])
		self.assertEqual([path] * 5, transport.paths)
		self.assertEqual(1, len(backing.caches['unconfirmed'].entries))

	def test_invalid_mosaic_flags_are_not_cached(self):
		# Arrange:
		path = f'transactions/unconfirmed/{HASH}'
		invalid = _transaction_payload()
		invalid['transaction'].update({
			'type': TransactionType.MOSAIC_DEFINITION.value, 'id': '01', 'divisibility': 0,
			'duration': 1, 'nonce': 1, 'flags': 16})
		transport = FakeTransport({path: invalid})
		backing = SymbolTransactionNodeBacking(FakeNodeConfig(), Network.TESTNET, transport=transport, native_mosaic_info=NATIVE_MOSAIC_INFO)

		# Act + Assert:
		with self.assertRaises(SymbolNodeUnavailable):
			asyncio.run(backing.get_transaction('unconfirmed', HASH))
		# Arrange:
		transport.responses[path]['transaction']['flags'] = 0

		# Act:
		result = asyncio.run(backing.get_transaction('unconfirmed', HASH))

		# Assert:
		self.assertEqual((HASH, 0), (result['meta']['hash'], result['transaction']['flags']))
		self.assertEqual([path, path], transport.paths)

	def test_valid_message_hex_forms_are_preserved(self):
		# Arrange:
		backing = SymbolTransactionNodeBacking(
			FakeNodeConfig(),
			Network.TESTNET,
			transport=FakeTransport({}),
			native_mosaic_info=NATIVE_MOSAIC_INFO
		)
		cases = (
			('', None, ''),
			('00', 'plain', ''),
			('FF', None, 'FF'),
			('00FF', 'plain', 'FF')
		)

		# Act + Assert:
		for message, expected_type, expected_payload in cases:
			transaction = _transaction_payload()
			transaction['transaction']['message'] = message
			record = backing.to_detail_record(transaction, 'unconfirmed', HASH).transaction
			self.assertEqual((expected_type, expected_payload), (record.message_type, record.message_payload), message)

	def test_status_and_detail_use_allowed_paths_and_cache_only_positive_results(self):
		# Arrange:
		config = FakeNodeConfig()
		transport = FakeTransport({
			f'transactionStatus/{HASH}': {'group': 'unconfirmed', 'hash': HASH},
			f'transactions/unconfirmed/{HASH}': _transaction_payload()
		})
		backing = SymbolTransactionNodeBacking(
			config,
			Network.TESTNET,
			transport=transport,
			clock=lambda: 1,
			native_mosaic_info=NATIVE_MOSAIC_INFO
		)

		# Act:
		first_status = asyncio.run(backing.get_status(HASH.lower()))
		second_status = asyncio.run(backing.get_status(HASH.lower()))
		first_detail = asyncio.run(backing.get_transaction('unconfirmed', HASH.lower()))
		second_detail = asyncio.run(backing.get_transaction('unconfirmed', HASH.lower()))

		# Assert:
		self.assertEqual('unconfirmed', first_status['group'])
		self.assertEqual(first_status, second_status)
		self.assertEqual(first_detail, second_detail)
		self.assertEqual([
			f'transactionStatus/{HASH}',
			f'transactions/unconfirmed/{HASH}'
		], transport.paths)
		self.assertEqual([config.base_url] * 2, config.allowed_calls)

	def test_status_cache_expires_at_ttl(self):
		# Arrange:
		config = FakeNodeConfig()
		transport = FakeTransport({f'transactionStatus/{HASH}': {'group': 'partial', 'hash': HASH}})
		clock_value = [0]
		backing = SymbolTransactionNodeBacking(
			config,
			Network.TESTNET,
			transport=transport,
			clock=lambda: clock_value[0],
			native_mosaic_info=NATIVE_MOSAIC_INFO
		)

		# Act:
		asyncio.run(backing.get_status(HASH))
		clock_value[0] = 10
		asyncio.run(backing.get_status(HASH))
		# Assert:
		self.assertEqual([f'transactionStatus/{HASH}'] * 2, transport.paths)

	def test_status_request_rechecks_node_policy_after_cache_expiry(self):
		# Arrange:
		config = FakeNodeConfig()
		transport = FakeTransport({f'transactionStatus/{HASH}': {'group': 'partial', 'hash': HASH}})
		clock_value = [0]
		backing = SymbolTransactionNodeBacking(
			config,
			Network.TESTNET,
			transport=transport,
			clock=lambda: clock_value[0],
			native_mosaic_info=NATIVE_MOSAIC_INFO
		)
		asyncio.run(backing.get_status(HASH))
		clock_value[0] = 10
		config.assert_request_allowed = lambda _url: (_ for _ in ()).throw(SymbolNodeConfigurationError('blocked'))

		# Act + Assert:
		with self.assertRaises(SymbolNodeUnavailable):
			asyncio.run(backing.get_status(HASH))

		# Assert:
		self.assertEqual([f'transactionStatus/{HASH}'], transport.paths)

	def test_missing_hash_lock_returns_none_without_caching(self):
		# Arrange:
		config = FakeNodeConfig()
		transport = FakeTransport({
			f'lock/hash/{HASH}': SymbolNodeNotFound()
		})
		backing = SymbolTransactionNodeBacking(config, Network.TESTNET, transport=transport, native_mosaic_info=NATIVE_MOSAIC_INFO)

		# Act:
		self.assertIsNone(asyncio.run(backing.try_get_hash_lock(HASH)))
		self.assertIsNone(asyncio.run(backing.try_get_hash_lock(HASH)))

		# Assert:
		self.assertEqual([f'lock/hash/{HASH}'] * 2, transport.paths)

	def test_node_detail_is_converted_to_pending_record(self):
		# Arrange:
		backing = SymbolTransactionNodeBacking(
			FakeNodeConfig(),
			Network.TESTNET,
			transport=FakeTransport({}),
			native_mosaic_info=NATIVE_MOSAIC_INFO
		)

		# Act:
		record = backing.to_detail_record(_transaction_payload(), 'unconfirmed', HASH)

		# Assert:
		self.assertFalse(record.transaction.is_embedded)
		self.assertIsNone(record.block)
		self.assertEqual(HASH, record.transaction.hash.hex().upper())
		self.assertEqual('plain', record.transaction.message_type)
		self.assertEqual('4869', record.transaction.message_payload)

	def test_node_detail_rejects_invalid_network(self):
		# Arrange:
		backing = SymbolTransactionNodeBacking(
			FakeNodeConfig(),
			Network.TESTNET,
			transport=FakeTransport({}),
			native_mosaic_info=NATIVE_MOSAIC_INFO
		)
		invalid = _transaction_payload()
		invalid['transaction']['network'] = Network.MAINNET.identifier

		# Act + Assert:
		with self.assertRaises(SymbolNodeUnavailable):
			backing.to_detail_record(invalid, 'partial', HASH)

	def test_cache_rejects_malformed_type_body_then_accepts_corrected_response(self):
		# Arrange:
		bad = _transaction_payload()
		bad['transaction'].update({'type': TransactionType.ADDRESS_ALIAS.value, 'namespaceId': '01'})
		good = _transaction_payload()
		good['transaction'].update({
			'type': TransactionType.ADDRESS_ALIAS.value, 'namespaceId': '01', 'aliasAction': 1,
			'address': ADDRESS})
		transport = FakeTransport({f'transactions/unconfirmed/{HASH}': bad})
		backing = SymbolTransactionNodeBacking(FakeNodeConfig(), Network.TESTNET, transport=transport, native_mosaic_info=NATIVE_MOSAIC_INFO)

		# Act + Assert:
		with self.assertRaises(SymbolNodeUnavailable):
			asyncio.run(backing.get_transaction('unconfirmed', HASH))
		transport.responses[f'transactions/unconfirmed/{HASH}'] = good
		self.assertEqual(HASH, asyncio.run(backing.get_transaction('unconfirmed', HASH))['meta']['hash'])
		self.assertEqual([f'transactions/unconfirmed/{HASH}'] * 2, transport.paths)

	def test_cache_rejects_malformed_enum_then_accepts_corrected_response_after_view_validation(self):
		# Arrange:
		bad = _transaction_payload()
		bad['transaction'].update({
			'type': TransactionType.SECRET_LOCK.value, 'duration': 1, 'secret': 'AA' * 32,
			'hashAlgorithm': 'invalid', 'mosaicId': NATIVE_MOSAIC_INFO.id, 'amount': '100'})
		good = _transaction_payload()
		good['transaction'].update({
			'type': TransactionType.SECRET_LOCK.value, 'duration': 1, 'secret': 'AA' * 32,
			'hashAlgorithm': 0, 'mosaicId': NATIVE_MOSAIC_INFO.id, 'amount': '100'})
		transport = FakeTransport({f'transactions/unconfirmed/{HASH}': bad})
		backing = SymbolTransactionNodeBacking(
			FakeNodeConfig(), Network.TESTNET, transport=transport, native_mosaic_info=NATIVE_MOSAIC_INFO)

		# Act + Assert:
		with self.assertRaises(SymbolNodeUnavailable):
			asyncio.run(backing.get_transaction('unconfirmed', HASH))
		transport.responses[f'transactions/unconfirmed/{HASH}'] = good
		self.assertEqual(HASH, asyncio.run(backing.get_transaction('unconfirmed', HASH))['meta']['hash'])
		self.assertEqual([f'transactions/unconfirmed/{HASH}'] * 2, transport.paths)

	def test_status_rejects_array_and_object_groups(self):
		# Arrange:
		for group in ([], {}):
			transport = FakeTransport({f'transactionStatus/{HASH}': {'group': group, 'hash': HASH}})
			backing = SymbolTransactionNodeBacking(FakeNodeConfig(), Network.TESTNET, transport=transport, native_mosaic_info=NATIVE_MOSAIC_INFO)

			# Act + Assert:
			with self.assertRaises(SymbolNodeUnavailable):
				asyncio.run(backing.get_status(HASH))

	def test_node_detail_uses_mainnet_network_when_configured(self):
		# Arrange:
		payload = _transaction_payload()
		payload['transaction']['network'] = Network.MAINNET.identifier
		backing = SymbolTransactionNodeBacking(
			FakeNodeConfig(),
			Network.MAINNET,
			transport=FakeTransport({}),
			native_mosaic_info=NATIVE_MOSAIC_INFO
		)

		# Act:
		record = backing.to_detail_record(payload, 'partial', HASH)

		# Assert:
		self.assertFalse(record.transaction.is_embedded)
