from copy import deepcopy
from unittest import TestCase

from symbolchain.sc import MosaicFlags

from puller.model.symbol.Mosaic import create_mosaic_row
from tests.test.SymbolMosaicTestUtils import create_expected_mosaic_row, create_mosaic_item


class MosaicTest(TestCase):
	def _assert_create_mosaic_row_decomposes_flags(
		self,
		flags,
		expected_supply_mutable,
		expected_transferable,
		expected_restrictable,
		expected_revokable
	):
		# Arrange:
		item = create_mosaic_item(flags=flags)
		expected = (flags, expected_supply_mutable, expected_transferable, expected_restrictable, expected_revokable)

		# Act:
		row = create_mosaic_row(item, 123)

		# Assert:
		self.assertEqual(expected, (
			row['flags'],
			row['supply_mutable'],
			row['transferable'],
			row['restrictable'],
			row['revokable']
		))

	def test_create_mosaic_row_sets_all_booleans_false_when_flags_are_not_set(self):
		self._assert_create_mosaic_row_decomposes_flags(0, False, False, False, False)

	def test_create_mosaic_row_sets_only_supply_mutable_when_supply_mutable_flag_is_set(self):
		self._assert_create_mosaic_row_decomposes_flags(MosaicFlags.SUPPLY_MUTABLE.value, True, False, False, False)

	def test_create_mosaic_row_sets_only_transferable_when_transferable_flag_is_set(self):
		self._assert_create_mosaic_row_decomposes_flags(MosaicFlags.TRANSFERABLE.value, False, True, False, False)

	def test_create_mosaic_row_sets_only_restrictable_when_restrictable_flag_is_set(self):
		self._assert_create_mosaic_row_decomposes_flags(MosaicFlags.RESTRICTABLE.value, False, False, True, False)

	def test_create_mosaic_row_sets_only_revokable_when_revokable_flag_is_set(self):
		self._assert_create_mosaic_row_decomposes_flags(MosaicFlags.REVOKABLE.value, False, False, False, True)

	def test_create_mosaic_row_sets_all_booleans_when_all_flags_are_set(self):
		all_flags = 0
		all_flags |= MosaicFlags.SUPPLY_MUTABLE.value
		all_flags |= MosaicFlags.TRANSFERABLE.value
		all_flags |= MosaicFlags.RESTRICTABLE.value
		all_flags |= MosaicFlags.REVOKABLE.value
		self._assert_create_mosaic_row_decomposes_flags(all_flags, True, True, True, True)

	def test_create_mosaic_row_normalizes_unlimited_duration(self):
		# Arrange:
		item = create_mosaic_item()

		# Act:
		row = create_mosaic_row(item, 123)

		# Assert:
		self.assertEqual(create_expected_mosaic_row(item, 123), row)

	def test_create_mosaic_row_retains_unmodified_raw_payload(self):
		# Arrange:
		item = create_mosaic_item(item_id='A1B2C3D4E5F6071829304A5B')
		expected = create_expected_mosaic_row(deepcopy(item), 123)

		# Act:
		row = create_mosaic_row(item, 123)

		# Assert:
		self.assertEqual(expected, row)

	def test_create_mosaic_row_calculates_finite_expiration_height(self):
		# Arrange:
		item = create_mosaic_item(start_height='412', duration='7')

		# Act:
		row = create_mosaic_row(item, 123)

		# Assert:
		self.assertEqual(create_expected_mosaic_row(item, 123, expiration_height=419), row)

	def test_create_mosaic_row_raises_key_error_when_supply_is_missing(self):
		# Arrange:
		item = create_mosaic_item()
		del item['mosaic']['supply']

		# Act / Assert:
		with self.assertRaises(KeyError):
			create_mosaic_row(item, 123)

	def test_create_mosaic_row_raises_value_error_when_owner_address_is_malformed(self):
		# Arrange:
		item = create_mosaic_item(owner_address='not-hex')

		# Act / Assert:
		with self.assertRaises(ValueError):
			create_mosaic_row(item, 123)

	def test_create_mosaic_row_raises_value_error_when_duration_is_malformed(self):
		# Arrange:
		item = create_mosaic_item(duration='not-a-number')

		# Act / Assert:
		with self.assertRaises(ValueError):
			create_mosaic_row(item, 123)

	def test_create_mosaic_row_decomposes_combined_flags(self):
		# Arrange:
		combined_flags = MosaicFlags.SUPPLY_MUTABLE.value | MosaicFlags.REVOKABLE.value
		item = create_mosaic_item(flags=combined_flags)

		# Act:
		row = create_mosaic_row(item, 123)

		# Assert:
		self.assertEqual({
			'mosaic_id': item['mosaic']['id'],
			'owner_address': bytes.fromhex(item['mosaic']['ownerAddress']),
			'start_height': 1,
			'duration': 0,
			'expiration_height': None,
			'supply': 8359527600677922,
			'divisibility': 6,
			'flags': combined_flags,
			'supply_mutable': True,
			'transferable': False,
			'restrictable': False,
			'revokable': True,
			'raw_payload': item,
			'updated_at_height': 123
		}, row)
