from decimal import Decimal
from unittest import TestCase

from common.symbol.NativeMosaic import NativeMosaicInfo
from symbolchain.symbol.Network import Network

from rest.db.SymbolDatabase import SymbolAccountRecord, SymbolMosaicRecord, SymbolMultisigRecord
from rest.model.symbol.Account import SymbolAccountView, SymbolMultisigView
from rest.model.symbol.validation import SymbolDataInvalid

from ...test.SymbolAccountTestUtils import ACCOUNT_ADDRESS, OTHER_ADDRESS

NATIVE_MOSAIC_INFO = NativeMosaicInfo('72C0212E67A08BCE', 6)
MAINNET_ACCOUNT_ADDRESS = bytes.fromhex('68FD35818960C7B18B72F49A5598FA9F712A354DB3BF4C77')
OWNER_ADDRESS = ACCOUNT_ADDRESS


def create_account(**overrides):
	values = {
		'address': ACCOUNT_ADDRESS,
		'public_key': bytes.fromhex('01' * 32),
		'account_type': 'main',
		'address_height': 123,
		'importance_percentage': Decimal('0.025'),
		'linked_public_key': bytes.fromhex('11' * 32),
		'node_public_key': bytes.fromhex('22' * 32),
		'vrf_public_key': bytes.fromhex('00' * 32),
		'voting_public_keys': [
			{'publicKey': 'ab' * 32, 'startEpoch': '100', 'endEpoch': '200'},
			{'publicKey': 'cd' * 32, 'startEpoch': 300, 'endEpoch': 400}
		],
		'activity_buckets': [{
			'startHeight': '0', 'totalFeesPaid': '1234567', 'beneficiaryCount': 2, 'rawScore': '5000000000'
		}],
		'finalized_epoch': 200,
		'alias_names': ['zeta', 'alpha'],
		'mosaics': (
			SymbolMosaicRecord('1234567890abcdef', 12345, None, None, None, ()),
			SymbolMosaicRecord('72c0212e67a08bce', 1234567, '72C0212E67A08BCE', 6, OWNER_ADDRESS, ('xym',))
		)
	}
	values.update(overrides)
	return SymbolAccountRecord(**values)


class SymbolAccountViewTest(TestCase):
	def test_to_dict_returns_complete_current_state_dto(self):
		# Arrange:
		view = SymbolAccountView(create_account(), Network.TESTNET, NATIVE_MOSAIC_INFO)

		# Act:
		result = view.to_dict()

		# Assert:
		self.assertEqual({
			'address': 'TD6TLAMJMDD3DC3S6SNFLGH2T5YSUNKNWM7N4VY',
			'publicKey': '01' * 32,
			'description': None,
			'namespaces': ['zeta', 'alpha'],
			'balance': 1.234567,
			'importance': 0.025,
			'accountType': 'main',
			'isHarvestingActive': None,
			'mosaics': [
				{'id': '1234567890ABCDEF', 'name': '1234567890ABCDEF', 'amount': 12345.0, 'isCreatedByAccount': False},
				{'id': '72C0212E67A08BCE', 'name': 'xym', 'amount': 1.234567, 'isCreatedByAccount': True}
			],
			'supplementalKeys': {
				'linked': 'TD6TLAMJMDD3DC3S6SNFLGH2T5YSUNKNWM7N4VY',
				'node': 'TAHJNXEF62ZEVSOI3NP7YWODLCAMBNZCY6LTIIY',
				'vrf': 'TAXQUTQQNS6JEJG7PLC6FRVJ2USS44GLMVULPGQ'
			},
			'votingKeys': [
				{'publicKey': 'AB' * 32, 'startEpoch': 100, 'endEpoch': 200, 'status': 'current'},
				{'publicKey': 'CD' * 32, 'startEpoch': 300, 'endEpoch': 400, 'status': 'future'}
			],
			'importanceHistory': [{
				'recalculationBlock': 0, 'totalFeesPaid': 1.234567, 'beneficiaryCount': 2, 'importanceScore': 5000000000
			}],
			'isMultisig': False,
			'cosignatories': [],
			'cosignatoryOf': [],
			'height': 123,
			'harvestedBlocks': None,
			'harvestedFees': None,
			'minCosignatories': 0,
			'remoteAddress': None
		}, result)
		self.assertIs(type(result['isMultisig']), bool)
		self.assertIs(type(result['minCosignatories']), int)
		self.assertIs(type(result['mosaics'][0]['isCreatedByAccount']), bool)
		self.assertIs(type(result['mosaics'][1]['isCreatedByAccount']), bool)
		self.assertIs(type(result['height']), int)
		self.assertIs(type(result['votingKeys'][0]['startEpoch']), int)
		self.assertIs(type(result['votingKeys'][0]['endEpoch']), int)
		self.assertIs(type(result['importanceHistory'][0]['recalculationBlock']), int)
		self.assertIs(type(result['importanceHistory'][0]['beneficiaryCount']), int)
		self.assertIs(type(result['importanceHistory'][0]['importanceScore']), int)

	def test_to_dict_normalizes_supported_bytes_like_values(self):
		# Arrange:
		account = create_account(
			address=memoryview(ACCOUNT_ADDRESS),
			public_key=memoryview(bytes.fromhex('01' * 32)),
			linked_public_key=bytearray(bytes.fromhex('11' * 32)))

		# Act:
		result = SymbolAccountView(account, Network.TESTNET, NATIVE_MOSAIC_INFO).to_dict()

		# Assert:
		self.assertEqual('TD6TLAMJMDD3DC3S6SNFLGH2T5YSUNKNWM7N4VY', result['address'])
		self.assertEqual('01' * 32, result['publicKey'])
		self.assertEqual('TD6TLAMJMDD3DC3S6SNFLGH2T5YSUNKNWM7N4VY', result['supplementalKeys']['linked'])

	def test_to_dict_rejects_released_saved_byte_view(self):
		# Arrange:
		released_address = memoryview(ACCOUNT_ADDRESS)
		released_address.release()

		# Act + Assert:
		with self.assertRaises(SymbolDataInvalid):
			SymbolAccountView(
				create_account(address=released_address), Network.TESTNET, NATIVE_MOSAIC_INFO).to_dict()

	def test_to_dict_rejects_saved_address_for_other_network(self):
		# Act + Assert:
		with self.assertRaises(SymbolDataInvalid):
			SymbolAccountView(create_account(), Network.MAINNET, NATIVE_MOSAIC_INFO).to_dict()

	def test_to_dict_returns_zero_balance_when_native_mosaic_row_is_absent(self):
		# Arrange:
		account = create_account(mosaics=(
			SymbolMosaicRecord('1234567890ABCDEF', 12345, None, None, None, ()),))

		# Act:
		result = SymbolAccountView(account, Network.TESTNET, NATIVE_MOSAIC_INFO).to_dict()

		# Assert:
		self.assertEqual(0, result['balance'])
		self.assertEqual(12345.0, result['mosaics'][0]['amount'])

	def test_to_dict_uses_native_divisibility_without_metadata(self):
		# Arrange:
		account = create_account(mosaics=(
			SymbolMosaicRecord('72C0212E67A08BCE', 1, None, None, None, ()),))

		# Act:
		result = SymbolAccountView(account, Network.TESTNET, NATIVE_MOSAIC_INFO).to_dict()

		# Assert:
		self.assertEqual(0.000001, result['mosaics'][0]['amount'])
		self.assertIs(False, result['mosaics'][0]['isCreatedByAccount'])

	def test_to_dict_marks_other_mosaic_owner_as_not_created_by_account(self):
		# Arrange:
		account = create_account(mosaics=(
			SymbolMosaicRecord('1234567890ABCDEF', 12345, '1234567890ABCDEF', 2, OTHER_ADDRESS, ()),))

		# Act:
		result = SymbolAccountView(account, Network.TESTNET, NATIVE_MOSAIC_INFO).to_dict()

		# Assert:
		self.assertEqual(123.45, result['mosaics'][0]['amount'])
		self.assertIs(False, result['mosaics'][0]['isCreatedByAccount'])

	def test_to_dict_preserves_zero_amount_with_metadata_divisibility(self):
		# Arrange:
		account = create_account(mosaics=(
			SymbolMosaicRecord('1234567890ABCDEF', 0, '1234567890ABCDEF', 6, OWNER_ADDRESS, ()),))

		# Act:
		result = SymbolAccountView(account, Network.TESTNET, NATIVE_MOSAIC_INFO).to_dict()

		# Assert:
		self.assertEqual(0, result['balance'])
		self.assertEqual(0.0, result['mosaics'][0]['amount'])

	def test_to_dict_preserves_zero_divisibility_with_nonzero_amount(self):
		# Arrange:
		account = create_account(mosaics=(
			SymbolMosaicRecord('1234567890ABCDEF', 123, '1234567890ABCDEF', 0, OWNER_ADDRESS, ()),))

		# Act:
		result = SymbolAccountView(account, Network.TESTNET, NATIVE_MOSAIC_INFO).to_dict()

		# Assert:
		self.assertEqual(123.0, result['mosaics'][0]['amount'])

	def test_to_dict_accepts_maximum_mosaic_divisibility(self):
		# Arrange:
		account = create_account(mosaics=(
			SymbolMosaicRecord('1234567890ABCDEF', 1, '1234567890ABCDEF', 255, OWNER_ADDRESS, ()),))

		# Act:
		result = SymbolAccountView(account, Network.TESTNET, NATIVE_MOSAIC_INFO).to_dict()

		# Assert:
		self.assertEqual(1e-255, result['mosaics'][0]['amount'])

	def test_to_dict_uses_network_for_supplemental_key_addresses(self):
		# Arrange:
		view = SymbolAccountView(create_account(address=MAINNET_ACCOUNT_ADDRESS, mosaics=(), alias_names=[]), Network.MAINNET, NATIVE_MOSAIC_INFO)

		# Act:
		result = view.to_dict()

		# Assert:
		self.assertEqual('ND6TLAMJMDD3DC3S6SNFLGH2T5YSUNKNWO7UY5Y', result['supplementalKeys']['linked'])
		self.assertEqual('NAXQUTQQNS6JEJG7PLC6FRVJ2USS44GLMUL5QKI', result['supplementalKeys']['vrf'])

	def test_to_dict_preserves_each_null_supplemental_key_for_both_networks(self):
		# Arrange:
		expected_addresses = {
			'testnet': {
				'linked_public_key': {
					'linked': None,
					'node': 'TAHJNXEF62ZEVSOI3NP7YWODLCAMBNZCY6LTIIY',
					'vrf': 'TAXQUTQQNS6JEJG7PLC6FRVJ2USS44GLMVULPGQ'
				},
				'node_public_key': {
					'linked': 'TD6TLAMJMDD3DC3S6SNFLGH2T5YSUNKNWM7N4VY',
					'node': None,
					'vrf': 'TAXQUTQQNS6JEJG7PLC6FRVJ2USS44GLMVULPGQ'
				},
				'vrf_public_key': {
					'linked': 'TD6TLAMJMDD3DC3S6SNFLGH2T5YSUNKNWM7N4VY',
					'node': 'TAHJNXEF62ZEVSOI3NP7YWODLCAMBNZCY6LTIIY',
					'vrf': None
				}
			},
			'mainnet': {
				'linked_public_key': {
					'linked': None,
					'node': 'NAHJNXEF62ZEVSOI3NP7YWODLCAMBNZCY4X3FNY',
					'vrf': 'NAXQUTQQNS6JEJG7PLC6FRVJ2USS44GLMUL5QKI'
				},
				'node_public_key': {
					'linked': 'ND6TLAMJMDD3DC3S6SNFLGH2T5YSUNKNWO7UY5Y',
					'node': None,
					'vrf': 'NAXQUTQQNS6JEJG7PLC6FRVJ2USS44GLMUL5QKI'
				},
				'vrf_public_key': {
					'linked': 'ND6TLAMJMDD3DC3S6SNFLGH2T5YSUNKNWO7UY5Y',
					'node': 'NAHJNXEF62ZEVSOI3NP7YWODLCAMBNZCY4X3FNY',
					'vrf': None
				}
			}
		}
		# Act + Assert:
		for network_name, cases in expected_addresses.items():
			network = Network.MAINNET if network_name == 'mainnet' else Network.TESTNET
			for null_field, expected in cases.items():
				with self.subTest(network=network.name, null_field=null_field):
					values = {
						'linked_public_key': bytes.fromhex('11' * 32),
						'node_public_key': bytes.fromhex('22' * 32),
						'vrf_public_key': bytes.fromhex('00' * 32)
					}
					values[null_field] = None
					result = SymbolAccountView(
						create_account(
							address=MAINNET_ACCOUNT_ADDRESS if network == Network.MAINNET else ACCOUNT_ADDRESS,
							mosaics=(),
							**values),
						network,
						NATIVE_MOSAIC_INFO).to_dict()
					self.assertEqual(expected, result['supplementalKeys'])

	def test_to_dict_preserves_null_zero_and_empty_values(self):
		# Arrange:
		account = create_account(
			public_key=None,
			account_type=None,
			address_height=None,
			importance_percentage=0,
			linked_public_key=None,
			node_public_key=None,
			vrf_public_key=None,
			voting_public_keys=[],
			activity_buckets=[],
			alias_names=[],
			mosaics=())

		# Act:
		result = SymbolAccountView(account, Network.TESTNET, NATIVE_MOSAIC_INFO).to_dict()

		# Assert:
		self.assertEqual(None, result['publicKey'])
		self.assertEqual(None, result['accountType'])
		self.assertEqual(None, result['height'])
		self.assertEqual(0.0, result['importance'])
		self.assertEqual(0, result['balance'])
		self.assertEqual({'linked': None, 'node': None, 'vrf': None}, result['supplementalKeys'])
		self.assertEqual([], result['votingKeys'])
		self.assertEqual([], result['importanceHistory'])
		self.assertEqual([], result['mosaics'])

	def test_to_dict_preserves_zero_saved_account_and_voting_public_keys(self):
		# Arrange:
		account = create_account(
			public_key=bytes(32),
			finalized_epoch=1,
			voting_public_keys=[{'publicKey': '00' * 32, 'startEpoch': 1, 'endEpoch': 1}])

		# Act:
		result = SymbolAccountView(account, Network.TESTNET, NATIVE_MOSAIC_INFO).to_dict()

		# Assert:
		self.assertEqual('00' * 32, result['publicKey'])
		self.assertEqual([{'publicKey': '00' * 32, 'startEpoch': 1, 'endEpoch': 1, 'status': 'current'}], result['votingKeys'])

	def test_to_dict_preserves_zero_persisted_numeric_values(self):
		# Arrange:
		account = create_account(
			address_height=0,
			importance_percentage=0,
			finalized_epoch=0,
			voting_public_keys=[],
			activity_buckets=[{'startHeight': 0, 'totalFeesPaid': 0, 'beneficiaryCount': 0, 'rawScore': 0}],
			mosaics=(SymbolMosaicRecord('0000000000000000', 0, None, None, None, ()),))

		# Act:
		result = SymbolAccountView(account, Network.TESTNET, NATIVE_MOSAIC_INFO).to_dict()

		# Assert:
		self.assertEqual(0, result['height'])
		self.assertEqual(0.0, result['importance'])
		self.assertEqual([{
			'recalculationBlock': 0,
			'totalFeesPaid': 0.0,
			'beneficiaryCount': 0,
			'importanceScore': 0
		}], result['importanceHistory'])
		self.assertEqual([{
			'id': '0000000000000000',
			'name': '0000000000000000',
			'amount': 0.0,
			'isCreatedByAccount': False
		}], result['mosaics'])

	def test_to_dict_classifies_voting_end_epoch_as_current(self):
		# Arrange:
		account = create_account(
			finalized_epoch=200,
			voting_public_keys=[{'publicKey': 'ab' * 32, 'startEpoch': 200, 'endEpoch': 200}])

		# Act:
		result = SymbolAccountView(account, Network.TESTNET, NATIVE_MOSAIC_INFO).to_dict()

		# Assert:
		self.assertEqual('current', result['votingKeys'][0]['status'])

	def test_to_dict_classifies_all_voting_epoch_boundaries(self):
		# Arrange:
		boundaries = ((4, 'future'), (5, 'current'), (6, 'current'), (7, 'current'), (8, 'expired'))

		# Act + Assert:
		for finalized_epoch, expected_status in boundaries:
			with self.subTest(finalized_epoch=finalized_epoch):
				result = SymbolAccountView(
					create_account(
						finalized_epoch=finalized_epoch,
						voting_public_keys=[{'publicKey': 'ab' * 32, 'startEpoch': 5, 'endEpoch': 7}]),
					Network.TESTNET,
					NATIVE_MOSAIC_INFO).to_dict()
				self.assertEqual(expected_status, result['votingKeys'][0]['status'])


class SymbolAccountViewValidationTest(TestCase):

	def test_to_dict_requires_finalized_epoch_with_empty_voting_keys(self):
		# Arrange:
		account = create_account(finalized_epoch=None, voting_public_keys=[])

		# Act + Assert:
		with self.assertRaises(SymbolDataInvalid):
			SymbolAccountView(account, Network.TESTNET, NATIVE_MOSAIC_INFO).to_dict()

	def test_to_dict_rejects_reversed_voting_epoch(self):
		# Arrange:
		account = create_account(
			voting_public_keys=[{'publicKey': 'ab' * 32, 'startEpoch': 2, 'endEpoch': 1}])

		# Act + Assert:
		with self.assertRaises(SymbolDataInvalid):
			SymbolAccountView(account, Network.TESTNET, NATIVE_MOSAIC_INFO).to_dict()

	def test_to_dict_rejects_missing_and_null_jsonb_fields_with_field_paths(self):
		# Arrange:
		voting_fields = ('publicKey', 'startEpoch', 'endEpoch')
		activity_fields = ('startHeight', 'totalFeesPaid', 'beneficiaryCount', 'rawScore')
		invalid_values = []
		for field in voting_fields:
			missing_key = {'publicKey': 'AB' * 32, 'startEpoch': 1, 'endEpoch': 1}
			missing_key.pop(field)
			invalid_values.append((create_account(voting_public_keys=[missing_key]), f'accounts.voting_public_keys[0].{field}'))
			null_key = {'publicKey': 'AB' * 32, 'startEpoch': 1, 'endEpoch': 1}
			null_key[field] = None
			invalid_values.append((create_account(voting_public_keys=[null_key]), f'accounts.voting_public_keys[0].{field}'))
		for field in activity_fields:
			missing_field = {'startHeight': 0, 'totalFeesPaid': 0, 'beneficiaryCount': 0, 'rawScore': 0}
			missing_field.pop(field)
			invalid_values.append((create_account(activity_buckets=[missing_field]), f'accounts.activity_buckets[0].{field}'))
			null_field = {'startHeight': 0, 'totalFeesPaid': 0, 'beneficiaryCount': 0, 'rawScore': 0}
			null_field[field] = None
			invalid_values.append((create_account(activity_buckets=[null_field]), f'accounts.activity_buckets[0].{field}'))

		# Act + Assert:
		for account, field_path in invalid_values:
			with self.subTest(field_path=field_path):
				with self.assertRaises(SymbolDataInvalid) as context:
					SymbolAccountView(account, Network.TESTNET, NATIVE_MOSAIC_INFO).to_dict()
				self.assertEqual(field_path, context.exception.field_path)

	def test_to_dict_rejects_invalid_importance_ratio(self):
		# Arrange:
		invalid_values = (None, '0.5', True, float('nan'), Decimal('NaN'), Decimal('Infinity'), Decimal('-Infinity'), -0.1, 1.1)

		# Act + Assert:
		for value in invalid_values:
			with self.subTest(value=value), self.assertRaises(SymbolDataInvalid):
				SymbolAccountView(
					create_account(importance_percentage=value), Network.TESTNET, NATIVE_MOSAIC_INFO).to_dict()

	def test_to_dict_accepts_persisted_integer_upper_bounds(self):
		# Arrange:
		account = create_account(
			address_height=9223372036854775807,
			finalized_epoch=2147483647,
			voting_public_keys=[{
				'publicKey': 'ab' * 32,
				'startEpoch': 1,
				'endEpoch': 4294967295
			}],
			activity_buckets=[{
				'startHeight': '18446744073709551615',
				'totalFeesPaid': '18446744073709551615',
				'beneficiaryCount': '4294967295',
				'rawScore': '18446744073709551615'
			}],
			mosaics=(
				SymbolMosaicRecord('1234567890ABCDEF', 1, '1234567890ABCDEF', 255, OWNER_ADDRESS, ()),
				SymbolMosaicRecord('72C0212E67A08BCE', 9223372036854775807, None, None, None, ())))

		# Act:
		result = SymbolAccountView(account, Network.TESTNET, NATIVE_MOSAIC_INFO).to_dict()

		# Assert:
		self.assertEqual(9223372036854775807, result['height'])
		self.assertEqual('current', result['votingKeys'][0]['status'])
		self.assertEqual(4294967295, result['votingKeys'][0]['endEpoch'])
		self.assertEqual(18446744073709551615, result['importanceHistory'][0]['importanceScore'])
		self.assertEqual(18446744073709551615, result['importanceHistory'][0]['recalculationBlock'])
		self.assertIs(type(result['importanceHistory'][0]['recalculationBlock']), int)
		self.assertEqual(4294967295, result['importanceHistory'][0]['beneficiaryCount'])
		self.assertEqual(1e-255, result['mosaics'][0]['amount'])

	def test_to_dict_rejects_persisted_integer_out_of_range_and_wrong_types(self):
		# Arrange:
		invalid_accounts = (
			{'address_height': -1},
			{'address_height': True},
			{'address_height': 1.0},
			{'address_height': 9223372036854775808},
			{'finalized_epoch': -1},
			{'finalized_epoch': 2147483648},
			{'finalized_epoch': True},
			{'finalized_epoch': 5.0},
			{'finalized_epoch': '5'},
			{'activity_buckets': [{'rawScore': 1.0, 'startHeight': 0, 'totalFeesPaid': 0, 'beneficiaryCount': 0}]},
			{'activity_buckets': [{'rawScore': '1.0', 'startHeight': 0, 'totalFeesPaid': 0, 'beneficiaryCount': 0}]},
			{'voting_public_keys': [{'publicKey': 'ab' * 32, 'startEpoch': 0, 'endEpoch': 1}]},
			{'voting_public_keys': [{'publicKey': 'ab' * 32, 'startEpoch': True, 'endEpoch': 1}]},
			{'voting_public_keys': [{'publicKey': 'ab' * 32, 'startEpoch': 1.0, 'endEpoch': 1}]},
			{'voting_public_keys': [{'publicKey': 'ab' * 32, 'startEpoch': '1.0', 'endEpoch': 1}]},
			{'voting_public_keys': [{'publicKey': 'ab' * 32, 'startEpoch': '9' * 5000, 'endEpoch': 1}]}
		)

		# Act + Assert:
		for overrides in invalid_accounts:
			with self.subTest(overrides=overrides), self.assertRaises(SymbolDataInvalid):
				SymbolAccountView(create_account(**overrides), Network.TESTNET, NATIVE_MOSAIC_INFO).to_dict()

	def test_to_dict_rejects_each_uint64_activity_field_boundary_and_type(self):
		# Arrange:
		activity_fields = ('startHeight', 'totalFeesPaid', 'rawScore')
		invalid_values = (-1, 18446744073709551616, True, 1.0, 'not-a-number')
		invalid_activity = [
			(field, value)
			for field in activity_fields
			for value in invalid_values
		]
		invalid_activity.extend(
			('beneficiaryCount', value) for value in (-1, 4294967296, True, 1.0, 'not-a-number'))

		# Act + Assert:
		for field, value in invalid_activity:
			with self.subTest(field=field, value=value):
				bucket = {'startHeight': 0, 'totalFeesPaid': 0, 'beneficiaryCount': 0, 'rawScore': 0}
				bucket[field] = value
				with self.assertRaises(SymbolDataInvalid) as context:
					SymbolAccountView(
						create_account(activity_buckets=[bucket]), Network.TESTNET, NATIVE_MOSAIC_INFO).to_dict()
				self.assertEqual(f'accounts.activity_buckets[0].{field}', context.exception.field_path)

	def test_to_dict_rejects_each_voting_epoch_integer_boundary_and_type(self):
		# Arrange:
		invalid_epochs = [
			(field, value)
			for field in ('startEpoch', 'endEpoch')
			for value in (-1, 0, 4294967296, True, 1.0, '1.0')
		]

		# Act + Assert:
		for field, value in invalid_epochs:
			with self.subTest(field=field, value=value):
				voting_key = {'publicKey': 'AB' * 32, 'startEpoch': 1, 'endEpoch': 1}
				voting_key[field] = value
				with self.assertRaises(SymbolDataInvalid) as context:
					SymbolAccountView(
						create_account(voting_public_keys=[voting_key]), Network.TESTNET, NATIVE_MOSAIC_INFO).to_dict()
				self.assertEqual(f'accounts.voting_public_keys[0].{field}', context.exception.field_path)

		# Assert:
		result = SymbolAccountView(
			create_account(
				finalized_epoch=2147483647,
				voting_public_keys=[{'publicKey': 'AB' * 32, 'startEpoch': 4294967295, 'endEpoch': 4294967295}]),
			Network.TESTNET,
			NATIVE_MOSAIC_INFO).to_dict()
		self.assertEqual(4294967295, result['votingKeys'][0]['startEpoch'])
		self.assertEqual(4294967295, result['votingKeys'][0]['endEpoch'])

	def test_to_dict_rejects_malformed_saved_bytes_arrays_and_keys(self):
		# Arrange:
		invalid_accounts = (
			{'address': None},
			{'address': b'bad'},
			{'public_key': b'bad'},
			{'public_key': 32},
			{'node_public_key': b'bad'},
			{'vrf_public_key': 32},
			{'account_type': 'unknown'},
			{'account_type': []},
			{'linked_public_key': b'bad'},
			{'linked_public_key': 32},
			{'voting_public_keys': None},
			{'voting_public_keys': [None]},
			{'voting_public_keys': [{'publicKey': 'ab', 'startEpoch': 1, 'endEpoch': 1}]},
			{'voting_public_keys': [{'publicKey': 'gg' * 32, 'startEpoch': 1, 'endEpoch': 1}]},
			{'activity_buckets': None},
			{'activity_buckets': [None]},
			{'mosaics': None},
			{'mosaics': (object(),)},
			{'alias_names': [None]}
		)

		# Act + Assert:
		for overrides in invalid_accounts:
			with self.subTest(overrides=overrides), self.assertRaises(SymbolDataInvalid):
				SymbolAccountView(create_account(**overrides), Network.TESTNET, NATIVE_MOSAIC_INFO).to_dict()

	def test_to_dict_rejects_malformed_mosaic_values(self):
		# Arrange:
		invalid_mosaics = (
			SymbolMosaicRecord('bad', 1, None, None, None, ()),
			SymbolMosaicRecord('1234567890ABCDEF', -1, None, None, None, ()),
			SymbolMosaicRecord('1234567890ABCDEF', 1, 'metadata', -1, OWNER_ADDRESS, ()),
			SymbolMosaicRecord('1234567890ABCDEF', 1, 'metadata', 256, OWNER_ADDRESS, ()),
			SymbolMosaicRecord('1234567890ABCDEF', 1, 'metadata', True, OWNER_ADDRESS, ()),
			SymbolMosaicRecord('1234567890ABCDEF', 1, 'metadata', 1.0, OWNER_ADDRESS, ()),
			SymbolMosaicRecord('1234567890ABCDEF', 1, 'metadata', None, OWNER_ADDRESS, ()),
			SymbolMosaicRecord('1234567890ABCDEF', 1, 'metadata', 1, b'bad', ()),
			SymbolMosaicRecord('1234567890ABCDEF', 1, None, None, None, None),
			SymbolMosaicRecord('1234567890ABCDEF', 1, None, None, None, (None,)),
			SymbolMosaicRecord('1234567890ABCDEF', True, None, None, None, ()),
			SymbolMosaicRecord('1234567890ABCDEF', 1.0, None, None, None, ()),
			SymbolMosaicRecord('1234567890ABCDEF', 9223372036854775808, None, None, None, ()),
			SymbolMosaicRecord('1234567890ABCDEF', None, None, None, None, ())
		)

		# Act + Assert:
		for mosaic in invalid_mosaics:
			with self.subTest(mosaic=mosaic), self.assertRaises(SymbolDataInvalid):
				SymbolAccountView(
					create_account(mosaics=(mosaic,)), Network.TESTNET, NATIVE_MOSAIC_INFO).to_dict()


class SymbolMultisigViewTest(TestCase):
	def test_to_dict_preserves_thresholds_and_saved_array_order(self):
		# Arrange:
		multisig = SymbolMultisigRecord(
			2, 1, [OTHER_ADDRESS, ACCOUNT_ADDRESS, OTHER_ADDRESS], [OTHER_ADDRESS, ACCOUNT_ADDRESS])

		# Act:
		result = SymbolMultisigView(multisig, Network.TESTNET).to_dict()

		# Assert:
		self.assertEqual({
			'minApproval': 2,
			'minRemoval': 1,
			'cosignatoryAddresses': [
				'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI',
				'TD6TLAMJMDD3DC3S6SNFLGH2T5YSUNKNWM7N4VY',
				'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI'],
			'multisigAddresses': [
				'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI', 'TD6TLAMJMDD3DC3S6SNFLGH2T5YSUNKNWM7N4VY']
		}, result)

	def test_to_dict_returns_none_for_no_relationship(self):
		# Arrange:
		multisig = SymbolMultisigRecord(2, 1, [], [])

		# Act + Assert:
		self.assertEqual(None, SymbolMultisigView(multisig, Network.TESTNET).to_dict())

	def test_to_dict_rejects_missing_address_arrays(self):
		# Act + Assert:
		for multisig in (
			SymbolMultisigRecord(1, 1, None, []),
			SymbolMultisigRecord(1, 1, [], None),
			SymbolMultisigRecord(1, 1, (), [])):
			with self.subTest(multisig=multisig), self.assertRaises(SymbolDataInvalid):
				SymbolMultisigView(multisig, Network.TESTNET).to_dict()

	def test_to_dict_returns_null_thresholds_for_cosignatory_only_account(self):
		# Arrange:
		multisig = SymbolMultisigRecord(-1, True, [], [ACCOUNT_ADDRESS])

		# Act:
		result = SymbolMultisigView(multisig, Network.TESTNET).to_dict()

		# Assert:
		self.assertEqual(None, result['minApproval'])
		self.assertEqual(None, result['minRemoval'])

	def test_to_dict_rejects_invalid_thresholds_when_cosignatories_are_published(self):
		# Arrange:
		invalid_thresholds = (
			(-1, 1, 'multisig.min_approval'),
			(2147483648, 1, 'multisig.min_approval'),
			(True, 1, 'multisig.min_approval'),
			(1, -1, 'multisig.min_removal'),
			(1, 2147483648, 'multisig.min_removal'),
			(1, False, 'multisig.min_removal'))

		# Act + Assert:
		for min_approval, min_removal, field_path in invalid_thresholds:
			with self.subTest(field_path=field_path, min_approval=min_approval, min_removal=min_removal):
				multisig = SymbolMultisigRecord(min_approval, min_removal, [ACCOUNT_ADDRESS], [])
				with self.assertRaises(SymbolDataInvalid) as context:
					SymbolMultisigView(multisig, Network.TESTNET).to_dict()
				self.assertEqual(field_path, context.exception.field_path)

	def test_to_dict_rejects_invalid_related_address_values(self):
		# Arrange:
		invalid_arrays = (
			([None], [], 'multisig.cosignatory_addresses[0]'),
			([], [None], 'multisig.multisig_addresses[0]'),
			([b'bad'], [], 'multisig.cosignatory_addresses[0]'),
			([], [b'bad'], 'multisig.multisig_addresses[0]'),
			([MAINNET_ACCOUNT_ADDRESS], [], 'multisig.cosignatory_addresses[0]'),
			([], [MAINNET_ACCOUNT_ADDRESS], 'multisig.multisig_addresses[0]'))

		# Act + Assert:
		for cosignatories, multisig_addresses, field_path in invalid_arrays:
			with self.subTest(field_path=field_path):
				multisig = SymbolMultisigRecord(1, 1, cosignatories, multisig_addresses)
				with self.assertRaises(SymbolDataInvalid) as context:
					SymbolMultisigView(multisig, Network.TESTNET).to_dict()
				self.assertEqual(field_path, context.exception.field_path)

	def test_to_dict_accepts_threshold_integer_bounds(self):
		# Arrange:
		multisig = SymbolMultisigRecord(2147483647, 0, [ACCOUNT_ADDRESS], [])

		# Act:
		result = SymbolMultisigView(multisig, Network.TESTNET).to_dict()

		# Assert:
		self.assertEqual(2147483647, result['minApproval'])
		self.assertEqual(0, result['minRemoval'])
