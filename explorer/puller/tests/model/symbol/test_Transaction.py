# pylint: disable=duplicate-code,too-many-lines
from datetime import datetime, timezone
from unittest import TestCase

from symbolchain.CryptoTypes import PublicKey
from symbolchain.sc import TransactionType
from symbolchain.symbol.Network import Network

from puller.model.symbol.Transaction import (
	MESSAGE_TYPE_LABELS,
	TRANSACTION_TYPE_LABELS,
	create_transaction_address_rows,
	create_transaction_mosaic_rows,
	create_transaction_row
)
from tests.test.SymbolTestConstants import RECIPIENT_ADDRESS, SIGNER_ADDRESS, SIGNER_PUBLIC_KEY

TARGET_ADDRESS = '98AB1234567890ABCDEF1234567890ABCDEF1234567890AB'
SOURCE_ADDRESS = '98AC1234567890ABCDEF1234567890ABCDEF1234567890AB'
ALIAS_ADDRESS = '98AD1234567890ABCDEF1234567890ABCDEF1234567890AB'
COSIGNER_PUBLIC_KEY = 'B63AAC03562762111FF7E592B00398554973396D8A4B922F3E3D139892F7C35C'
SECOND_COSIGNER_PUBLIC_KEY = 'CCE72418562762111FF7E592B00398554973396D8A4B922F3E3D139892F7C35C'


def _create_transaction(transaction_type=TransactionType.TRANSFER.value, **overrides):
	transaction = {
		'size': 152,
		'signature': '1' * 128,
		'signerPublicKey': SIGNER_PUBLIC_KEY,
		'version': 1,
		'network': 152,
		'type': transaction_type,
		'maxFee': '1000',
		'deadline': '2000',
		'recipientAddress': RECIPIENT_ADDRESS,
		'mosaics': [
			{'id': 'E74B99BA41F4AFEE', 'amount': '3000000'}
		],
		'message': '0048656C6C6F'
	}
	transaction.update(overrides)

	return transaction


def _create_top_level_transaction(transaction_type, **overrides):
	transaction = {
		'size': 152,
		'signature': '1' * 128,
		'signerPublicKey': SIGNER_PUBLIC_KEY,
		'version': 1,
		'network': 152,
		'type': transaction_type,
		'maxFee': '1000',
		'deadline': '2000'
	}
	transaction.update(overrides)

	return transaction


def _create_item(transaction=None, meta=None, item_id='node-id'):
	return {
		'meta': {
			'height': '7',
			'hash': 'A' * 64,
			'merkleComponentHash': 'A' * 64,
			'index': 3,
			'timestamp': '7000',
			'feeMultiplier': 5,
			**(meta or {})
		},
		'transaction': transaction or _create_transaction(),
		'id': item_id
	}


def _create_embedded_item(transaction=None):
	return _create_item(
		transaction or _create_transaction(
			size=None,
			signature=None,
			maxFee=None,
			deadline=None
		),
		{
			'aggregateHash': 'B' * 64,
			'aggregateId': 'aggregate-id',
			'index': 2
		},
		'embedded-id'
	)


def _top_level_transaction_body(transaction):
	return {
		key: value
		for key, value in transaction.items()
		if key not in {'signerPublicKey', 'maxFee', 'deadline', 'size', 'type', 'message'}
	}


def _expected_top_level_row(item, **overrides):
	transaction = item['transaction']
	expected = {
		'hash': bytes.fromhex('A' * 64),
		'aggregate_hash': None,
		'embedded_index': None,
		'is_embedded': False,
		'height': 7,
		'timestamp': datetime.fromtimestamp(107, timezone.utc),
		'type': transaction['type'],
		'type_name': TRANSACTION_TYPE_LABELS[transaction['type']],
		'signer_public_key': bytes.fromhex(SIGNER_PUBLIC_KEY),
		'signer_address': bytes.fromhex(SIGNER_ADDRESS),
		'recipient_address': bytes.fromhex(RECIPIENT_ADDRESS),
		'target_address': None,
		'deadline': datetime.fromtimestamp(102, timezone.utc),
		'network_deadline': 2000,
		'max_fee': 1000,
		'size': 152,
		'message_type': MESSAGE_TYPE_LABELS[0],
		'message_payload': '48656C6C6F',
		'body': _top_level_transaction_body(transaction),
		'raw_payload': item,
		'mosaic_rows': [{
			'mosaic_id': 'E74B99BA41F4AFEE',
			'amount': 3000000,
			'role': 'transfer',
			'position': 0
		}],
		'address_rows': [
			{'address': bytes.fromhex(SIGNER_ADDRESS), 'role': 'signer'},
			{'address': bytes.fromhex(RECIPIENT_ADDRESS), 'role': 'recipient'}
		]
	}
	expected.update(overrides)

	return expected


def _assert_single_mosaic(test_case, transaction_type, transaction, expected):
	# Act:
	rows = create_transaction_mosaic_rows(transaction_type, transaction)

	# Assert:
	test_case.assertEqual([expected], rows)


class TransactionTest(TestCase):  # pylint: disable=too-many-public-methods
	def test_create_transaction_row_populates_top_level_transfer_fields(self):
		# Arrange:
		item = _create_item()

		# Act:
		row = create_transaction_row(item, Network.TESTNET, 100)

		# Assert:
		self.assertEqual(_expected_top_level_row(item), row)

	def test_create_transaction_row_populates_embedded_transaction_fields(self):
		# Arrange:
		transaction = {
			'signerPublicKey': SIGNER_PUBLIC_KEY,
			'version': 1,
			'network': 152,
			'type': TransactionType.TRANSFER.value,
			'recipientAddress': RECIPIENT_ADDRESS,
			'mosaics': [{'id': 'E74B99BA41F4AFEE', 'amount': '5000000'}]
		}
		item = _create_embedded_item(transaction)

		# Act:
		row = create_transaction_row(item, Network.TESTNET, 100)

		# Assert:
		self.assertEqual({
			'hash': None,
			'aggregate_hash': bytes.fromhex('B' * 64),
			'embedded_index': 2,
			'is_embedded': True,
			'height': 7,
			'timestamp': datetime.fromtimestamp(107, timezone.utc),
			'type': TransactionType.TRANSFER.value,
			'type_name': TRANSACTION_TYPE_LABELS[TransactionType.TRANSFER.value],
			'signer_public_key': bytes.fromhex(SIGNER_PUBLIC_KEY),
			'signer_address': bytes.fromhex(SIGNER_ADDRESS),
			'recipient_address': bytes.fromhex(RECIPIENT_ADDRESS),
			'target_address': None,
			'deadline': None,
			'network_deadline': None,
			'max_fee': None,
			'size': None,
			'message_type': None,
			'message_payload': None,
			'body': {
				'version': 1,
				'network': 152,
				'recipientAddress': RECIPIENT_ADDRESS,
				'mosaics': [{'id': 'E74B99BA41F4AFEE', 'amount': '5000000'}]
			},
			'raw_payload': item,
			'mosaic_rows': [{
				'mosaic_id': 'E74B99BA41F4AFEE',
				'amount': 5000000,
				'role': 'transfer',
				'position': 0
			}],
			'address_rows': [
				{'address': bytes.fromhex(SIGNER_ADDRESS), 'role': 'signer'},
				{'address': bytes.fromhex(RECIPIENT_ADDRESS), 'role': 'recipient'}
			]
		}, row)

	def test_sdk_enum_values_build_transaction_labels(self):
		transactions = {
			TransactionType.TRANSFER.value: _create_transaction(),
			TransactionType.AGGREGATE_COMPLETE.value: _create_top_level_transaction(TransactionType.AGGREGATE_COMPLETE.value),
			TransactionType.MOSAIC_DEFINITION.value: _create_top_level_transaction(
				TransactionType.MOSAIC_DEFINITION.value,
				id='1111111111111111'
			)
		}
		for transaction_type, transaction in transactions.items():
			with self.subTest(transaction_type=transaction_type):
				# Arrange:
				item = _create_item(transaction)

				# Act:
				row = create_transaction_row(item, Network.TESTNET, 100)

				# Assert:
				self.assertEqual(TRANSACTION_TYPE_LABELS[transaction_type], row['type_name'])

	def _assert_message_parsing(self, message, expected_type, expected_payload):
		# Arrange:
		transaction = _create_transaction(message=message)
		item = _create_item(transaction)

		# Act:
		row = create_transaction_row(item, Network.TESTNET, 100)

		# Assert:
		self.assertEqual(expected_type, row['message_type'])
		self.assertEqual(expected_payload, row['message_payload'])

	def test_create_transaction_row_parses_plain_message(self):
		self._assert_message_parsing('0048656C6C6F', 'plain', '48656C6C6F')

	def test_create_transaction_row_parses_encrypted_message(self):
		self._assert_message_parsing('01ABCDEF', 'encrypted', 'ABCDEF')

	def test_create_transaction_row_parses_persistent_delegation_message(self):
		self._assert_message_parsing('FEABCDEF', 'persistentDelegationHarvesting', 'ABCDEF')

	def test_create_transaction_row_keeps_payload_when_message_marker_is_unknown(self):
		self._assert_message_parsing('FFABCDEF', None, 'ABCDEF')

	def test_create_transaction_row_populates_no_message_fields_when_message_is_absent(self):
		# Arrange:
		transaction = _create_transaction()
		del transaction['message']
		item = _create_item(transaction)

		# Act:
		row = create_transaction_row(item, Network.TESTNET, 100)

		# Assert:
		self.assertIsNone(row['message_type'])
		self.assertIsNone(row['message_payload'])

	def test_create_transaction_row_rejects_unknown_transaction_type(self):
		# Arrange:
		item = _create_item(_create_top_level_transaction(1))

		# Act + Assert:
		with self.assertRaisesRegex(ValueError, 'Unsupported Symbol transaction type 1'):
			create_transaction_row(item, Network.TESTNET, 100)

	def test_create_transaction_mosaic_rows_creates_transfer_rows(self):
		# Arrange:
		transaction = {
			'mosaics': [
				{'id': '1111111111111111', 'amount': '10'},
				{'id': '2222222222222222', 'amount': '20'}
			]
		}

		# Act:
		rows = create_transaction_mosaic_rows(TransactionType.TRANSFER.value, transaction)

		# Assert:
		self.assertEqual([
			{'mosaic_id': '1111111111111111', 'amount': 10, 'role': 'transfer', 'position': 0},
			{'mosaic_id': '2222222222222222', 'amount': 20, 'role': 'transfer', 'position': 1}
		], rows)

	def test_create_transaction_mosaic_rows_creates_hash_lock_row(self):
		_assert_single_mosaic(self, TransactionType.HASH_LOCK.value, {'mosaicId': '1111111111111111', 'amount': '10'}, {
			'mosaic_id': '1111111111111111',
			'amount': 10,
			'role': 'hash_lock',
			'position': 0
		})

	def test_create_transaction_mosaic_rows_creates_secret_lock_row(self):
		_assert_single_mosaic(self, TransactionType.SECRET_LOCK.value, {'mosaicId': '1111111111111111', 'amount': '10'}, {
			'mosaic_id': '1111111111111111',
			'amount': 10,
			'role': 'secret_lock',
			'position': 0
		})

	def test_create_transaction_mosaic_rows_creates_revocation_row(self):
		_assert_single_mosaic(self, TransactionType.MOSAIC_SUPPLY_REVOCATION.value, {'mosaicId': '1111111111111111', 'amount': '10'}, {
			'mosaic_id': '1111111111111111',
			'amount': 10,
			'role': 'revocation',
			'position': 0
		})

	def test_create_transaction_mosaic_rows_creates_mosaic_address_restriction_row(self):
		_assert_single_mosaic(self, TransactionType.MOSAIC_ADDRESS_RESTRICTION.value, {'mosaicId': '1111111111111111'}, {
			'mosaic_id': '1111111111111111',
			'amount': 0,
			'role': 'restriction',
			'position': 0
		})

	def test_create_transaction_mosaic_rows_creates_mosaic_global_restriction_rows_with_reference(self):
		# Arrange:
		transaction = {
			'mosaicId': '1111111111111111',
			'referenceMosaicId': '2222222222222222'
		}

		# Act:
		rows = create_transaction_mosaic_rows(TransactionType.MOSAIC_GLOBAL_RESTRICTION.value, transaction)

		# Assert:
		self.assertEqual([
			{'mosaic_id': '1111111111111111', 'amount': 0, 'role': 'restriction', 'position': 0},
			{'mosaic_id': '2222222222222222', 'amount': 0, 'role': 'restriction', 'position': 1}
		], rows)

	def test_create_transaction_mosaic_rows_skips_zero_reference_mosaic(self):
		# Arrange:
		transaction = {
			'mosaicId': '1111111111111111',
			'referenceMosaicId': '0000000000000000'
		}

		# Act:
		rows = create_transaction_mosaic_rows(TransactionType.MOSAIC_GLOBAL_RESTRICTION.value, transaction)

		# Assert:
		self.assertEqual([
			{'mosaic_id': '1111111111111111', 'amount': 0, 'role': 'restriction', 'position': 0}
		], rows)

	def test_create_transaction_mosaic_rows_creates_mosaic_definition_row(self):
		_assert_single_mosaic(self, TransactionType.MOSAIC_DEFINITION.value, {'id': '1111111111111111'}, {
			'mosaic_id': '1111111111111111',
			'amount': 0,
			'role': 'definition',
			'position': 0
		})

	def test_create_transaction_mosaic_rows_creates_mosaic_supply_change_row(self):
		_assert_single_mosaic(self, TransactionType.MOSAIC_SUPPLY_CHANGE.value, {'mosaicId': '1111111111111111', 'delta': '10'}, {
			'mosaic_id': '1111111111111111',
			'amount': 10,
			'role': 'definition',
			'position': 0
		})

	def test_create_transaction_mosaic_rows_returns_empty_for_type_outside_mapping(self):
		# Act:
		rows = create_transaction_mosaic_rows(TransactionType.ACCOUNT_METADATA.value, {})

		# Assert:
		self.assertEqual([], rows)

	def _assert_address_rows(self, transaction_type, transaction, expected):
		# Act:
		rows = create_transaction_address_rows(transaction_type, transaction, bytes.fromhex(SIGNER_ADDRESS), Network.TESTNET)

		# Assert:
		self.assertEqual(expected, rows)

	def test_create_transaction_address_rows_creates_signer_row_for_every_type(self):
		self._assert_address_rows(TransactionType.NAMESPACE_REGISTRATION.value, {}, [
			{'address': bytes.fromhex(SIGNER_ADDRESS), 'role': 'signer'}
		])

	def test_create_transaction_address_rows_creates_transfer_recipient_row(self):
		self._assert_address_rows(TransactionType.TRANSFER.value, {'recipientAddress': RECIPIENT_ADDRESS}, [
			{'address': bytes.fromhex(SIGNER_ADDRESS), 'role': 'signer'},
			{'address': bytes.fromhex(RECIPIENT_ADDRESS), 'role': 'recipient'}
		])

	def test_create_transaction_address_rows_creates_secret_lock_recipient_row(self):
		self._assert_address_rows(TransactionType.SECRET_LOCK.value, {'recipientAddress': RECIPIENT_ADDRESS}, [
			{'address': bytes.fromhex(SIGNER_ADDRESS), 'role': 'signer'},
			{'address': bytes.fromhex(RECIPIENT_ADDRESS), 'role': 'recipient'}
		])

	def test_create_transaction_address_rows_creates_secret_proof_recipient_row(self):
		self._assert_address_rows(TransactionType.SECRET_PROOF.value, {'recipientAddress': RECIPIENT_ADDRESS}, [
			{'address': bytes.fromhex(SIGNER_ADDRESS), 'role': 'signer'},
			{'address': bytes.fromhex(RECIPIENT_ADDRESS), 'role': 'recipient'}
		])

	def test_create_transaction_address_rows_creates_metadata_target_rows(self):
		for transaction_type in (
			TransactionType.ACCOUNT_METADATA.value,
			TransactionType.MOSAIC_METADATA.value,
			TransactionType.NAMESPACE_METADATA.value,
			TransactionType.MOSAIC_ADDRESS_RESTRICTION.value
		):
			with self.subTest(transaction_type=transaction_type):
				self._assert_address_rows(transaction_type, {'targetAddress': TARGET_ADDRESS}, [
					{'address': bytes.fromhex(SIGNER_ADDRESS), 'role': 'signer'},
					{'address': bytes.fromhex(TARGET_ADDRESS), 'role': 'target'}
				])

	def test_create_transaction_row_populates_scalar_target_address_for_single_target_types(self):
		for transaction_type in (
			TransactionType.ACCOUNT_METADATA.value,
			TransactionType.MOSAIC_METADATA.value,
			TransactionType.NAMESPACE_METADATA.value,
			TransactionType.MOSAIC_ADDRESS_RESTRICTION.value
		):
			with self.subTest(transaction_type=transaction_type):
				# Arrange:
				transaction_fields = {'targetAddress': TARGET_ADDRESS}
				if TransactionType.MOSAIC_ADDRESS_RESTRICTION.value == transaction_type:
					transaction_fields['mosaicId'] = '1111111111111111'
				item = _create_item(_create_top_level_transaction(
					transaction_type,
					**transaction_fields
				))

				# Act:
				row = create_transaction_row(item, Network.TESTNET, 100)

				# Assert:
				self.assertEqual(bytes.fromhex(TARGET_ADDRESS), row['target_address'])

	def test_create_transaction_address_rows_creates_account_address_restriction_targets(self):
		self._assert_address_rows(TransactionType.ACCOUNT_ADDRESS_RESTRICTION.value, {
			'restrictionAdditions': [TARGET_ADDRESS],
			'restrictionDeletions': [ALIAS_ADDRESS]
		}, [
			{'address': bytes.fromhex(SIGNER_ADDRESS), 'role': 'signer'},
			{'address': bytes.fromhex(TARGET_ADDRESS), 'role': 'target'},
			{'address': bytes.fromhex(ALIAS_ADDRESS), 'role': 'target'}
		])

	def test_create_transaction_address_rows_deduplicates_repeated_role_addresses(self):
		self._assert_address_rows(TransactionType.ACCOUNT_ADDRESS_RESTRICTION.value, {
			'restrictionAdditions': [TARGET_ADDRESS],
			'restrictionDeletions': [TARGET_ADDRESS]
		}, [
			{'address': bytes.fromhex(SIGNER_ADDRESS), 'role': 'signer'},
			{'address': bytes.fromhex(TARGET_ADDRESS), 'role': 'target'}
		])

	def test_create_transaction_row_leaves_scalar_target_address_empty_for_list_target_type(self):
		# Arrange:
		item = _create_item(_create_top_level_transaction(
			TransactionType.ACCOUNT_ADDRESS_RESTRICTION.value,
			restrictionAdditions=[TARGET_ADDRESS],
			restrictionDeletions=[ALIAS_ADDRESS]
		))

		# Act:
		row = create_transaction_row(item, Network.TESTNET, 100)

		# Assert:
		self.assertIsNone(row['target_address'])

	def test_create_transaction_address_rows_creates_address_alias_target(self):
		self._assert_address_rows(TransactionType.ADDRESS_ALIAS.value, {'address': ALIAS_ADDRESS}, [
			{'address': bytes.fromhex(SIGNER_ADDRESS), 'role': 'signer'},
			{'address': bytes.fromhex(ALIAS_ADDRESS), 'role': 'target'}
		])

	def test_create_transaction_address_rows_creates_mosaic_supply_revocation_sender(self):
		self._assert_address_rows(TransactionType.MOSAIC_SUPPLY_REVOCATION.value, {'sourceAddress': SOURCE_ADDRESS}, [
			{'address': bytes.fromhex(SIGNER_ADDRESS), 'role': 'signer'},
			{'address': bytes.fromhex(SOURCE_ADDRESS), 'role': 'sender'}
		])

	def test_create_transaction_address_rows_creates_aggregate_cosignatories(self):
		expected_cosigner_address = Network.TESTNET.public_key_to_address(PublicKey(bytes.fromhex(COSIGNER_PUBLIC_KEY))).bytes
		expected_second_cosigner_address = Network.TESTNET.public_key_to_address(PublicKey(bytes.fromhex(SECOND_COSIGNER_PUBLIC_KEY))).bytes

		self._assert_address_rows(TransactionType.AGGREGATE_COMPLETE.value, {
			'cosignatures': [
				{'signerPublicKey': COSIGNER_PUBLIC_KEY},
				{'signerPublicKey': SECOND_COSIGNER_PUBLIC_KEY}
			]
		}, [
			{'address': bytes.fromhex(SIGNER_ADDRESS), 'role': 'signer'},
			{'address': expected_cosigner_address, 'role': 'cosignatory'},
			{'address': expected_second_cosigner_address, 'role': 'cosignatory'}
		])

	def test_create_transaction_address_rows_creates_multisig_cosignatories(self):
		self._assert_address_rows(TransactionType.MULTISIG_ACCOUNT_MODIFICATION.value, {
			'addressAdditions': [TARGET_ADDRESS],
			'addressDeletions': [ALIAS_ADDRESS]
		}, [
			{'address': bytes.fromhex(SIGNER_ADDRESS), 'role': 'signer'},
			{'address': bytes.fromhex(TARGET_ADDRESS), 'role': 'cosignatory'},
			{'address': bytes.fromhex(ALIAS_ADDRESS), 'role': 'cosignatory'}
		])

	def test_create_transaction_address_rows_creates_mosaic_definition_owner(self):
		self._assert_address_rows(TransactionType.MOSAIC_DEFINITION.value, {}, [
			{'address': bytes.fromhex(SIGNER_ADDRESS), 'role': 'signer'},
			{'address': bytes.fromhex(SIGNER_ADDRESS), 'role': 'mosaic_owner'}
		])

	def test_create_transaction_row_builds_body_from_type_specific_fields(self):
		# Arrange:
		transaction = _create_top_level_transaction(
			TransactionType.MOSAIC_GLOBAL_RESTRICTION.value,
			message='00ABCD',
			mosaicId='1111111111111111',
			referenceMosaicId='2222222222222222',
			restrictionKey='1',
			previousRestrictionType=0,
			previousRestrictionValue='0',
			newRestrictionType=1,
			newRestrictionValue='10'
		)
		item = _create_item(transaction)

		# Act:
		row = create_transaction_row(item, Network.TESTNET, 100)

		# Assert:
		self.assertEqual({
			'signature': '1' * 128,
			'version': 1,
			'network': 152,
			'mosaicId': '1111111111111111',
			'referenceMosaicId': '2222222222222222',
			'restrictionKey': '1',
			'previousRestrictionType': 0,
			'previousRestrictionValue': '0',
			'newRestrictionType': 1,
			'newRestrictionValue': '10'
		}, row['body'])

	def test_create_transaction_row_keeps_transfer_mosaics_in_body(self):
		# Arrange:
		item = _create_item()

		# Act:
		row = create_transaction_row(item, Network.TESTNET, 100)

		# Assert:
		self.assertEqual([{'id': 'E74B99BA41F4AFEE', 'amount': '3000000'}], row['body']['mosaics'])

	def test_create_transaction_row_keeps_aggregate_cosignatures_in_body(self):
		# Arrange:
		transaction = _create_top_level_transaction(
			TransactionType.AGGREGATE_COMPLETE.value,
			transactionsHash='9' * 64,
			cosignatures=[{'signerPublicKey': COSIGNER_PUBLIC_KEY, 'signature': '2' * 128}]
		)
		item = _create_item(transaction)

		# Act:
		row = create_transaction_row(item, Network.TESTNET, 100)

		# Assert:
		self.assertEqual([{'signerPublicKey': COSIGNER_PUBLIC_KEY, 'signature': '2' * 128}], row['body']['cosignatures'])
