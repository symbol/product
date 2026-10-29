# pylint: disable=too-many-lines  # one contract matrix covers all detail types

import sys
from datetime import datetime
from unittest import TestCase

from common.symbol.NativeMosaic import NativeMosaicInfo
from symbolchain.CryptoTypes import PublicKey
from symbolchain.sc import MosaicFlags, TransactionType
from symbolchain.symbol.Network import Address, Network

from rest.db.SymbolDatabaseCommon import TransactionMosaicRecord
from rest.db.SymbolTransactionDetail import (
	TransactionDetailBlockRecord,
	TransactionDetailRecord,
	TransactionDetailTransactionRecord,
	TransactionHashLockRecord
)
from rest.model.symbol.Transaction import SymbolTransactionDetailView, is_aggregate_transaction_type
from rest.model.symbol.validation import SymbolDataInvalid

NATIVE_MOSAIC_INFO = NativeMosaicInfo('72C0212E67A08BCE', 6)
SIGNER_ADDRESS = bytes.fromhex('98' + '01' * 23)
RECIPIENT_ADDRESS = bytes.fromhex('98' + '02' * 23)
SIGNER_PUBLIC_KEY = bytes.fromhex('01' * 32)
SIGNATURE = bytes.fromhex('CD' * 64)
SOURCE_ADDRESS = bytes.fromhex('98' + '03' * 23)


def _create_transaction(transaction_type, body, mosaics=(), **overrides):
	values = {
		'transaction_id': 1,
		'hash': bytes.fromhex('AB' * 32),
		'is_embedded': False,
		'aggregate_hash': None,
		'embedded_index': None,
		'height': 7,
		'transaction_type': transaction_type,
		'type_name': 'transaction',
		'version': 1,
		'signer_public_key': SIGNER_PUBLIC_KEY,
		'signer_address': SIGNER_ADDRESS,
		'recipient_address': RECIPIENT_ADDRESS,
		'target_address': RECIPIENT_ADDRESS,
		'source_address': SIGNER_ADDRESS,
		'effective_fee': 100,
		'timestamp': datetime(2026, 1, 7),
		'deadline': datetime(2026, 1, 8),
		'max_fee': 1000,
		'size': 200,
		'signature': SIGNATURE,
		'message_type': None,
		'message_payload': None,
		'body': {'network': Network.TESTNET.identifier, **body} if isinstance(body, dict) else body,
		'raw_payload': {'transaction': {'network': Network.TESTNET.identifier, 'version': 1, 'signature': 'CD' * 64}},
		'mosaics': mosaics
	}
	values.update(overrides)
	return TransactionDetailTransactionRecord(**values)


def _create_detail(transaction, children=(), hash_lock=None, namespace_names=None, cosignatures=()):
	return TransactionDetailRecord(
		transaction,
		TransactionDetailBlockRecord(7, bytes.fromhex('EF' * 32), datetime(2026, 1, 7), 123),
		tuple(children),
		tuple(cosignatures),
		hash_lock,
		namespace_names or {})


class SymbolTransactionDetailViewTest(TestCase):  # pylint: disable=too-many-public-methods  # grouped public DTO contract cases
	def test_to_dict_returns_exact_transfer_envelope_and_list_compatible_values(self):
		# Arrange:
		transaction = _create_transaction(
			16724,
			{},
			mosaics=(TransactionMosaicRecord('72C0212E67A08BCE', 1234567, 'transfer', 0, None, ()),),
			message_type='plain',
			message_payload='48656C6C6F')

		# Act + Assert:
		result = SymbolTransactionDetailView(_create_detail(transaction)).to_dict(NATIVE_MOSAIC_INFO, Network.TESTNET)

		# Assert:
		self.assertEqual({
			'hash', 'isEmbedded', 'aggregateHash', 'embeddedIndex', 'group', 'type', 'version', 'info', 'detail',
			'aggregate', 'hashLock', 'graphic'
		}, set(result))
		self.assertEqual({
			'height': 7,
			'timestamp': '2026-01-07 00:00:00',
			'fee': 0.0001,
			'value': [{'id': '72C0212E67A08BCE', 'name': '72C0212E67A08BCE', 'amount': 1.234567}],
			'amount': 1.234567,
			'maxFee': 0.001,
			'deadline': '2026-01-08 00:00:00',
			'sender': 'TAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAI',
			'recipient': 'TABAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQ',
			'signerPublicKey': '01' * 32,
			'signature': 'CD' * 64,
			'size': 200,
			'block': {
				'height': 7,
				'hash': 'EF' * 32,
				'timestamp': '2026-01-07 00:00:00',
				'feeMultiplier': 123
			}
		}, result['info'])
		self.assertEqual({
			'recipient': 'TABAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQ',
			'mosaics': [{'id': '72C0212E67A08BCE', 'name': '72C0212E67A08BCE', 'amount': 1.234567}],
			'message': {'type': 'plain', 'text': 'Hello'}
		}, result['detail'])

	def test_to_dict_keeps_embedded_identity_and_null_parent_only_fields(self):
		# Arrange:
		parent_hash = bytes.fromhex('AB' * 32)
		child = _create_transaction(
			16724,
			{},
			is_embedded=True,
			hash=None,
			aggregate_hash=parent_hash,
			embedded_index=0,
			effective_fee=None,
			deadline=None,
			max_fee=None,
			size=None,
			signature=None)
		parent = _create_transaction(16705, {'transactionsHash': 'AA' * 32})
		parent = parent._replace(hash=parent_hash)

		# Act + Assert:
		result = SymbolTransactionDetailView(_create_detail(parent, [child])).to_dict(NATIVE_MOSAIC_INFO, Network.TESTNET)

		# Assert:
		embedded = result['aggregate']['embeddedTransactions'][0]
		self.assertEqual(None, embedded['hash'])
		self.assertEqual(True, embedded['isEmbedded'])
		self.assertEqual('AB' * 32, embedded['aggregateHash'])
		self.assertEqual(0, embedded['embeddedIndex'])
		self.assertEqual('TRANSFER', embedded['type'])
		self.assertIsNone(embedded['info']['fee'])
		self.assertIsNone(embedded['info']['maxFee'])
		self.assertIsNone(embedded['info']['deadline'])
		self.assertIsNone(embedded['info']['signature'])
		self.assertIsNone(embedded['info']['size'])

	def test_to_dict_excludes_metadata_target_from_value_and_keeps_aggregate_amount_on_children(self):
		# Arrange:
		parent_hash = bytes.fromhex('AB' * 32)
		parent = _create_transaction(16705, {'transactionsHash': 'AA' * 32}, hash=parent_hash)
		child = _create_transaction(
			16724,
			{},
			is_embedded=True,
			hash=None,
			aggregate_hash=parent_hash,
			embedded_index=0,
			effective_fee=None,
			deadline=None,
			max_fee=None,
			size=None,
			signature=None,
			mosaics=(
				TransactionMosaicRecord('72C0212E67A08BCE', 1000000, 'transfer', 0, None, ('native',)),
				TransactionMosaicRecord('0000000000000001', 9, 'metadata_target', 1, 0, ('private-target',))
			))

		# Act + Assert:
		result = SymbolTransactionDetailView(_create_detail(parent, [child])).to_dict(NATIVE_MOSAIC_INFO, Network.TESTNET)

		# Assert:
		self.assertEqual(0, result['info']['amount'])
		self.assertEqual(1.0, result['aggregate']['embeddedTransactions'][0]['info']['amount'])
		expected_value = [{'id': '72C0212E67A08BCE', 'name': 'native', 'amount': 1.0}]
		self.assertEqual(expected_value, result['aggregate']['embeddedTransactions'][0]['info']['value'])

	def test_to_dict_reports_zero_amount_for_aggregate_parent_with_transfer_mosaic(self):
		# Arrange:
		parent = _create_transaction(
			TransactionType.AGGREGATE_BONDED.value,
			{'transactionsHash': 'AA' * 32},
			mosaics=(TransactionMosaicRecord('72C0212E67A08BCE', 1000000, 'transfer', 0, None, ()),))

		# Act + Assert:
		result = SymbolTransactionDetailView(_create_detail(parent)).to_dict(NATIVE_MOSAIC_INFO, Network.TESTNET)

		# Assert:
		self.assertEqual(0, result['info']['amount'])

	def test_to_dict_derives_cosigner_address_from_saved_public_key(self):
		# Arrange:
		cosignature = {'signerPublicKey': '02' * 32, 'signature': 'AB' * 64}
		parent = _create_transaction(16705, {'transactionsHash': 'AA' * 32, 'cosignatures': [cosignature]})

		# Act + Assert:
		result = SymbolTransactionDetailView(_create_detail(parent, cosignatures=[cosignature])).to_dict(
			NATIVE_MOSAIC_INFO, Network.TESTNET)

		# Assert:
		self.assertEqual({
			'signer': str(Network.TESTNET.public_key_to_address(PublicKey(bytes.fromhex('02' * 32)))),
			'signature': 'AB' * 64
		}, result['aggregate']['cosignatures'][0])

	def test_to_dict_rejects_cosignature_with_invalid_signature_hex(self):
		# Arrange:
		cosignature = {'signerPublicKey': '02' * 32, 'signature': 'bad'}
		parent = _create_transaction(16705, {'transactionsHash': 'AA' * 32, 'cosignatures': [cosignature]})

		# Act + Assert:
		with self.assertRaises(SymbolDataInvalid) as error:
			SymbolTransactionDetailView(_create_detail(parent, cosignatures=[cosignature])).to_dict(
				NATIVE_MOSAIC_INFO, Network.TESTNET)
		self.assertEqual('transaction.cosignatures.signature', error.exception.field_path)
		self.assertEqual('expected 128-character hexadecimal value', error.exception.reason)

	def test_to_dict_rejects_malformed_cosignature(self):
		# Arrange:
		parent = _create_transaction(16705, {'transactionsHash': 'AA' * 32})
		bad_parent = parent._replace(body={
			'network': Network.TESTNET.identifier,
			'transactionsHash': 'AA' * 32,
			'cosignatures': [{'signerPublicKey': 'bad', 'signature': 'AB' * 64}]})

		# Act + Assert:
		with self.assertRaises(SymbolDataInvalid) as error:
			SymbolTransactionDetailView(_create_detail(
				bad_parent, cosignatures=[{'signerPublicKey': 'bad', 'signature': 'AB' * 64}])).to_dict(
					NATIVE_MOSAIC_INFO, Network.TESTNET)
		self.assertEqual('transaction.cosignatures.signerPublicKey', error.exception.field_path)
		self.assertEqual('expected 64-character hexadecimal value', error.exception.reason)

	def test_to_dict_uses_original_supply_delta_and_fixed_width_mosaic_id(self):
		# Arrange:
		large_value = str(2 ** 53 + 1)
		supply = _create_transaction(
			16973,
			{'mosaicId': '01', 'action': 0, 'delta': large_value},
			mosaics=(TransactionMosaicRecord('0000000000001234', 0, 'definition', 0, 0, ()),))

		# Act + Assert:
		supply_result = SymbolTransactionDetailView(_create_detail(supply)).to_dict(NATIVE_MOSAIC_INFO, Network.TESTNET)

		# Assert:
		self.assertEqual({'mosaicId': '0000000000001234', 'action': 'decrease', 'delta': large_value}, supply_result['detail'])

	def test_to_dict_uses_original_restriction_values_and_fixed_width_ids(self):
		# Arrange:
		large_value = str(2 ** 53 + 1)
		max_value = str(2 ** 64 - 1)
		restriction = _create_transaction(16977, {
			'mosaicId': '01', 'restrictionKey': '02', 'previousRestrictionValue': large_value, 'newRestrictionValue': max_value
		}, mosaics=(TransactionMosaicRecord('0000000000001234', 0, 'restriction', 0, 0, ()),))

		# Act + Assert:
		restriction_result = SymbolTransactionDetailView(_create_detail(restriction)).to_dict(
			NATIVE_MOSAIC_INFO, Network.TESTNET)

		# Assert:
		self.assertEqual('0000000000001234', restriction_result['detail']['mosaicId'])
		self.assertEqual('0000000000000002', restriction_result['detail']['restrictionKey'])
		self.assertEqual(large_value, restriction_result['detail']['previousRestrictionValue'])
		self.assertEqual(max_value, restriction_result['detail']['newRestrictionValue'])

	def test_to_dict_rejects_non_decimal_or_out_of_range_numeric_values(self):
		# Arrange:
		cases = (
			(_create_transaction(16712, {'duration': 1.5, 'hash': 'AA' * 32}), 'expected uint64 decimal value'),
			(_create_transaction(16712, {'duration': str(2 ** 64), 'hash': 'AA' * 32}), 'uint64 value is out of range'),
			(_create_transaction(
				16973,
				{'mosaicId': '01', 'action': 0, 'delta': -1},
				mosaics=(TransactionMosaicRecord('0000000000001234', 0, 'definition', 0, 0, ()),)),
				'expected uint64 decimal value')
		)

		# Act + Assert:
		for transaction, expected_reason in cases:
			with self.subTest(transaction_type=transaction.transaction_type):
				with self.assertRaises(SymbolDataInvalid) as error:
					SymbolTransactionDetailView(_create_detail(transaction)).to_dict(NATIVE_MOSAIC_INFO, Network.TESTNET)
				self.assertEqual('transaction.decimal', error.exception.field_path)
				self.assertEqual(expected_reason, error.exception.reason)

	def test_to_dict_rejects_decimal_conversion_limit_values(self):
		# Arrange:
		if not hasattr(sys, 'get_int_max_str_digits') or not hasattr(sys, 'set_int_max_str_digits'):
			self.skipTest('Python integer conversion limit API is unavailable')

		previous_limit = sys.get_int_max_str_digits()
		try:
			sys.set_int_max_str_digits(640)
			for duration in ('9' * 5000, 10 ** 5000):
				transaction = _create_transaction(16712, {'duration': duration, 'hash': 'AA' * 32})

				# Act + Assert:
				with self.assertRaises(SymbolDataInvalid) as error:
					SymbolTransactionDetailView(_create_detail(transaction)).to_dict(NATIVE_MOSAIC_INFO, Network.TESTNET)
				self.assertEqual('transaction.decimal', error.exception.field_path)
				self.assertEqual('expected uint64 decimal value', error.exception.reason)
		finally:
			sys.set_int_max_str_digits(previous_limit)

	def test_to_dict_rejects_lossy_or_wrong_network_representations(self):
		# Arrange:
		cases = []
		for configured_network in (Network.TESTNET, Network.MAINNET):
			fractional_network = 104.9 if configured_network == Network.MAINNET else 152.9
			cases.extend((
				(configured_network, 'transaction.body.network', _create_transaction(
					16724, {'network': fractional_network}, raw_payload={'transaction': {
						'network': configured_network.identifier, 'version': 1, 'signature': 'CD' * 64}})),
				(configured_network, 'transaction.rawPayload.transaction.network', _create_transaction(
					16724,
					{'network': configured_network.identifier},
					raw_payload={'transaction': {
						'network': fractional_network, 'version': 1, 'signature': 'CD' * 64}})),
				(configured_network, 'transaction.body.network', _create_transaction(
					16724, {'network': True}, raw_payload={'transaction': {
						'network': configured_network.identifier, 'version': 1, 'signature': 'CD' * 64}})),
				(configured_network, 'transaction.rawPayload.transaction.network', _create_transaction(
					16724,
					{'network': configured_network.identifier},
					raw_payload={'transaction': {
						'network': False, 'version': 1, 'signature': 'CD' * 64}})),
				(configured_network, 'transaction.body.network', _create_transaction(
					16724, {'network': 'not-a-network'}, raw_payload={'transaction': {
						'network': configured_network.identifier, 'version': 1, 'signature': 'CD' * 64}})),
				(configured_network, 'transaction.rawPayload.transaction.network', _create_transaction(
					16724,
					{'network': configured_network.identifier},
					raw_payload={'transaction': {
						'network': '', 'version': 1, 'signature': 'CD' * 64}}))
			))

		# Act + Assert:
		for configured_network, field_path, transaction in cases:
			with self.subTest(network=configured_network.name, field_path=field_path):
				with self.assertRaises(SymbolDataInvalid) as error:
					SymbolTransactionDetailView(_create_detail(transaction)).to_dict(NATIVE_MOSAIC_INFO, configured_network)
				self.assertEqual(field_path, error.exception.field_path)
				self.assertEqual('network does not match configured network', error.exception.reason)

	def test_to_dict_rejects_network_integer_conversion_limit(self):
		# Arrange:
		if not hasattr(sys, 'get_int_max_str_digits') or not hasattr(sys, 'set_int_max_str_digits'):
			self.skipTest('Python integer conversion limit API is unavailable')

		previous_limit = sys.get_int_max_str_digits()
		try:
			sys.set_int_max_str_digits(640)
			large_network = '9' * 5000
			cases = (
				('transaction.body.network', _create_transaction(16724, {'network': large_network})),
				('transaction.rawPayload.transaction.network', _create_transaction(
					16724,
					{'network': Network.TESTNET.identifier},
					raw_payload={'transaction': {
						'network': large_network, 'version': 1, 'signature': 'CD' * 64}}))
			)

			# Act + Assert:
			for field_path, transaction in cases:
				with self.subTest(field_path=field_path):
					with self.assertRaises(SymbolDataInvalid) as error:
						SymbolTransactionDetailView(_create_detail(transaction)).to_dict(
							NATIVE_MOSAIC_INFO, Network.TESTNET)
					self.assertEqual(field_path, error.exception.field_path)
					self.assertEqual('network does not match configured network', error.exception.reason)
		finally:
			sys.set_int_max_str_digits(previous_limit)

	def test_to_dict_rejects_malformed_hex_identifiers(self):
		# Arrange:
		cases = (
			(_create_transaction(TransactionType.NAMESPACE_REGISTRATION.value, {
				'id': '0000 0001', 'name': 'leaf', 'registrationType': 'root', 'parentId': None, 'duration': 1
			}), 'transaction.hex', 'invalid hexadecimal value'),
			(_create_transaction(TransactionType.ADDRESS_ALIAS.value, {
				'namespaceId': '01', 'aliasAction': 1, 'address': '98 ' + '01' * 23
			}), 'transaction.address', 'invalid address')
		)

		# Act + Assert:
		for transaction, field_path, reason in cases:
			with self.subTest(transaction_type=transaction.transaction_type):
				with self.assertRaises(SymbolDataInvalid) as error:
					SymbolTransactionDetailView(_create_detail(transaction)).to_dict(NATIVE_MOSAIC_INFO, Network.TESTNET)
				self.assertEqual(field_path, error.exception.field_path)
				self.assertEqual(reason, error.exception.reason)

	def test_to_dict_uses_current_address_alias_name_in_detail_and_graphic(self):
		# Arrange:
		address_alias = _create_transaction(16974, {
			'namespaceId': '01', 'aliasAction': 1, 'address': 'FF' + '00' * 23
		})

		# Act + Assert:
		alias_result = SymbolTransactionDetailView(_create_detail(
			address_alias, namespace_names={'01': 'alias.address'})).to_dict(NATIVE_MOSAIC_INFO, Network.TESTNET)

		# Assert:
		self.assertEqual('namespace:0000000000000000', alias_result['detail']['address'])
		self.assertEqual('alias.address', alias_result['detail']['namespaceName'])
		self.assertEqual(alias_result['detail']['address'], alias_result['graphic']['transactions'][0]['recipient'])

	def test_to_dict_uses_current_mosaic_alias_name(self):
		# Arrange:
		mosaic_alias = _create_transaction(17230, {
			'namespaceId': '02', 'aliasAction': 1, 'mosaicId': '0000000000001234'
		})

		# Act + Assert:
		result = SymbolTransactionDetailView(_create_detail(
			mosaic_alias, namespace_names={'02': 'alias.mosaic'})).to_dict(NATIVE_MOSAIC_INFO, Network.TESTNET)

		# Assert:
		self.assertEqual('alias.mosaic', result['detail']['namespaceName'])

	def test_to_dict_keeps_missing_metadata_target_alias_names_empty(self):
		# Arrange:
		metadata = _create_transaction(16964, {
			'scopedMetadataKey': '03', 'value': 'AA', 'valueSizeDelta': 1, 'targetMosaicId': '01'
		}, mosaics=(TransactionMosaicRecord('0000000000001234', 0, 'metadata_target', 0, 0, ()),))

		# Act + Assert:
		result = SymbolTransactionDetailView(_create_detail(metadata)).to_dict(NATIVE_MOSAIC_INFO, Network.TESTNET)

		# Assert:
		self.assertEqual([], result['detail']['targetMosaicAliasNames'])

	def test_to_dict_formats_pending_alias_name_as_original_namespace_hex(self):
		# Arrange:
		transaction = _create_transaction(17230, {
			'namespaceId': '01', 'aliasAction': 1, 'mosaicId': '0000000000001234'
		})

		# Act + Assert:
		result = SymbolTransactionDetailView(_create_detail(transaction), 'unconfirmed').to_dict(
			NATIVE_MOSAIC_INFO, Network.TESTNET)

		# Assert:
		self.assertIsNone(result['detail']['namespaceName'])

	def test_to_dict_routes_revocation_graphic_from_source_to_signer(self):
		# Arrange:
		transaction = _create_transaction(
			17229,
			{'mosaicId': '01'},
			mosaics=(TransactionMosaicRecord('0000000000001234', 1, 'revocation', 0, 0, ()),),
			source_address=SOURCE_ADDRESS)

		# Act + Assert:
		result = SymbolTransactionDetailView(_create_detail(transaction)).to_dict(NATIVE_MOSAIC_INFO, Network.TESTNET)

		# Assert:
		graphic = result['graphic']['transactions'][0]
		self.assertEqual('TABQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAY', result['detail']['address'])
		self.assertEqual('TABQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAY', graphic['sender'])
		self.assertEqual('TAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAI', result['info']['sender'])
		self.assertEqual('TAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAI', graphic['recipient'])

	def test_to_dict_preserves_exact_message_types_and_payloads(self):
		# Arrange:
		cases = (
			('plain', '', {'type': 'plain', 'text': ''}),
			('plain', 'FF', {'type': 'plain', 'text': 'FF'}),
			('encrypted', 'FF', {'type': 'encrypted', 'text': 'FF'}),
			('persistentDelegationHarvesting', 'AA', {'type': 'persistentDelegationHarvesting', 'text': 'AA'}),
			(None, 'FE', {'type': None, 'text': 'FE'}),
			(None, None, None)
		)
		for message_type, message_payload, expected in cases:
			transaction = _create_transaction(16724, {}, message_type=message_type, message_payload=message_payload)

			# Act + Assert:
			result = SymbolTransactionDetailView(_create_detail(transaction)).to_dict(NATIVE_MOSAIC_INFO, Network.TESTNET)

			# Assert:
			self.assertEqual(expected, result['detail']['message'], (message_type, message_payload))

	def test_to_dict_preserves_multisig_and_address_restriction_arrays(self):
		# Arrange:
		literal_address = '98' + '01' * 23
		multisig = _create_transaction(16725, {
			'minApprovalDelta': -1, 'minRemovalDelta': 2,
			'addressAdditions': [literal_address, literal_address], 'addressDeletions': [literal_address]
		})
		address_restriction = _create_transaction(16720, {
			'restrictionFlags': 1, 'restrictionAdditions': [literal_address], 'restrictionDeletions': [literal_address]
		})
		# Act + Assert:
		results = [
			SymbolTransactionDetailView(_create_detail(transaction)).to_dict(NATIVE_MOSAIC_INFO, Network.TESTNET)['detail']
			for transaction in (multisig, address_restriction)
		]

		# Assert:
		expected_address = str(Address(bytes.fromhex(literal_address)))
		self.assertEqual([expected_address] * 2, results[0]['addressAdditions'])
		self.assertEqual([expected_address], results[0]['addressDeletions'])
		self.assertEqual(results[0]['addressAdditions'][0], results[1]['restrictionAddressAdditions'][0])

	def test_to_dict_preserves_mosaic_restriction_arrays(self):
		# Arrange:
		transaction = _create_transaction(16976, {
			'restrictionFlags': 2, 'restrictionAdditions': ['01', '02'], 'restrictionDeletions': ['03']
		})

		# Act + Assert:
		result = SymbolTransactionDetailView(_create_detail(transaction)).to_dict(
			NATIVE_MOSAIC_INFO, Network.TESTNET)['detail']

		# Assert:
		self.assertEqual(['0000000000000001', '0000000000000002'], result['restrictionMosaicAdditions'])
		self.assertEqual(['0000000000000003'], result['restrictionMosaicDeletions'])

	def test_to_dict_preserves_operation_restriction_arrays(self):
		# Arrange:
		transaction = _create_transaction(17232, {
			'restrictionFlags': 4, 'restrictionAdditions': [16724], 'restrictionDeletions': [16725]
		})

		# Act + Assert:
		result = SymbolTransactionDetailView(_create_detail(transaction)).to_dict(
			NATIVE_MOSAIC_INFO, Network.TESTNET)['detail']

		# Assert:
		self.assertEqual(['TRANSFER'], result['restrictionOperationAdditions'])
		self.assertEqual(['MULTISIG_ACCOUNT_MODIFICATION'], result['restrictionOperationDeletions'])


class SymbolTransactionDetailViewValidationTest(TestCase):
	def test_to_dict_rejects_non_object_body_and_raw_transaction(self):
		# Arrange:
		cases = (
			(_create_transaction(16724, 'malformed body'), 'transaction.body', 'expected object'),
			(_create_transaction(16724, {}, raw_payload={'transaction': 'malformed raw transaction'}),
				'transaction.rawPayload.transaction', 'expected object')
		)

		# Act + Assert:
		for transaction, field_path, reason in cases:
			with self.subTest(transaction_type=transaction.transaction_type):
				with self.assertRaises(SymbolDataInvalid) as error:
					SymbolTransactionDetailView(_create_detail(transaction)).to_dict(NATIVE_MOSAIC_INFO, Network.TESTNET)
				self.assertEqual(field_path, error.exception.field_path)
				self.assertEqual(reason, error.exception.reason)

	def test_to_dict_rejects_malformed_saved_signature(self):
		# Arrange:
		cases = (
			_create_transaction(16724, {}, raw_payload={
				'transaction': {'network': Network.TESTNET.identifier, 'version': 1, 'signature': 'bad'}}),
			_create_transaction(16724, {}, raw_payload={
				'transaction': {
					'network': Network.TESTNET.identifier, 'version': 1, 'signature': ' ' + 'CD' * 63 + 'C'}})
		)

		# Act + Assert:
		for transaction in cases:
			with self.subTest(transaction_type=transaction.transaction_type):
				with self.assertRaises(SymbolDataInvalid) as error:
					SymbolTransactionDetailView(_create_detail(transaction)).to_dict(NATIVE_MOSAIC_INFO, Network.TESTNET)
				self.assertEqual('transaction.signature', error.exception.field_path)
				self.assertEqual('invalid signature', error.exception.reason)

	def test_to_dict_rejects_overlength_namespace_identifier(self):
		# Arrange:
		transaction = _create_transaction(16718, {
			'id': '1' * 17, 'name': 'leaf', 'registrationType': 'root', 'parentId': None, 'duration': 1
		})

		# Act + Assert:
		with self.assertRaises(SymbolDataInvalid) as error:
			SymbolTransactionDetailView(_create_detail(transaction)).to_dict(NATIVE_MOSAIC_INFO, Network.TESTNET)
		self.assertEqual('transaction.hex16', error.exception.field_path)
		self.assertEqual('value exceeds 16 hexadecimal characters', error.exception.reason)

	def test_to_dict_rejects_invalid_common_fields(self):
		# Arrange:
		cases = (
			(_create_transaction(16724, {}, version='1'), 'transaction.version', 'expected integer'),
			(_create_transaction(16712, {'duration': True, 'hash': 'AA' * 32}),
				'transaction.decimal', 'expected uint64 decimal value'),
			(_create_transaction(16705, {}), 'transaction.body.transactionsHash', 'missing required field')
		)

		# Act + Assert:
		for transaction, field_path, reason in cases:
			with self.subTest(transaction_type=transaction.transaction_type):
				with self.assertRaises(SymbolDataInvalid) as error:
					SymbolTransactionDetailView(_create_detail(transaction)).to_dict(NATIVE_MOSAIC_INFO, Network.TESTNET)
				self.assertEqual(field_path, error.exception.field_path)
				self.assertEqual(reason, error.exception.reason)

	def test_to_dict_rejects_invalid_mosaic_definition_flags(self):
		# Arrange:
		cases = (
			'0',
			True,
			-1,
			sum(flag.value for flag in MosaicFlags) + 1
		)

		# Act + Assert:
		for flags in cases:
			with self.subTest(flags=flags):
				transaction = _create_transaction(
					TransactionType.MOSAIC_DEFINITION.value,
					{'id': '01', 'divisibility': 0, 'duration': 1, 'nonce': 1, 'flags': flags})
				with self.assertRaises(SymbolDataInvalid) as error:
					SymbolTransactionDetailView(_create_detail(transaction)).to_dict(NATIVE_MOSAIC_INFO, Network.TESTNET)
				self.assertEqual('transaction.body.flags', error.exception.field_path)
				self.assertEqual('expected integer' if isinstance(flags, (str, bool)) else 'invalid flags', error.exception.reason)

	def test_to_dict_rejects_non_array_address_restriction_values(self):
		# Arrange:
		transaction = _create_transaction(
			TransactionType.ACCOUNT_ADDRESS_RESTRICTION.value,
			{'restrictionFlags': 1, 'restrictionAdditions': 'bad', 'restrictionDeletions': []})

		# Act + Assert:
		with self.assertRaises(SymbolDataInvalid) as error:
			SymbolTransactionDetailView(_create_detail(transaction)).to_dict(NATIVE_MOSAIC_INFO, Network.TESTNET)
		self.assertEqual('transaction.addresses', error.exception.field_path)
		self.assertEqual('expected array', error.exception.reason)

	def test_to_dict_rejects_malformed_mosaic_restriction_values(self):
		# Arrange:
		transaction = _create_transaction(
			TransactionType.ACCOUNT_MOSAIC_RESTRICTION.value,
			{'restrictionFlags': 2, 'restrictionAdditions': 'bad', 'restrictionDeletions': []})

		# Act + Assert:
		with self.assertRaises(SymbolDataInvalid) as error:
			SymbolTransactionDetailView(_create_detail(transaction)).to_dict(NATIVE_MOSAIC_INFO, Network.TESTNET)
		self.assertEqual('transaction.mosaics', error.exception.field_path)
		self.assertEqual('expected array', error.exception.reason)

	def test_to_dict_rejects_malformed_operation_restriction_values(self):
		# Arrange:
		cases = (
			(_create_transaction(17232, {'restrictionFlags': 4, 'restrictionAdditions': [99999], 'restrictionDeletions': []}),
				'transaction.restrictionAdditions', 'invalid transaction type'),
			(_create_transaction(17232, {'restrictionFlags': 4, 'restrictionAdditions': 'bad', 'restrictionDeletions': []}),
				'transaction.operations', 'expected array')
		)

		# Act + Assert:
		for transaction, field_path, reason in cases:
			with self.subTest(transaction_type=transaction.transaction_type):
				with self.assertRaises(SymbolDataInvalid) as error:
					SymbolTransactionDetailView(_create_detail(transaction)).to_dict(NATIVE_MOSAIC_INFO, Network.TESTNET)
				self.assertEqual(field_path, error.exception.field_path)
				self.assertEqual(reason, error.exception.reason)

	def test_to_dict_rejects_invalid_address_restriction_flags(self):
		# Arrange:
		cases = (
			_create_transaction(16720, {'restrictionFlags': 'bad', 'restrictionAdditions': [], 'restrictionDeletions': []}),
			_create_transaction(16720, {'restrictionFlags': 2, 'restrictionAdditions': [], 'restrictionDeletions': []})
		)

		# Act + Assert:
		for transaction in cases:
			with self.subTest(transaction_type=transaction.transaction_type):
				with self.assertRaises(SymbolDataInvalid) as error:
					SymbolTransactionDetailView(_create_detail(transaction)).to_dict(NATIVE_MOSAIC_INFO, Network.TESTNET)
				self.assertEqual('transaction.restrictionFlags', error.exception.field_path)
				self.assertEqual('invalid flags', error.exception.reason)

	def test_to_dict_rejects_missing_mosaic_relations_for_supply_and_global_restrictions(self):
		# Arrange:
		cases = (
			_create_transaction(16973, {'mosaicId': '01', 'action': 0, 'delta': 1}),
			_create_transaction(16721, {
				'mosaicId': '01', 'referenceMosaicId': '00', 'restrictionKey': '02', 'previousRestrictionType': 0,
				'previousRestrictionValue': 0, 'newRestrictionType': 1, 'newRestrictionValue': 1
			})
		)

		# Act + Assert:
		for transaction in cases:
			with self.subTest(transaction_type=transaction.transaction_type):
				with self.assertRaises(SymbolDataInvalid) as error:
					SymbolTransactionDetailView(_create_detail(transaction)).to_dict(NATIVE_MOSAIC_INFO, Network.TESTNET)
				expected_path = 'transaction.mosaics.definition' if transaction.transaction_type == 16973 else 'transaction.mosaics.restriction'
				self.assertEqual(expected_path, error.exception.field_path)
				self.assertEqual('missing required mosaic relation', error.exception.reason)

	def test_to_dict_rejects_malformed_type_specific_enum_values(self):
		# Arrange:
		definition_mosaic = (TransactionMosaicRecord('0000000000001234', 0, 'definition', 0, 0, ()),)
		restriction_mosaic = (TransactionMosaicRecord('0000000000001234', 0, 'restriction', 0, 0, ()),)
		cases = (
			(_create_transaction(16722, {'duration': 1, 'secret': 'AA' * 32, 'hashAlgorithm': 'invalid'}),
				'transaction.hashAlgorithm', 'invalid hash algorithm'),
			(_create_transaction(16974, {'namespaceId': '01', 'aliasAction': 9, 'address': '98' + '01' * 23}),
				'transaction.aliasAction', 'invalid alias action'),
			(_create_transaction(16716, {'linkAction': 'invalid', 'linkedPublicKey': '01' * 32}),
				'transaction.enum', 'invalid enum value'),
			(_create_transaction(16973, {'mosaicId': '01', 'action': 9, 'delta': 1}, mosaics=definition_mosaic),
				'transaction.action', 'invalid supply action'),
			(_create_transaction(16721, {
				'mosaicId': '01', 'referenceMosaicId': '00', 'restrictionKey': '02', 'previousRestrictionType': 9,
				'previousRestrictionValue': 0, 'newRestrictionType': 1, 'newRestrictionValue': 1
			}, mosaics=restriction_mosaic), 'transaction.restrictionType', 'invalid restriction type'),
			(_create_transaction(16718, {
				'id': '01', 'name': 'leaf', 'registrationType': 9, 'parentId': '00', 'duration': 1
			}), 'transaction.registrationType', 'invalid registration type')
		)

		# Act + Assert:
		for transaction, field_path, reason in cases:
			with self.subTest(transaction_type=transaction.transaction_type):
				with self.assertRaises(SymbolDataInvalid) as error:
					SymbolTransactionDetailView(_create_detail(transaction)).to_dict(NATIVE_MOSAIC_INFO, Network.TESTNET)
				self.assertEqual(field_path, error.exception.field_path)
				self.assertEqual(reason, error.exception.reason)

	def test_to_dict_accepts_optional_none_and_symbol_string_enum_values(self):
		# Arrange:
		transfer = _create_transaction(16724, {}, recipient_address=None)
		link = _create_transaction(16716, {'linkAction': 'link', 'linkedPublicKey': '01' * 32})
		secret_lock = _create_transaction(16722, {
			'duration': 1, 'secret': 'AA' * 32, 'hashAlgorithm': 'sha3_256'
		})
		alias = _create_transaction(16974, {
			'namespaceId': '01', 'aliasAction': 'link', 'address': '98' + '01' * 23
		})
		supply = _create_transaction(
			16973, {'mosaicId': '01', 'action': 'increase', 'delta': 1},
			mosaics=(TransactionMosaicRecord('0000000000001234', 0, 'definition', 0, 0, ()),))
		namespace = _create_transaction(16718, {
			'id': '01', 'name': 'leaf', 'registrationType': 'child', 'parentId': '00', 'duration': None
		})

		# Act + Assert:
		transfer_result = SymbolTransactionDetailView(_create_detail(transfer)).to_dict(NATIVE_MOSAIC_INFO, Network.TESTNET)
		link_result = SymbolTransactionDetailView(_create_detail(link)).to_dict(NATIVE_MOSAIC_INFO, Network.TESTNET)
		secret_lock_result = SymbolTransactionDetailView(_create_detail(secret_lock)).to_dict(NATIVE_MOSAIC_INFO, Network.TESTNET)
		alias_result = SymbolTransactionDetailView(_create_detail(alias)).to_dict(NATIVE_MOSAIC_INFO, Network.TESTNET)
		supply_result = SymbolTransactionDetailView(_create_detail(supply)).to_dict(NATIVE_MOSAIC_INFO, Network.TESTNET)
		namespace_result = SymbolTransactionDetailView(_create_detail(namespace)).to_dict(NATIVE_MOSAIC_INFO, Network.TESTNET)

		# Assert:
		self.assertIsNone(transfer_result['detail']['recipient'])
		self.assertEqual('link', link_result['detail']['linkAction'])
		self.assertEqual('sha3_256', secret_lock_result['detail']['hashAlgorithm'])
		self.assertEqual('link', alias_result['detail']['aliasAction'])
		self.assertEqual('increase', supply_result['detail']['action'])
		self.assertEqual('sub', namespace_result['detail']['registrationType'])
		self.assertEqual('0000000000000000', namespace_result['detail']['parentId'])
		self.assertIsNone(namespace_result['detail']['duration'])


class SymbolTransactionDetailViewAdditionalTest(TestCase):
	def test_is_aggregate_transaction_type_distinguishes_known_transaction_kinds(self):
		# Arrange:
		cases = ((16705, True), (16724, False))

		# Act + Assert:
		for transaction_type, expected in cases:
			self.assertEqual(expected, is_aggregate_transaction_type(transaction_type))

	def test_to_dict_serializes_root_namespace_with_null_parent(self):
		# Arrange:
		transaction = _create_transaction(TransactionType.NAMESPACE_REGISTRATION.value, {
			'id': '01', 'name': 'root', 'registrationType': 'root', 'parentId': None, 'duration': 1})

		# Act + Assert:
		result = SymbolTransactionDetailView(_create_detail(transaction)).to_dict(NATIVE_MOSAIC_INFO, Network.TESTNET)

		# Assert:
		expected = {
			'namespaceId': '0000000000000001', 'namespaceName': 'root', 'registrationType': 'root',
			'parentId': None, 'duration': '1'
		}
		self.assertEqual(expected, result['detail'])

	def test_transaction_detail_rejects_an_unsupported_transaction_type(self):
		# Arrange:
		transaction = _create_transaction(99999, {})
		view = SymbolTransactionDetailView(_create_detail(transaction))

		# Act + Assert:
		with self.assertRaises(SymbolDataInvalid) as error:
			view.to_dict(NATIVE_MOSAIC_INFO, Network.TESTNET)
		self.assertEqual('transaction.type', error.exception.field_path)
		self.assertEqual('unsupported transaction type', error.exception.reason)

	def test_to_dict_rejects_non_string_optional_hex(self):
		# Arrange:
		proof = _create_transaction(16978, {
			'secret': 'AA' * 32, 'proof': 1, 'hashAlgorithm': 0
		})

		# Act + Assert:
		with self.assertRaises(SymbolDataInvalid) as error:
			SymbolTransactionDetailView(_create_detail(proof)).to_dict(NATIVE_MOSAIC_INFO, Network.TESTNET)
		self.assertEqual('transaction.hex', error.exception.field_path)
		self.assertEqual('invalid hexadecimal value', error.exception.reason)

	def test_to_dict_rejects_malformed_namespace_registration_fields(self):
		# Arrange:
		cases = (
			(_create_transaction(
				TransactionType.NAMESPACE_REGISTRATION.value,
				{'id': '01', 'name': 'root', 'registrationType': 'root'}),
				'transaction.body.duration', 'missing required field'),
			(_create_transaction(
				TransactionType.NAMESPACE_REGISTRATION.value,
				{'id': '01', 'name': 'child', 'registrationType': 'sub'}),
				'transaction.body.parentId', 'missing required field'),
			(_create_transaction(
				TransactionType.NAMESPACE_REGISTRATION.value,
				{'id': '01', 'name': 'child', 'registrationType': 'sub', 'parentId': '02', 'duration': 1}),
				'transaction.body.duration', 'field is not applicable'),
			(_create_transaction(
				TransactionType.NAMESPACE_REGISTRATION.value,
				{'id': '01', 'name': 'root', 'registrationType': 'root', 'parentId': '02', 'duration': 1}),
				'transaction.body.parentId', 'field is not applicable')
		)

		# Act + Assert:
		for transaction, field_path, reason in cases:
			with self.subTest(transaction_type=transaction.transaction_type, body=transaction.body):
				with self.assertRaises(SymbolDataInvalid) as error:
					SymbolTransactionDetailView(_create_detail(transaction)).to_dict(NATIVE_MOSAIC_INFO, Network.TESTNET)
				self.assertEqual(field_path, error.exception.field_path)
				self.assertEqual(reason, error.exception.reason)

	def test_to_dict_rejects_malformed_namespace_hex_identifier(self):
		# Arrange:
		transactions = (
			_create_transaction(
				TransactionType.NAMESPACE_REGISTRATION.value,
				{'id': b'', 'name': 'root', 'registrationType': 'root', 'duration': 1}),
			_create_transaction(
				TransactionType.NAMESPACE_REGISTRATION.value,
				{'id': '', 'name': 'root', 'registrationType': 'root', 'duration': 1})
		)

		# Act + Assert:
		for transaction in transactions:
			with self.subTest(namespace_id=transaction.body.get('id')):
				with self.assertRaises(SymbolDataInvalid) as error:
					SymbolTransactionDetailView(_create_detail(transaction)).to_dict(NATIVE_MOSAIC_INFO, Network.TESTNET)
				self.assertEqual('transaction.hex', error.exception.field_path)
				self.assertEqual('invalid hexadecimal value', error.exception.reason)

	def test_to_dict_rejects_foreign_network_and_bad_saved_signature(self):
		# Arrange:
		transactions = (
			(_create_transaction(TransactionType.TRANSFER.value, {'network': Network.MAINNET.identifier}),
				'transaction.body.network', 'network does not match configured network'),
			(_create_transaction(
				TransactionType.TRANSFER.value, {},
				raw_payload={'transaction': {'network': Network.TESTNET.identifier, 'signature': 'bad'}}),
				'transaction.signature', 'invalid signature')
		)

		# Act + Assert:
		for transaction, field_path, reason in transactions:
			with self.subTest(transaction_type=transaction.transaction_type):
				with self.assertRaises(SymbolDataInvalid) as error:
					SymbolTransactionDetailView(_create_detail(transaction)).to_dict(NATIVE_MOSAIC_INFO, Network.TESTNET)
				self.assertEqual(field_path, error.exception.field_path)
				self.assertEqual(reason, error.exception.reason)

	def test_to_dict_rejects_invalid_operation_restriction_value(self):
		# Arrange:
		transaction = _create_transaction(
			TransactionType.ACCOUNT_OPERATION_RESTRICTION.value,
			{'restrictionFlags': 4, 'restrictionAdditions': [65535], 'restrictionDeletions': []})

		# Act + Assert:
		with self.assertRaises(SymbolDataInvalid) as error:
			SymbolTransactionDetailView(_create_detail(transaction)).to_dict(NATIVE_MOSAIC_INFO, Network.TESTNET)
		self.assertEqual('transaction.restrictionAdditions', error.exception.field_path)
		self.assertEqual('invalid transaction type', error.exception.reason)

	def test_to_dict_rejects_negative_voting_key_epoch(self):
		# Arrange:
		transaction = _create_transaction(
			TransactionType.VOTING_KEY_LINK.value,
			{'linkAction': 1, 'linkedPublicKey': '01' * 32, 'startEpoch': -1, 'endEpoch': 1})

		# Act + Assert:
		with self.assertRaises(SymbolDataInvalid) as error:
			SymbolTransactionDetailView(_create_detail(transaction)).to_dict(NATIVE_MOSAIC_INFO, Network.TESTNET)
		self.assertEqual('transaction.body.startEpoch', error.exception.field_path)
		self.assertEqual('expected integer in range', error.exception.reason)

	def test_to_dict_rejects_invalid_aggregate_cosignature(self):
		# Arrange:
		aggregate = _create_transaction(
			TransactionType.AGGREGATE_COMPLETE.value, {'transactionsHash': 'AA' * 32})

		# Act + Assert:
		with self.assertRaises(SymbolDataInvalid) as error:
			SymbolTransactionDetailView(_create_detail(aggregate, cosignatures=[{}])).to_dict(
				NATIVE_MOSAIC_INFO, Network.TESTNET)
		self.assertEqual('transaction.cosignatures', error.exception.field_path)
		self.assertEqual('invalid cosignature', error.exception.reason)

	def test_to_dict_maps_all_transaction_types_to_contract_detail_keys(self):
		# Arrange:
		cases = {
			16716: ({'linkAction': 1, 'linkedPublicKey': '01' * 32}, {'linkAction', 'linkedPublicKey', 'linkedAccountAddress'}),
			16972: ({'linkAction': 1, 'linkedPublicKey': '01' * 32}, {'linkAction', 'linkedPublicKey', 'linkedAccountAddress'}),
			16963: ({'linkAction': 1, 'linkedPublicKey': '01' * 32}, {'linkAction', 'linkedPublicKey', 'linkedAccountAddress'}),
			16707: (
				{'linkAction': 1, 'linkedPublicKey': '01' * 32, 'startEpoch': 1, 'endEpoch': 2},
				{'linkAction', 'linkedPublicKey', 'linkedAccountAddress', 'startEpoch', 'endEpoch'}),
			16712: ({'duration': 1, 'hash': 'AA' * 32}, {'mosaics', 'duration', 'hash'}),
			16722: ({'duration': 1, 'secret': 'AA' * 32, 'hashAlgorithm': 0}, {'mosaics', 'recipient', 'duration', 'secret', 'hashAlgorithm'}),
			16978: ({'secret': 'AA' * 32, 'proof': 'BB', 'hashAlgorithm': 0}, {'recipient', 'secret', 'proof', 'hashAlgorithm'}),
			16708: (
				{'scopedMetadataKey': '01', 'value': 'AA', 'valueSizeDelta': 1},
				{'targetAddress', 'scopedMetadataKey', 'valueDelta', 'valueSizeDelta'}),
			16964: (
				{'scopedMetadataKey': '01', 'value': 'AA', 'valueSizeDelta': 1, 'targetMosaicId': '01'},
				{'targetAddress', 'scopedMetadataKey', 'valueDelta', 'valueSizeDelta', 'targetMosaicId', 'targetMosaicAliasNames'}),
			17220: (
				{'scopedMetadataKey': '01', 'value': 'AA', 'valueSizeDelta': 1, 'targetNamespaceId': '01'},
				{'targetAddress', 'scopedMetadataKey', 'valueDelta', 'valueSizeDelta', 'targetNamespaceId', 'namespaceName'}),
			16717: (
				{'id': '01', 'divisibility': 0, 'duration': 1, 'nonce': 1, 'flags': 0},
				{'mosaicId', 'divisibility', 'duration', 'nonce', 'supplyMutable', 'transferable', 'restrictable', 'revokable'}),
			16973: ({'mosaicId': '01', 'action': 1, 'delta': 1}, {'mosaicId', 'action', 'delta'}),
			17229: ({'mosaicId': '01'}, {'address', 'mosaics'}),
			16725: (
				{'minApprovalDelta': 0, 'minRemovalDelta': 0, 'addressAdditions': [], 'addressDeletions': []},
				{'minApprovalDelta', 'minRemovalDelta', 'addressAdditions', 'addressDeletions'}),
			16974: (
				{'namespaceId': '01', 'aliasAction': 1, 'address': '98' + '01' * 23},
				{'namespaceId', 'namespaceName', 'aliasAction', 'address'}),
			17230: (
				{'namespaceId': '01', 'aliasAction': 1, 'mosaicId': '01'},
				{'namespaceId', 'namespaceName', 'aliasAction', 'mosaicId'}),
			16718: (
				{'id': '01', 'name': 'leaf', 'registrationType': 'root', 'parentId': None, 'duration': 1},
				{'namespaceId', 'namespaceName', 'registrationType', 'parentId', 'duration'}),
			16720: (
				{'restrictionFlags': 1, 'restrictionAdditions': [], 'restrictionDeletions': []},
				{'restrictionFlags', 'restrictionType', 'restrictionAddressAdditions', 'restrictionAddressDeletions'}),
			16976: (
				{'restrictionFlags': 2, 'restrictionAdditions': [], 'restrictionDeletions': []},
				{'restrictionFlags', 'restrictionType', 'restrictionMosaicAdditions', 'restrictionMosaicDeletions'}),
			17232: (
				{'restrictionFlags': 4, 'restrictionAdditions': [], 'restrictionDeletions': []},
				{'restrictionFlags', 'restrictionType', 'restrictionOperationAdditions', 'restrictionOperationDeletions'}),
			16977: (
				{'mosaicId': '01', 'restrictionKey': '01', 'previousRestrictionValue': 0, 'newRestrictionValue': 1},
				{'mosaicId', 'mosaicAliasNames', 'targetAddress', 'restrictionKey', 'previousRestrictionValue', 'newRestrictionValue'}),
			16721: (
				{
					'mosaicId': '01', 'referenceMosaicId': '00', 'restrictionKey': '01', 'previousRestrictionType': 0,
					'previousRestrictionValue': 0, 'newRestrictionType': 1, 'newRestrictionValue': 1
				},
				{'mosaicId', 'referenceMosaicId', 'mosaicAliasNames', 'restrictionKey', 'previousRestrictionType',
					'previousRestrictionValue', 'newRestrictionType', 'newRestrictionValue'})
		}

		# Act + Assert:
		for transaction_type, (body, expected_keys) in cases.items():
			role = {
				16712: 'hash_lock', 16717: 'definition', 16722: 'secret_lock', 16964: 'metadata_target',
				16973: 'definition', 16977: 'restriction', 17229: 'revocation'
			}.get(transaction_type)
			if transaction_type == 16721:
				role = 'restriction'
			mosaics = (TransactionMosaicRecord('1234567890ABCDEF', 0, role, 0, 0, ()),) if role else ()
			result = SymbolTransactionDetailView(_create_detail(
				_create_transaction(transaction_type, body, mosaics=mosaics))).to_dict(NATIVE_MOSAIC_INFO, Network.TESTNET)
			# Assert:
			self.assertEqual(expected_keys, set(result['detail']), transaction_type)

	def test_to_dict_serializes_global_restriction_values_and_alias(self):
		# Arrange:
		transaction = _create_transaction(
			TransactionType.MOSAIC_GLOBAL_RESTRICTION.value,
			{
				'mosaicId': '01', 'referenceMosaicId': '00', 'restrictionKey': '02',
				'previousRestrictionType': 0, 'previousRestrictionValue': 3,
				'newRestrictionType': 5, 'newRestrictionValue': 9
			},
			mosaics=(TransactionMosaicRecord('0000000000000001', 0, 'restriction', 0, 0, ('current',)),))

		# Act + Assert:
		result = SymbolTransactionDetailView(_create_detail(transaction)).to_dict(NATIVE_MOSAIC_INFO, Network.TESTNET)

		# Assert:
		self.assertEqual('MOSAIC_GLOBAL_RESTRICTION', result['type'])
		self.assertEqual({
			'mosaicId': '0000000000000001', 'referenceMosaicId': '0000000000000000', 'mosaicAliasNames': ['current'],
			'restrictionKey': '0000000000000002', 'previousRestrictionType': 'NONE', 'previousRestrictionValue': '3',
			'newRestrictionType': 'GT', 'newRestrictionValue': '9'
		}, result['detail'])

	def test_to_dict_uses_resolved_global_reference_relation_for_confirmed_and_pending(self):
		# Arrange:
		body = {
			'mosaicId': '01', 'referenceMosaicId': '02', 'restrictionKey': '02',
			'previousRestrictionType': 0, 'previousRestrictionValue': 3,
			'newRestrictionType': 5, 'newRestrictionValue': 9}
		transaction = _create_transaction(TransactionType.MOSAIC_GLOBAL_RESTRICTION.value, body, mosaics=(
			TransactionMosaicRecord('0000000000000001', 0, 'restriction', 0, 0, ()),
			TransactionMosaicRecord('0000000000000003', 0, 'restriction', 1, 0, ())))

		# Act + Assert:
		confirmed = SymbolTransactionDetailView(_create_detail(transaction), 'confirmed').to_dict(
			NATIVE_MOSAIC_INFO, Network.TESTNET)
		pending = SymbolTransactionDetailView(_create_detail(transaction), 'partial').to_dict(
			NATIVE_MOSAIC_INFO, Network.TESTNET)

		# Assert:
		self.assertEqual('0000000000000003', confirmed['detail']['referenceMosaicId'])
		self.assertEqual('0000000000000003', pending['detail']['referenceMosaicId'])

	def test_to_dict_rejects_confirmed_global_reference_without_resolved_relation(self):
		# Arrange:
		transaction = _create_transaction(
			TransactionType.MOSAIC_GLOBAL_RESTRICTION.value,
			{
				'mosaicId': '01', 'referenceMosaicId': '02', 'restrictionKey': '02',
				'previousRestrictionType': 0, 'previousRestrictionValue': 3,
				'newRestrictionType': 5, 'newRestrictionValue': 9},
			mosaics=(TransactionMosaicRecord('0000000000000001', 0, 'restriction', 0, 0, ()),))

		# Act + Assert:
		with self.assertRaises(SymbolDataInvalid) as error:
			SymbolTransactionDetailView(_create_detail(transaction), 'confirmed').to_dict(NATIVE_MOSAIC_INFO, Network.TESTNET)
		self.assertEqual('transaction.mosaics.restriction', error.exception.field_path)
		self.assertEqual('missing resolved reference mosaic relation', error.exception.reason)

	def test_to_dict_uses_pending_global_reference_body_without_resolved_relation(self):
		# Arrange:
		transaction = _create_transaction(
			TransactionType.MOSAIC_GLOBAL_RESTRICTION.value,
			{
				'mosaicId': '01', 'referenceMosaicId': '02', 'restrictionKey': '02',
				'previousRestrictionType': 0, 'previousRestrictionValue': 3,
				'newRestrictionType': 5, 'newRestrictionValue': 9},
			mosaics=(TransactionMosaicRecord('0000000000000001', 0, 'restriction', 0, 0, ()),))

		# Act + Assert:
		result = SymbolTransactionDetailView(_create_detail(transaction), 'partial').to_dict(
			NATIVE_MOSAIC_INFO, Network.TESTNET)

		# Assert:
		self.assertEqual('0000000000000002', result['detail']['referenceMosaicId'])

	def test_to_dict_includes_confirmed_bonded_hash_lock_by_aggregate_hash(self):
		# Arrange:
		transaction = _create_transaction(16961, {'transactionsHash': 'AA' * 32})
		hash_lock = TransactionHashLockRecord(
			transaction.hash, SIGNER_ADDRESS, '72C0212E67A08BCE', 1000000, 20, 'unused', None, (), 7)

		# Act + Assert:
		result = SymbolTransactionDetailView(_create_detail(transaction, hash_lock=hash_lock)).to_dict(
			NATIVE_MOSAIC_INFO, Network.TESTNET)

		# Assert:
		self.assertEqual({
			'transactionHash': 'AB' * 32,
			'ownerAddress': 'TAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAI',
			'endHeight': 20,
			'status': 'unused',
			'mosaics': [{'id': '72C0212E67A08BCE', 'name': '72C0212E67A08BCE', 'amount': 1.0, 'isNative': True}]
		}, result['hashLock'])
