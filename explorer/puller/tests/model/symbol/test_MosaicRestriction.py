from unittest import TestCase

from symbolchain.sc import MosaicRestrictionType

from puller.model.symbol.MosaicRestriction import (
	MosaicRestrictionEntryType,
	create_mosaic_restriction_key,
	create_mosaic_restriction_row,
	mosaic_restriction_entry_type_from_enum_value,
	mosaic_restriction_entry_type_label,
	mosaic_restriction_entry_type_to_enum_value
)
from tests.test.SymbolTestConstants import RECIPIENT_ADDRESS

MOSAIC_ID = '72c0212e67a08bce'
COMPOSITE_HASH = 'AA' * 32


def create_restriction_item(entry_type=0, wrapper_overrides=None, **overrides):
	entry = {
		'version': 1,
		'compositeHash': COMPOSITE_HASH,
		'entryType': entry_type,
		'mosaicId': MOSAIC_ID,
		'restrictions': [{'key': '1', 'value': '2'}]
	}
	if entry_type == 0:
		entry['targetAddress'] = RECIPIENT_ADDRESS
	else:
		entry['restrictions'] = [{
			'key': '1',
			'restriction': {
				'referenceMosaicId': '0000000000000000',
				'restrictionValue': '2',
				'restrictionType': 1
			}
		}]
	entry.update(overrides)
	item = {'id': 'BB' * 12, 'mosaicRestrictionEntry': entry}
	item.update(wrapper_overrides or {})
	return item


class MosaicRestrictionModelTest(TestCase):  # pylint: disable=too-many-public-methods
	def _assert_model_rejects(self, item):
		# Arrange:
		observed_height = 1

		# Act / Assert:
		with self.assertRaises(ValueError):
			create_mosaic_restriction_row(item, observed_height)

	def _assert_entry_type_rejects(self, value):
		# Arrange:
		invalid_entry_type = value

		# Act / Assert:
		with self.assertRaises(ValueError):
			mosaic_restriction_entry_type_from_enum_value(invalid_entry_type)

	def _assert_key_rejects(self, entry_type, mosaic_id, target_address):
		# Arrange:
		invalid_key = (entry_type, mosaic_id, target_address)

		# Act / Assert:
		with self.assertRaises(ValueError):
			create_mosaic_restriction_key(*invalid_key)

	def test_address_enum_member_and_value_are_exact(self):
		# Arrange:
		expected = 'address'

		# Act:
		actual = MosaicRestrictionEntryType.ADDRESS.value

		# Assert:
		self.assertEqual(expected, actual)

	def test_global_enum_member_and_value_are_exact(self):
		# Arrange:
		expected = 'global'

		# Act:
		actual = MosaicRestrictionEntryType.GLOBAL.value

		# Assert:
		self.assertEqual(expected, actual)

	def test_enum_zero_maps_to_address(self):
		# Arrange:
		expected = MosaicRestrictionEntryType.ADDRESS

		# Act:
		actual = mosaic_restriction_entry_type_from_enum_value(0)

		# Assert:
		self.assertEqual(expected, actual)

	def test_enum_one_maps_to_global(self):
		# Arrange:
		expected = MosaicRestrictionEntryType.GLOBAL

		# Act:
		actual = mosaic_restriction_entry_type_from_enum_value(1)

		# Assert:
		self.assertEqual(expected, actual)

	def test_address_maps_to_enum_zero(self):
		# Arrange:
		expected = 0

		# Act:
		actual = mosaic_restriction_entry_type_to_enum_value(MosaicRestrictionEntryType.ADDRESS)

		# Assert:
		self.assertEqual(expected, actual)

	def test_global_maps_to_enum_one(self):
		# Arrange:
		expected = 1

		# Act:
		actual = mosaic_restriction_entry_type_to_enum_value(MosaicRestrictionEntryType.GLOBAL)

		# Assert:
		self.assertEqual(expected, actual)

	def test_address_maps_to_database_label(self):
		# Arrange:
		expected = 'address'

		# Act:
		actual = mosaic_restriction_entry_type_label(MosaicRestrictionEntryType.ADDRESS)

		# Assert:
		self.assertEqual(expected, actual)

	def test_global_maps_to_database_label(self):
		# Arrange:
		expected = 'global'

		# Act:
		actual = mosaic_restriction_entry_type_label(MosaicRestrictionEntryType.GLOBAL)

		# Assert:
		self.assertEqual(expected, actual)

	def test_entry_type_rejects_booleans(self):
		for value in (True, False):
			with self.subTest(value=value):
				self._assert_entry_type_rejects(value)

	def test_entry_type_rejects_numeric_string(self):
		self._assert_entry_type_rejects('0')

	def test_entry_type_rejects_unknown_integer(self):
		self._assert_entry_type_rejects(2)

	def test_entry_type_to_enum_value_rejects_invalid_local_value(self):
		# Arrange:
		invalid_value = 'address'

		# Act / Assert:
		with self.assertRaises(ValueError):
			mosaic_restriction_entry_type_to_enum_value(invalid_value)

	def test_entry_type_label_rejects_invalid_local_value(self):
		# Arrange:
		invalid_value = 'global'

		# Act / Assert:
		with self.assertRaises(ValueError):
			mosaic_restriction_entry_type_label(invalid_value)

	def test_key_rejects_invalid_entry_type(self):
		self._assert_key_rejects('address', '72C0212E67A08BCE', None)

	def test_global_key_rejects_invalid_mosaic_id(self):
		self._assert_key_rejects(MosaicRestrictionEntryType.GLOBAL, 'not-a-mosaic-id', None)

	def test_global_key_rejects_non_null_target(self):
		self._assert_key_rejects(MosaicRestrictionEntryType.GLOBAL, '72C0212E67A08BCE', bytes(24))

	def test_address_key_rejects_non_bytes_target(self):
		self._assert_key_rejects(MosaicRestrictionEntryType.ADDRESS, '72C0212E67A08BCE', 'not-bytes')

	def test_key_rejects_empty_address(self):
		self._assert_key_rejects(MosaicRestrictionEntryType.ADDRESS, '72C0212E67A08BCE', b'')

	def test_key_rejects_alias_address(self):
		self._assert_key_rejects(
			MosaicRestrictionEntryType.ADDRESS,
			'72C0212E67A08BCE',
			bytes([1]) + bytes(23))

	def test_global_key_rejects_alias_mosaic_id(self):
		self._assert_key_rejects(MosaicRestrictionEntryType.GLOBAL, 'E74B99BA41F4AFEE', None)

	def test_address_row_preserves_every_persisted_field(self):
		# Arrange:
		item = create_restriction_item(
			wrapper_overrides={'wrapperUnknown': 'wrapper'},
			entryUnknown='entry')

		# Act:
		row = create_mosaic_restriction_row(item, 12)

		# Assert:
		self.assertEqual({
			'composite_hash': bytes.fromhex(COMPOSITE_HASH),
			'entry_type': MosaicRestrictionEntryType.ADDRESS,
			'mosaic_id': '72C0212E67A08BCE',
			'target_address': bytes.fromhex(RECIPIENT_ADDRESS),
			'restrictions': [{'key': '1', 'value': '2'}],
			'raw_payload': item,
			'updated_at_height': 12
		}, row)

	def test_address_row_preserves_unknown_fields_at_all_wire_levels(self):
		# Arrange:
		item = create_restriction_item(
			wrapper_overrides={'wrapperUnknown': 'wrapper'},
			entryUnknown='entry',
			restrictions=[{'key': '1', 'value': '2', 'itemUnknown': 'item'}])

		# Act:
		row = create_mosaic_restriction_row(item, 12)

		# Assert:
		self.assertEqual(item, row['raw_payload'])
		self.assertEqual([{'key': '1', 'value': '2', 'itemUnknown': 'item'}], row['restrictions'])

	def test_global_row_preserves_every_persisted_field(self):
		# Arrange:
		item = create_restriction_item(
			1,
			wrapper_overrides={'wrapperUnknown': 'wrapper'},
			entryUnknown='entry',
			restrictions=[{
				'key': '1',
				'itemUnknown': 'item',
				'restriction': {
					'referenceMosaicId': '0000000000000000',
					'restrictionValue': '2',
					'restrictionType': 1,
					'nestedUnknown': 'nested'
				}
			}])

		# Act:
		row = create_mosaic_restriction_row(item, 13)

		# Assert:
		self.assertEqual({
			'composite_hash': bytes.fromhex(COMPOSITE_HASH),
			'entry_type': MosaicRestrictionEntryType.GLOBAL,
			'mosaic_id': '72C0212E67A08BCE',
			'target_address': None,
			'restrictions': [{
				'key': '1',
				'itemUnknown': 'item',
				'restriction': {
					'referenceMosaicId': '0000000000000000',
					'restrictionValue': '2',
					'restrictionType': 1,
					'nestedUnknown': 'nested'
				}
			}],
			'raw_payload': item,
			'updated_at_height': 13
		}, row)

	def test_empty_restrictions_is_a_present_row(self):
		# Arrange:
		item = create_restriction_item(restrictions=[])

		# Act:
		row = create_mosaic_restriction_row(item, 14)

		# Assert:
		self.assertEqual([], row['restrictions'])

	def test_model_rejects_alias_shaped_top_level_mosaic_id(self):
		# Arrange:
		item = create_restriction_item(mosaicId='E74B99BA41F4AFEE')

		# Act + Assert:
		with self.assertRaises(ValueError):
			create_mosaic_restriction_row(item, 1)

	def test_model_rejects_non_integer_version(self):
		# Arrange:
		item = create_restriction_item(version='1')

		# Act + Assert:
		with self.assertRaises(ValueError):
			create_mosaic_restriction_row(item, 1)

	def test_model_rejects_boolean_version(self):
		for value in (True, False):
			with self.subTest(value=value):
				self._assert_model_rejects(create_restriction_item(version=value))

	def test_model_rejects_boolean_entry_type(self):
		for value in (True, False):
			with self.subTest(value=value):
				self._assert_model_rejects(create_restriction_item(entryType=value))

	def test_model_rejects_numeric_string_entry_type(self):
		self._assert_model_rejects(create_restriction_item(entryType='0'))

	def test_model_rejects_unknown_entry_type(self):
		self._assert_model_rejects(create_restriction_item(entryType=2))

	def test_model_rejects_non_dict_outer_wrapper(self):
		self._assert_model_rejects([])

	def test_model_rejects_missing_inner_entry(self):
		self._assert_model_rejects({})

	def test_model_rejects_non_dict_inner_entry(self):
		self._assert_model_rejects({'id': 'BB' * 12, 'mosaicRestrictionEntry': []})

	def test_model_rejects_missing_id(self):
		item = create_restriction_item()
		del item['id']
		self._assert_model_rejects(item)

	def test_model_rejects_non_string_id(self):
		item = create_restriction_item()
		item['id'] = 1
		self._assert_model_rejects(item)

	def test_model_rejects_id_with_invalid_length(self):
		item = create_restriction_item()
		item['id'] = 'BB' * 11
		self._assert_model_rejects(item)

	def test_model_rejects_id_with_non_hex_text(self):
		item = create_restriction_item()
		item['id'] = 'GG' * 12
		self._assert_model_rejects(item)

	def test_model_rejects_missing_version(self):
		item = create_restriction_item()
		del item['mosaicRestrictionEntry']['version']
		self._assert_model_rejects(item)

	def test_model_rejects_invalid_composite_hash(self):
		self._assert_model_rejects(create_restriction_item(compositeHash='invalid'))

	def test_model_rejects_non_list_restrictions(self):
		self._assert_model_rejects(create_restriction_item(restrictions='not-a-list'))

	def test_model_rejects_non_hex_top_level_mosaic_id(self):
		self._assert_model_rejects(create_restriction_item(mosaicId='G' * 16))

	def test_model_rejects_alias_shaped_address_target(self):
		alias_address = (bytes([1]) + bytes(23)).hex().upper()
		self._assert_model_rejects(create_restriction_item(targetAddress=alias_address))

	def test_model_rejects_global_target_address(self):
		self._assert_model_rejects(create_restriction_item(1, targetAddress=RECIPIENT_ADDRESS))

	def test_model_rejects_alias_shaped_global_reference_mosaic_id(self):
		item = create_restriction_item(1)
		item['mosaicRestrictionEntry']['restrictions'][0]['restriction']['referenceMosaicId'] = 'E74B99BA41F4AFEE'
		self._assert_model_rejects(item)

	def test_model_rejects_non_dict_address_restriction_item(self):
		self._assert_model_rejects(create_restriction_item(restrictions=[[]]))

	def test_model_rejects_missing_address_restriction_key(self):
		self._assert_model_rejects(create_restriction_item(restrictions=[{'value': '1'}]))

	def test_model_rejects_non_decimal_address_restriction_key(self):
		self._assert_model_rejects(create_restriction_item(restrictions=[{'key': 'x', 'value': '1'}]))

	def test_model_accepts_maximum_non_sentinel_address_restriction_value(self):
		# Arrange:
		item = create_restriction_item(restrictions=[{
			'key': '0', 'value': '18446744073709551614'}])

		# Act:
		row = create_mosaic_restriction_row(item, 1)

		# Assert:
		self.assertEqual([{'key': '0', 'value': '18446744073709551614'}], row['restrictions'])

	def test_model_rejects_address_restriction_value_removal_sentinel(self):
		# Arrange:
		item = create_restriction_item(restrictions=[{
			'key': '0', 'value': '18446744073709551615'}])

		# Act / Assert:
		with self.assertRaisesRegex(ValueError, '^Invalid Symbol address mosaic restriction value$'):
			create_mosaic_restriction_row(item, 1)

	def test_model_rejects_leading_zero_address_restriction_value_removal_sentinel(self):
		# Arrange:
		item = create_restriction_item(restrictions=[{
			'key': '0', 'value': '00018446744073709551615'}])

		# Act / Assert:
		with self.assertRaisesRegex(ValueError, '^Invalid Symbol address mosaic restriction value$'):
			create_mosaic_restriction_row(item, 1)

	def test_model_accepts_maximum_address_restriction_key(self):
		# Arrange:
		item = create_restriction_item(restrictions=[{
			'key': '18446744073709551615', 'value': '0'}])

		# Act:
		row = create_mosaic_restriction_row(item, 1)

		# Assert:
		self.assertEqual([{'key': '18446744073709551615', 'value': '0'}], row['restrictions'])

	def test_model_accepts_zero_address_restriction_key_and_value(self):
		# Arrange:
		item = create_restriction_item(restrictions=[{'key': '0', 'value': '0'}])

		# Act:
		row = create_mosaic_restriction_row(item, 1)

		# Assert:
		self.assertEqual([{'key': '0', 'value': '0'}], row['restrictions'])

	def test_model_rejects_out_of_range_address_restriction_value(self):
		self._assert_model_rejects(
			create_restriction_item(restrictions=[{'key': '1', 'value': '18446744073709551616'}]))

	def test_model_rejects_missing_address_restriction_value(self):
		self._assert_model_rejects(create_restriction_item(restrictions=[{'key': '1'}]))

	def test_model_rejects_non_decimal_address_restriction_value(self):
		self._assert_model_rejects(create_restriction_item(restrictions=[{'key': '1', 'value': 'x'}]))

	def test_model_rejects_out_of_range_address_restriction_key(self):
		self._assert_model_rejects(create_restriction_item(restrictions=[{
			'key': '18446744073709551616', 'value': '1'}]))

	def test_model_rejects_non_dict_global_restriction_item(self):
		self._assert_model_rejects(create_restriction_item(1, restrictions=[[]]))

	def test_model_rejects_missing_global_restriction_key(self):
		self._assert_model_rejects(create_restriction_item(1, restrictions=[{'restriction': {}}]))

	def test_model_rejects_non_decimal_global_restriction_key(self):
		self._assert_model_rejects(create_restriction_item(1, restrictions=[{
			'key': 'x', 'restriction': {}}]))

	def test_model_rejects_out_of_range_global_restriction_key(self):
		self._assert_model_rejects(create_restriction_item(1, restrictions=[{
			'key': '18446744073709551616', 'restriction': {}}]))

	def test_model_accepts_maximum_global_restriction_key(self):
		# Arrange:
		item = create_restriction_item(1, restrictions=[{
			'key': '18446744073709551615',
			'restriction': {
				'referenceMosaicId': '0000000000000000',
				'restrictionValue': '0',
				'restrictionType': 1
			}}])

		# Act:
		row = create_mosaic_restriction_row(item, 1)

		# Assert:
		self.assertEqual('18446744073709551615', row['restrictions'][0]['key'])

	def test_model_accepts_maximum_global_restriction_value(self):
		# Arrange:
		item = create_restriction_item(1, restrictions=[{
			'key': '0',
			'restriction': {
				'referenceMosaicId': '0000000000000000',
				'restrictionValue': '18446744073709551615',
				'restrictionType': 1
			}}])

		# Act:
		row = create_mosaic_restriction_row(item, 1)

		# Assert:
		self.assertEqual('18446744073709551615', row['restrictions'][0]['restriction']['restrictionValue'])

	def test_model_rejects_missing_nested_restriction(self):
		self._assert_model_rejects(create_restriction_item(1, restrictions=[{'key': '1'}]))

	def test_model_rejects_missing_nested_restriction_type(self):
		item = create_restriction_item(1)
		del item['mosaicRestrictionEntry']['restrictions'][0]['restriction']['restrictionType']
		self._assert_model_rejects(item)

	def test_model_rejects_missing_reference_mosaic_id(self):
		item = create_restriction_item(1)
		del item['mosaicRestrictionEntry']['restrictions'][0]['restriction']['referenceMosaicId']
		self._assert_model_rejects(item)

	def test_model_rejects_non_dict_nested_restriction(self):
		self._assert_model_rejects(create_restriction_item(1, restrictions=[{
			'key': '1', 'restriction': []}]))

	def test_model_rejects_invalid_reference_mosaic_id(self):
		self._assert_model_rejects(create_restriction_item(1, restrictions=[{
			'key': '1', 'restriction': {'referenceMosaicId': 'invalid'}}]))

	def test_model_rejects_non_decimal_global_restriction_value(self):
		self._assert_model_rejects(create_restriction_item(1, restrictions=[{
			'key': '1', 'restriction': {
				'referenceMosaicId': '0000000000000000', 'restrictionValue': 'x', 'restrictionType': 1
			}}]))

	def test_model_rejects_missing_global_restriction_value(self):
		self._assert_model_rejects(create_restriction_item(1, restrictions=[{
			'key': '1', 'restriction': {
				'referenceMosaicId': '0000000000000000', 'restrictionType': 1
			}}]))

	def test_model_rejects_out_of_range_global_restriction_value(self):
		self._assert_model_rejects(create_restriction_item(1, restrictions=[{
			'key': '1', 'restriction': {
				'referenceMosaicId': '0000000000000000',
				'restrictionValue': '18446744073709551616',
				'restrictionType': 1
			}}]))

	def test_model_rejects_boolean_global_restriction_type(self):
		for value in (True, False):
			with self.subTest(value=value):
				item = create_restriction_item(1)
				item['mosaicRestrictionEntry']['restrictions'][0]['restriction']['restrictionType'] = value
				self._assert_model_rejects(item)

	def test_model_rejects_global_restriction_type_deletion_marker(self):
		# Arrange:
		item = create_restriction_item(1)
		item['mosaicRestrictionEntry']['restrictions'][0]['restriction']['restrictionType'] = MosaicRestrictionType.NONE.value

		# Act / Assert:
		with self.assertRaisesRegex(ValueError, '^Invalid Symbol global mosaic restriction restrictionType$'):
			create_mosaic_restriction_row(item, 1)

	def test_model_accepts_all_persisted_global_restriction_types(self):
		for restriction_type in (
			MosaicRestrictionType.EQ,
			MosaicRestrictionType.NE,
			MosaicRestrictionType.LT,
			MosaicRestrictionType.LE,
			MosaicRestrictionType.GT,
			MosaicRestrictionType.GE
		):
			with self.subTest(restriction_type=restriction_type):
				# Arrange:
				item = create_restriction_item(1)
				item['mosaicRestrictionEntry']['restrictions'][0]['restriction']['restrictionType'] = restriction_type.value

				# Act:
				row = create_mosaic_restriction_row(item, 1)

				# Assert:
				self.assertEqual(restriction_type.value, row['restrictions'][0]['restriction']['restrictionType'])

	def test_model_rejects_numeric_string_global_restriction_type(self):
		item = create_restriction_item(1)
		item['mosaicRestrictionEntry']['restrictions'][0]['restriction']['restrictionType'] = '1'
		self._assert_model_rejects(item)

	def test_model_rejects_unknown_global_restriction_type(self):
		item = create_restriction_item(1)
		item['mosaicRestrictionEntry']['restrictions'][0]['restriction']['restrictionType'] = 999
		self._assert_model_rejects(item)
