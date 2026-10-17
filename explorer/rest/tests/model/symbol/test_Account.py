import sys
from decimal import Decimal
from unittest import TestCase

from common.symbol.NativeMosaic import NativeMosaicInfo
from symbolchain.symbol.Network import Network

from rest.db.SymbolDatabase import AccountListRecord, AccountRecord, MosaicRecord, MultisigRecord
from rest.model.symbol.Account import SymbolAccountListView, SymbolAccountView
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
			MosaicRecord('1234567890abcdef', 12345, None, None, None, ()),
			MosaicRecord('72c0212e67a08bce', 1234567, '72C0212E67A08BCE', 6, OWNER_ADDRESS, ('xym',))
		),
		'multisig': None
	}
	values.update(overrides)
	return AccountRecord(**values)


def create_account_list_record(**overrides):
	values = {
		'address': ACCOUNT_ADDRESS,
		'public_key': bytes.fromhex('01' * 32),
		'account_type': 'main',
		'importance_percentage': Decimal('0.025'),
		'balance_mosaic_id': NATIVE_MOSAIC_INFO.id,
		'namespaces': ['zeta', 'alpha'],
		'mosaics': (
			MosaicRecord('1234567890ABCDEF', 12345, '1234567890ABCDEF', 2, OTHER_ADDRESS, ('custom',)),
			MosaicRecord(NATIVE_MOSAIC_INFO.id, 1234567, None, None, None, ('xym',))
		)
	}
	values.update(overrides)
	return AccountListRecord(**values)


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
			'minRemoval': None,
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

	def test_to_dict_maps_multisig_relationships_and_thresholds(self):
		# Arrange:
		multisig = MultisigRecord(
			2, 1, [OTHER_ADDRESS, ACCOUNT_ADDRESS, OTHER_ADDRESS], [ACCOUNT_ADDRESS, OTHER_ADDRESS, ACCOUNT_ADDRESS])

		# Act:
		result = SymbolAccountView(
			create_account(multisig=multisig), Network.TESTNET, NATIVE_MOSAIC_INFO).to_dict()

		# Assert:
		self.assertEqual({
			'isMultisig': True,
			'cosignatories': [
				'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI',
				'TD6TLAMJMDD3DC3S6SNFLGH2T5YSUNKNWM7N4VY',
				'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI'],
			'cosignatoryOf': [
				'TD6TLAMJMDD3DC3S6SNFLGH2T5YSUNKNWM7N4VY',
				'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI',
				'TD6TLAMJMDD3DC3S6SNFLGH2T5YSUNKNWM7N4VY'],
			'minCosignatories': 2,
			'minRemoval': 1
		}, {key: result[key] for key in (
			'isMultisig', 'cosignatories', 'cosignatoryOf', 'minCosignatories', 'minRemoval')})

	def test_to_dict_defaults_when_multisig_relationships_are_empty_without_using_thresholds(self):
		# Arrange:
		multisig = MultisigRecord(-1, True, [], [])

		# Act:
		result = SymbolAccountView(
			create_account(multisig=multisig), Network.TESTNET, NATIVE_MOSAIC_INFO).to_dict()

		# Assert:
		self.assertEqual({
			'isMultisig': False,
			'cosignatories': [],
			'cosignatoryOf': [],
			'minCosignatories': 0,
			'minRemoval': None
		}, {key: result[key] for key in (
			'isMultisig', 'cosignatories', 'cosignatoryOf', 'minCosignatories', 'minRemoval')})

	def test_to_dict_rejects_invalid_saved_multisig_values(self):
		# Arrange:
		invalid_records = (
			(MultisigRecord(1, 1, None, []), 'multisig.cosignatory_addresses: value is not an address array'),
			(MultisigRecord(1, 1, [], None), 'multisig.multisig_addresses: value is not an address array'),
			(MultisigRecord(1, 1, (), []), 'multisig.cosignatory_addresses: value is not an address array'),
			(MultisigRecord(1, 1, [], ()), 'multisig.multisig_addresses: value is not an address array'),
			(MultisigRecord(1, 1, [None], []), 'multisig.cosignatory_addresses[0]: value is required'),
			(MultisigRecord(1, 1, [], [None]), 'multisig.multisig_addresses[0]: value is required'),
			(MultisigRecord(1, 1, [b'bad'], []), 'multisig.cosignatory_addresses[0]: invalid byte length'),
			(MultisigRecord(1, 1, [], [MAINNET_ACCOUNT_ADDRESS]), 'multisig.multisig_addresses[0]: invalid address'),
			(MultisigRecord(-1, 1, [ACCOUNT_ADDRESS], []), 'multisig.min_approval: integer is outside the allowed range'),
			(MultisigRecord(1, -1, [ACCOUNT_ADDRESS], []), 'multisig.min_removal: integer is outside the allowed range'),
			(MultisigRecord(2147483648, 1, [ACCOUNT_ADDRESS], []), 'multisig.min_approval: integer is outside the allowed range'),
			(MultisigRecord(1, 2147483648, [ACCOUNT_ADDRESS], []), 'multisig.min_removal: integer is outside the allowed range'))

		# Act + Assert:
		for multisig, expected_message in invalid_records:
			with self.subTest(expected_message=expected_message):
				with self.assertRaises(SymbolDataInvalid) as context:
					SymbolAccountView(
						create_account(multisig=multisig), Network.TESTNET, NATIVE_MOSAIC_INFO).to_dict()
				self.assertEqual(expected_message, str(context.exception))

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
		with self.assertRaises(SymbolDataInvalid) as context:
			SymbolAccountView(
				create_account(address=released_address), Network.TESTNET, NATIVE_MOSAIC_INFO).to_dict()
		self.assertEqual('accounts.address: value is not bytes', str(context.exception))

	def test_to_dict_rejects_saved_address_for_other_network(self):
		# Act + Assert:
		with self.assertRaises(SymbolDataInvalid) as context:
			SymbolAccountView(create_account(), Network.MAINNET, NATIVE_MOSAIC_INFO).to_dict()
		self.assertEqual('accounts.address: invalid address', str(context.exception))

	def test_to_dict_returns_zero_balance_when_native_mosaic_row_is_absent(self):
		# Arrange:
		account = create_account(mosaics=(
			MosaicRecord('1234567890ABCDEF', 12345, None, None, None, ()),))

		# Act:
		result = SymbolAccountView(account, Network.TESTNET, NATIVE_MOSAIC_INFO).to_dict()

		# Assert:
		self.assertEqual(0, result['balance'])
		self.assertEqual(12345.0, result['mosaics'][0]['amount'])

	def test_to_dict_uses_native_divisibility_without_metadata(self):
		# Arrange:
		account = create_account(mosaics=(
			MosaicRecord('72C0212E67A08BCE', 1, None, None, None, ()),))

		# Act:
		result = SymbolAccountView(account, Network.TESTNET, NATIVE_MOSAIC_INFO).to_dict()

		# Assert:
		self.assertEqual(0.000001, result['mosaics'][0]['amount'])
		self.assertIs(False, result['mosaics'][0]['isCreatedByAccount'])

	def test_to_dict_marks_other_mosaic_owner_as_not_created_by_account(self):
		# Arrange:
		account = create_account(mosaics=(
			MosaicRecord('1234567890ABCDEF', 12345, '1234567890ABCDEF', 2, OTHER_ADDRESS, ()),))

		# Act:
		result = SymbolAccountView(account, Network.TESTNET, NATIVE_MOSAIC_INFO).to_dict()

		# Assert:
		self.assertEqual(123.45, result['mosaics'][0]['amount'])
		self.assertIs(False, result['mosaics'][0]['isCreatedByAccount'])

	def test_to_dict_preserves_zero_amount_with_metadata_divisibility(self):
		# Arrange:
		account = create_account(mosaics=(
			MosaicRecord('1234567890ABCDEF', 0, '1234567890ABCDEF', 6, OWNER_ADDRESS, ()),))

		# Act:
		result = SymbolAccountView(account, Network.TESTNET, NATIVE_MOSAIC_INFO).to_dict()

		# Assert:
		self.assertEqual(0, result['balance'])
		self.assertEqual(0.0, result['mosaics'][0]['amount'])

	def test_to_dict_preserves_zero_divisibility_with_nonzero_amount(self):
		# Arrange:
		account = create_account(mosaics=(
			MosaicRecord('1234567890ABCDEF', 123, '1234567890ABCDEF', 0, OWNER_ADDRESS, ()),))

		# Act:
		result = SymbolAccountView(account, Network.TESTNET, NATIVE_MOSAIC_INFO).to_dict()

		# Assert:
		self.assertEqual(123.0, result['mosaics'][0]['amount'])

	def test_to_dict_accepts_maximum_mosaic_divisibility(self):
		# Arrange:
		account = create_account(mosaics=(
			MosaicRecord('1234567890ABCDEF', 1, '1234567890ABCDEF', 255, OWNER_ADDRESS, ()),))

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
			mosaics=(MosaicRecord('0000000000000000', 0, None, None, None, ()),))

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


class SymbolAccountViewMultisigTest(TestCase):
	def test_to_dict_converts_multisig_addresses_for_mainnet(self):
		# Arrange:
		multisig = MultisigRecord(
			1, 1,
			[bytes.fromhex('687585978CADF2186CE5D92576FC849FBF6ECE7B36CF9635')],
			[bytes.fromhex('68F6CB4276B16A349A1C3CD50C3752775AD5D3F2F7299640')])
		account = create_account(address=MAINNET_ACCOUNT_ADDRESS, multisig=multisig, mosaics=())

		# Act:
		result = SymbolAccountView(account, Network.MAINNET, NATIVE_MOSAIC_INFO).to_dict()

		# Assert:
		self.assertEqual({
			'isMultisig': True,
			'cosignatories': ['NB2YLF4MVXZBQ3HF3ESXN7EET67W5TT3G3HZMNI'],
			'cosignatoryOf': ['ND3MWQTWWFVDJGQ4HTKQYN2SO5NNLU7S64UZMQA'],
			'minCosignatories': 1,
			'minRemoval': 1
		}, {key: result[key] for key in (
			'isMultisig', 'cosignatories', 'cosignatoryOf', 'minCosignatories', 'minRemoval')})

	def test_to_dict_maps_multisig_own_only(self):
		# Arrange:
		multisig = MultisigRecord(7, 3, [OTHER_ADDRESS], [])

		# Act:
		result = SymbolAccountView(
			create_account(multisig=multisig), Network.TESTNET, NATIVE_MOSAIC_INFO).to_dict()

		# Assert:
		self.assertEqual({
			'isMultisig': True,
			'cosignatories': ['TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI'],
			'cosignatoryOf': [],
			'minCosignatories': 7,
			'minRemoval': 3
		}, {key: result[key] for key in (
			'isMultisig', 'cosignatories', 'cosignatoryOf', 'minCosignatories', 'minRemoval')})
		self.assertIs(type(result['minRemoval']), int)

	def test_to_dict_accepts_multisig_threshold_integer_bounds(self):
		# Arrange:
		multisig = MultisigRecord(2147483647, 0, [ACCOUNT_ADDRESS], [])

		# Act:
		result = SymbolAccountView(
			create_account(multisig=multisig), Network.TESTNET, NATIVE_MOSAIC_INFO).to_dict()

		# Assert:
		self.assertEqual(2147483647, result['minCosignatories'])
		self.assertEqual(0, result['minRemoval'])

	def test_to_dict_rejects_boolean_multisig_threshold(self):
		# Arrange:
		invalid_records = (
			(MultisigRecord(True, 1, [ACCOUNT_ADDRESS], []), 'multisig.min_approval'),
			(MultisigRecord(1, False, [ACCOUNT_ADDRESS], []), 'multisig.min_removal'))

		# Act + Assert:
		for multisig, field_path in invalid_records:
			with self.subTest(field_path=field_path), self.assertRaises(SymbolDataInvalid) as context:
				SymbolAccountView(
					create_account(multisig=multisig), Network.TESTNET, NATIVE_MOSAIC_INFO).to_dict()
			self.assertEqual(f'{field_path}: value is not an integer', str(context.exception))

	def test_to_dict_does_not_validate_thresholds_without_own_cosignatories(self):
		# Arrange:
		multisig = MultisigRecord(-1, True, [], [OTHER_ADDRESS])

		# Act:
		result = SymbolAccountView(
			create_account(multisig=multisig), Network.TESTNET, NATIVE_MOSAIC_INFO).to_dict()

		# Assert:
		self.assertEqual({
			'isMultisig': False,
			'cosignatories': [],
			'cosignatoryOf': ['TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI'],
			'minCosignatories': 0,
			'minRemoval': None
		}, {key: result[key] for key in (
			'isMultisig', 'cosignatories', 'cosignatoryOf', 'minCosignatories', 'minRemoval')})


class SymbolAccountViewValidationTest(TestCase):

	def test_to_dict_requires_finalized_epoch_with_empty_voting_keys(self):
		# Arrange:
		account = create_account(finalized_epoch=None, voting_public_keys=[])

		# Act + Assert:
		with self.assertRaises(SymbolDataInvalid) as context:
			SymbolAccountView(account, Network.TESTNET, NATIVE_MOSAIC_INFO).to_dict()
		self.assertEqual('sync_state.finalized_epoch: value is required', str(context.exception))

	def test_to_dict_rejects_reversed_voting_epoch(self):
		# Arrange:
		account = create_account(
			voting_public_keys=[{'publicKey': 'ab' * 32, 'startEpoch': 2, 'endEpoch': 1}])

		# Act + Assert:
		with self.assertRaises(SymbolDataInvalid) as context:
			SymbolAccountView(account, Network.TESTNET, NATIVE_MOSAIC_INFO).to_dict()
		self.assertEqual('accounts.voting_public_keys[0].endEpoch: epoch range is reversed', str(context.exception))

	def test_to_dict_rejects_missing_and_null_jsonb_fields_with_field_paths(self):
		# Arrange:
		voting_fields = ('publicKey', 'startEpoch', 'endEpoch')
		activity_fields = ('startHeight', 'totalFeesPaid', 'beneficiaryCount', 'rawScore')
		invalid_values = []
		for field in voting_fields:
			missing_key = {'publicKey': 'AB' * 32, 'startEpoch': 1, 'endEpoch': 1}
			missing_key.pop(field)
			invalid_values.append((create_account(voting_public_keys=[missing_key]), f'accounts.voting_public_keys[0].{field}: value is required'))
			null_key = {'publicKey': 'AB' * 32, 'startEpoch': 1, 'endEpoch': 1}
			null_key[field] = None
			invalid_values.append((create_account(voting_public_keys=[null_key]), f'accounts.voting_public_keys[0].{field}: value is required'))
		for field in activity_fields:
			missing_field = {'startHeight': 0, 'totalFeesPaid': 0, 'beneficiaryCount': 0, 'rawScore': 0}
			missing_field.pop(field)
			invalid_values.append((create_account(activity_buckets=[missing_field]), f'accounts.activity_buckets[0].{field}: value is required'))
			null_field = {'startHeight': 0, 'totalFeesPaid': 0, 'beneficiaryCount': 0, 'rawScore': 0}
			null_field[field] = None
			invalid_values.append((create_account(activity_buckets=[null_field]), f'accounts.activity_buckets[0].{field}: value is required'))

		# Act + Assert:
		for account, field_path in invalid_values:
			with self.subTest(field_path=field_path):
				with self.assertRaises(SymbolDataInvalid) as context:
					SymbolAccountView(account, Network.TESTNET, NATIVE_MOSAIC_INFO).to_dict()
				self.assertEqual(field_path, str(context.exception))

	def test_to_dict_rejects_invalid_importance_ratio(self):
		# Arrange:
		invalid_values = (
			(None, 'accounts.importance_percentage: value is not a finite number'),
			('0.5', 'accounts.importance_percentage: value is not a finite number'),
			(True, 'accounts.importance_percentage: value is not a finite number'),
			(float('nan'), 'accounts.importance_percentage: value is outside the allowed range'),
			(Decimal('NaN'), 'accounts.importance_percentage: value is outside the allowed range'),
			(Decimal('Infinity'), 'accounts.importance_percentage: value is outside the allowed range'),
			(Decimal('-Infinity'), 'accounts.importance_percentage: value is outside the allowed range'),
			(-0.1, 'accounts.importance_percentage: value is outside the allowed range'),
			(1.1, 'accounts.importance_percentage: value is outside the allowed range'))

		# Act + Assert:
		for value, expected_message in invalid_values:
			with self.subTest(value=value), self.assertRaises(SymbolDataInvalid) as context:
				SymbolAccountView(
					create_account(importance_percentage=value), Network.TESTNET, NATIVE_MOSAIC_INFO).to_dict()
			self.assertEqual(expected_message, str(context.exception))

	def test_to_dict_accepts_persisted_integer_upper_bounds(self):
		# Arrange:
		account = create_account(
			address_height=9223372036854775807,
			finalized_epoch=2147483647,
			voting_public_keys=[{
				'publicKey': 'ab' * 32,
				'startEpoch': 1,
				'endEpoch': 1
			}],
			activity_buckets=[{
				'startHeight': '18446744073709551615',
				'totalFeesPaid': '18446744073709551615',
				'beneficiaryCount': '4294967295',
				'rawScore': '18446744073709551615'
			}],
			mosaics=(
				MosaicRecord('1234567890ABCDEF', 1, '1234567890ABCDEF', 255, OWNER_ADDRESS, ()),
				MosaicRecord('72C0212E67A08BCE', 9223372036854775807, None, None, None, ())))

		# Act:
		result = SymbolAccountView(account, Network.TESTNET, NATIVE_MOSAIC_INFO).to_dict()

		# Assert:
		self.assertEqual(9223372036854775807, result['height'])
		self.assertEqual('expired', result['votingKeys'][0]['status'])
		self.assertEqual(1, result['votingKeys'][0]['endEpoch'])
		self.assertEqual(18446744073709551615, result['importanceHistory'][0]['importanceScore'])
		self.assertEqual(18446744073709551615, result['importanceHistory'][0]['recalculationBlock'])
		self.assertIs(type(result['importanceHistory'][0]['recalculationBlock']), int)
		self.assertEqual(4294967295, result['importanceHistory'][0]['beneficiaryCount'])
		self.assertEqual(1e-255, result['mosaics'][0]['amount'])

	def test_to_dict_rejects_persisted_integer_out_of_range_and_wrong_types(self):
		# Arrange:
		invalid_accounts = (
			({'address_height': -1}, 'accounts.address_height: integer is outside the allowed range'),
			({'address_height': True}, 'accounts.address_height: value is not an integer'),
			({'address_height': 1.0}, 'accounts.address_height: value is not an integer'),
			({'address_height': 9223372036854775808}, 'accounts.address_height: integer is outside the allowed range'),
			({'finalized_epoch': -1}, 'sync_state.finalized_epoch: integer is outside the allowed range'),
			({'finalized_epoch': 2147483648}, 'sync_state.finalized_epoch: integer is outside the allowed range'),
			({'finalized_epoch': True}, 'sync_state.finalized_epoch: value is not an integer'),
			({'finalized_epoch': 5.0}, 'sync_state.finalized_epoch: value is not an integer'),
			({'finalized_epoch': '5'}, 'sync_state.finalized_epoch: value is not an integer')
		)

		# Act + Assert:
		for overrides, expected_message in invalid_accounts:
			with self.subTest(overrides=overrides), self.assertRaises(SymbolDataInvalid) as context:
				SymbolAccountView(create_account(**overrides), Network.TESTNET, NATIVE_MOSAIC_INFO).to_dict()
			self.assertEqual(expected_message, str(context.exception))

	def test_to_dict_rejects_integer_conversion_failure(self):
		# Arrange: own the decimal conversion limit instead of relying on the process default.
		if not hasattr(sys, 'get_int_max_str_digits') or not hasattr(sys, 'set_int_max_str_digits'):
			self.skipTest('Python does not support configuring the integer string conversion limit')

		original_limit = sys.get_int_max_str_digits()
		conversion_limit = sys.int_info.str_digits_check_threshold
		try:
			sys.set_int_max_str_digits(conversion_limit)
			long_integer = '9' * (conversion_limit + 1)

			# Act + Assert:
			with self.assertRaises(SymbolDataInvalid) as context:
				SymbolAccountView(
					create_account(voting_public_keys=[{'publicKey': 'ab' * 32, 'startEpoch': long_integer, 'endEpoch': 1}]),
					Network.TESTNET,
					NATIVE_MOSAIC_INFO).to_dict()
			self.assertEqual('accounts.voting_public_keys[0].startEpoch: value is not an integer', str(context.exception))
		finally:
			sys.set_int_max_str_digits(original_limit)

	def test_to_dict_rejects_each_uint64_activity_field_boundary_and_type(self):
		# Arrange:
		activity_fields = ('startHeight', 'totalFeesPaid', 'rawScore')
		invalid_values = (
			(-1, 'integer is outside the allowed range'),
			(18446744073709551616, 'integer is outside the allowed range'),
			(True, 'value is not an integer'),
			(1.0, 'value is not an integer'),
			('1.0', 'value is not an integer'),
			('not-a-number', 'value is not an integer'),
			('', 'value is not an integer'),
			('+1', 'value is not an integer'),
			('-1', 'value is not an integer'),
			(' 1', 'value is not an integer'),
			('1 ', 'value is not an integer'),
			('1e2', 'value is not an integer'),
			('１２', 'value is not an integer'),
			('١٢', 'value is not an integer'))
		invalid_activity = [
			(field, value, reason)
			for field in activity_fields
			for value, reason in invalid_values
		]
		invalid_activity.extend(
			('beneficiaryCount', value, reason)
			for value, reason in (
				(-1, 'integer is outside the allowed range'),
				(4294967296, 'integer is outside the allowed range'),
				(True, 'value is not an integer'),
				(1.0, 'value is not an integer'),
				('not-a-number', 'value is not an integer')))

		# Act + Assert:
		for field, value, reason in invalid_activity:
			with self.subTest(field=field, value=value):
				bucket = {'startHeight': 0, 'totalFeesPaid': 0, 'beneficiaryCount': 0, 'rawScore': 0}
				bucket[field] = value
				with self.assertRaises(SymbolDataInvalid) as context:
					SymbolAccountView(
						create_account(activity_buckets=[bucket]), Network.TESTNET, NATIVE_MOSAIC_INFO).to_dict()
				self.assertEqual(f'accounts.activity_buckets[0].{field}: {reason}', str(context.exception))

	def test_to_dict_rejects_each_voting_epoch_integer_boundary_and_type(self):
		# Arrange:
		invalid_epochs = [
			(field, value, reason)
			for field in ('startEpoch', 'endEpoch')
			for value, reason in (
				(-1, 'integer is outside the allowed range'),
				(0, 'integer is outside the allowed range'),
				(4294967296, 'integer is outside the allowed range'),
				(True, 'value is not an integer'),
				(1.0, 'value is not an integer'),
				('1.0', 'value is not an integer'))
		]

		# Act + Assert:
		for field, value, reason in invalid_epochs:
			with self.subTest(field=field, value=value):
				voting_key = {'publicKey': 'AB' * 32, 'startEpoch': 1, 'endEpoch': 1}
				voting_key[field] = value
				with self.assertRaises(SymbolDataInvalid) as context:
					SymbolAccountView(
						create_account(voting_public_keys=[voting_key]), Network.TESTNET, NATIVE_MOSAIC_INFO).to_dict()
				self.assertEqual(f'accounts.voting_public_keys[0].{field}: {reason}', str(context.exception))

	def test_to_dict_accepts_maximum_voting_epoch_for_both_fields(self):
		# Arrange:
		account = create_account(
			finalized_epoch=2147483647,
			voting_public_keys=[{'publicKey': 'AB' * 32, 'startEpoch': 4294967295, 'endEpoch': 4294967295}])

		# Act:
		result = SymbolAccountView(account, Network.TESTNET, NATIVE_MOSAIC_INFO).to_dict()

		# Assert:
		self.assertEqual(4294967295, result['votingKeys'][0]['startEpoch'])
		self.assertEqual(4294967295, result['votingKeys'][0]['endEpoch'])

	def test_to_dict_rejects_malformed_saved_bytes_arrays_and_keys(self):
		# Arrange:
		invalid_accounts = (
			({'address': None}, 'accounts.address: value is required'),
			({'address': b'bad'}, 'accounts.address: invalid byte length'),
			({'public_key': b'bad'}, 'accounts.public_key: invalid byte length'),
			({'public_key': 32}, 'accounts.public_key: value is not bytes'),
			({'node_public_key': b'bad'}, 'accounts.node_public_key: invalid byte length'),
			({'vrf_public_key': 32}, 'accounts.vrf_public_key: value is not bytes'),
			({'account_type': 'unknown'}, 'accounts.account_type: unknown account type'),
			({'account_type': []}, 'accounts.account_type: unknown account type'),
			({'linked_public_key': b'bad'}, 'accounts.linked_public_key: invalid byte length'),
			({'linked_public_key': 32}, 'accounts.linked_public_key: value is not bytes'),
			({'voting_public_keys': None}, 'accounts.voting_public_keys: value is not an array'),
			({'voting_public_keys': [None]}, 'accounts.voting_public_keys[0].publicKey: value is required'),
			(
				{'voting_public_keys': [{'publicKey': 'ab', 'startEpoch': 1, 'endEpoch': 1}]},
				'accounts.voting_public_keys[0].publicKey: invalid public key'),
			(
				{'voting_public_keys': [{'publicKey': 'gg' * 32, 'startEpoch': 1, 'endEpoch': 1}]},
				'accounts.voting_public_keys[0].publicKey: invalid public key'),
			({'activity_buckets': None}, 'accounts.activity_buckets: value is not an array'),
			({'activity_buckets': [None]}, 'accounts.activity_buckets[0].startHeight: value is required'),
			({'mosaics': None}, 'account_mosaics: value is not an array'),
			({'mosaics': (object(),)}, 'account_mosaics[0]: value is not a mosaic row'),
			({'alias_names': [None]}, 'symbol_alias_names.account: value is not a string array')
		)

		# Act + Assert:
		for overrides, expected_message in invalid_accounts:
			with self.subTest(overrides=overrides), self.assertRaises(SymbolDataInvalid) as context:
				SymbolAccountView(create_account(**overrides), Network.TESTNET, NATIVE_MOSAIC_INFO).to_dict()
			self.assertEqual(expected_message, str(context.exception))

	def test_to_dict_rejects_malformed_mosaic_values(self):
		# Arrange:
		invalid_mosaics = (
			(MosaicRecord('bad', 1, None, None, None, ()), 'account_mosaics.mosaic_id: invalid mosaic id'),
			(MosaicRecord('1234567890ABCDEF', -1, None, None, None, ()), 'account_mosaics[0].amount: integer is outside the allowed range'),
			(
				MosaicRecord('1234567890ABCDEF', 1, 'metadata', -1, OWNER_ADDRESS, ()),
				'account_mosaics[0].divisibility: integer is outside the allowed range'),
			(
				MosaicRecord('1234567890ABCDEF', 1, 'metadata', 256, OWNER_ADDRESS, ()),
				'account_mosaics[0].divisibility: integer is outside the allowed range'),
			(
				MosaicRecord('1234567890ABCDEF', 1, 'metadata', True, OWNER_ADDRESS, ()),
				'account_mosaics[0].divisibility: value is not an integer'),
			(
				MosaicRecord('1234567890ABCDEF', 1, 'metadata', 1.0, OWNER_ADDRESS, ()),
				'account_mosaics[0].divisibility: value is not an integer'),
			(
				MosaicRecord('1234567890ABCDEF', 1, 'metadata', None, OWNER_ADDRESS, ()),
				'account_mosaics[0].divisibility: value is not an integer'),
			(MosaicRecord('1234567890ABCDEF', 1, 'metadata', 1, b'bad', ()), 'account_mosaics[0].owner_address: invalid byte length'),
			(MosaicRecord('1234567890ABCDEF', 1, None, None, None, None), 'account_mosaics[0].alias_names: value is not a string array'),
			(MosaicRecord('1234567890ABCDEF', 1, None, None, None, (None,)), 'account_mosaics[0].alias_names: value is not a string array'),
			(MosaicRecord('1234567890ABCDEF', True, None, None, None, ()), 'account_mosaics[0].amount: value is not an integer'),
			(MosaicRecord('1234567890ABCDEF', 1.0, None, None, None, ()), 'account_mosaics[0].amount: value is not an integer'),
			(
				MosaicRecord('1234567890ABCDEF', 9223372036854775808, None, None, None, ()),
				'account_mosaics[0].amount: integer is outside the allowed range'),
			(MosaicRecord('1234567890ABCDEF', None, None, None, None, ()), 'account_mosaics[0].amount: value is not an integer')
		)

		# Act + Assert:
		for mosaic, expected_message in invalid_mosaics:
			with self.subTest(mosaic=mosaic), self.assertRaises(SymbolDataInvalid) as context:
				SymbolAccountView(
					create_account(mosaics=(mosaic,)), Network.TESTNET, NATIVE_MOSAIC_INFO).to_dict()
			self.assertEqual(expected_message, str(context.exception))


class SymbolAccountListViewTest(TestCase):
	def test_to_dict_returns_exact_snapshot_account_list_dto(self):
		# Arrange:
		view = SymbolAccountListView(create_account_list_record(), Network.TESTNET, NATIVE_MOSAIC_INFO)

		# Act:
		result = view.to_dict()

		# Assert:
		self.assertEqual({
			'address': 'TD6TLAMJMDD3DC3S6SNFLGH2T5YSUNKNWM7N4VY', 'publicKey': '01' * 32,
			'accountType': 'main', 'importance': 0.025, 'balance': 1.234567,
			'namespaces': ['zeta', 'alpha'],
			'mosaics': [
				{'id': '1234567890ABCDEF', 'name': 'custom', 'amount': 123.45, 'isCreatedByAccount': False},
				{'id': '72C0212E67A08BCE', 'name': 'xym', 'amount': 1.234567, 'isCreatedByAccount': False}],
			'description': None, 'isHarvestingActive': False, 'isMultisig': False
		}, result)

	def test_to_dict_uses_selected_custom_mosaic_divisibility_for_balance(self):
		# Arrange:
		account = create_account_list_record(balance_mosaic_id='1234567890ABCDEF')

		# Act:
		result = SymbolAccountListView(account, Network.TESTNET, NATIVE_MOSAIC_INFO).to_dict()

		# Assert:
		self.assertEqual(123.45, result['balance'])

	def test_to_dict_sets_multisig_only_for_saved_cosignatories(self):
		# Arrange:
		participant_only = MultisigRecord(1, 1, [], [OTHER_ADDRESS])
		owner = MultisigRecord(1, 1, [OTHER_ADDRESS], [])

		# Act:
		participant_result = SymbolAccountListView(
			create_account_list_record(multisig=participant_only), Network.TESTNET, NATIVE_MOSAIC_INFO).to_dict()
		owner_result = SymbolAccountListView(
			create_account_list_record(multisig=owner), Network.TESTNET, NATIVE_MOSAIC_INFO).to_dict()

		# Assert:
		self.assertFalse(participant_result['isMultisig'])
		self.assertTrue(owner_result['isMultisig'])

	def test_to_dict_rejects_non_boolean_harvesting_state(self):
		# Arrange:
		account = create_account_list_record(is_harvesting_active=None)

		# Act + Assert:
		with self.assertRaises(SymbolDataInvalid) as context:
			SymbolAccountListView(account, Network.TESTNET, NATIVE_MOSAIC_INFO).to_dict()
		self.assertEqual('accounts.is_harvesting_active: value is not a boolean', str(context.exception))

	def test_to_dict_preserves_nullable_fields_and_zero_when_rows_are_absent(self):
		# Arrange:
		account = create_account_list_record(
			public_key=None, account_type=None, importance_percentage=0,
			namespaces=[], mosaics=())

		# Act:
		result = SymbolAccountListView(account, Network.TESTNET, NATIVE_MOSAIC_INFO).to_dict()

		# Assert:
		self.assertEqual({
			'address': 'TD6TLAMJMDD3DC3S6SNFLGH2T5YSUNKNWM7N4VY', 'publicKey': None, 'accountType': None,
			'importance': 0.0, 'balance': 0, 'namespaces': [], 'mosaics': [], 'description': None,
			'isHarvestingActive': False, 'isMultisig': False
		}, result)
