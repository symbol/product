from unittest import TestCase

from puller.model.symbol.Resolution import is_alias_mosaic_id, select_resolution_entry


def _entry(primary_id, secondary_id, resolved=None):
	return {
		'source': {'primaryId': primary_id, 'secondaryId': secondary_id},
		'resolved': resolved or f'{primary_id:02X}{secondary_id:02X}'
	}


class ResolutionTest(TestCase):
	def _assert_is_alias_mosaic_id(self, value, expected):
		# Act:
		actual = is_alias_mosaic_id(value)

		# Assert:
		self.assertEqual(expected, actual)

	def _assert_selects_entry(self, entries, primary_id, secondary_id, expected):
		# Act:
		resolved = select_resolution_entry(entries, primary_id, secondary_id)

		# Assert:
		self.assertEqual(expected, resolved)

	def test_select_resolution_entry_returns_none_when_single_entry_source_is_after_transaction(self):
		self._assert_selects_entry([_entry(4, 2)], 1, 0, None)

	def test_select_resolution_entry_returns_single_entry_when_source_is_before_transaction(self):
		self._assert_selects_entry([_entry(1, 0)], 4, 2, '0100')

	def test_select_resolution_entry_returns_last_secondary_entry_from_previous_primary_id(self):
		entries = [_entry(1, 0), _entry(2, 0), _entry(4, 2), _entry(4, 4), _entry(7, 6)]
		self._assert_selects_entry(entries, 5, 0, '0404')

	def test_select_resolution_entry_returns_entry_from_immediately_previous_primary_id(self):
		entries = [_entry(1, 0), _entry(2, 0), _entry(4, 2), _entry(4, 4), _entry(7, 6)]
		self._assert_selects_entry(entries, 3, 0, '0200')

	def test_select_resolution_entry_returns_first_entry_when_source_is_between_first_and_second_secondary_ids(self):
		entries = [_entry(1, 1, 'A'), _entry(1, 4, 'B'), _entry(1, 7, 'C')]
		self._assert_selects_entry(entries, 1, 2, 'A')

	def test_select_resolution_entry_returns_second_entry_when_source_is_between_second_and_third_secondary_ids(self):
		entries = [_entry(1, 1, 'A'), _entry(1, 4, 'B'), _entry(1, 7, 'C')]
		self._assert_selects_entry(entries, 1, 6, 'B')

	def test_select_resolution_entry_returns_last_applicable_entry_when_current_primary_entries_are_after_source(self):
		entries = [_entry(1, 0), _entry(2, 0), _entry(5, 6)]
		self._assert_selects_entry(entries, 5, 3, '0200')

	def test_select_resolution_entry_returns_last_applicable_entry_when_current_primary_has_no_applicable_secondary_id(self):
		entries = [_entry(1, 1, 'A'), _entry(1, 4, 'B'), _entry(1, 7, 'C'), _entry(2, 4, 'D')]
		self._assert_selects_entry(entries, 2, 2, 'C')

	def test_select_resolution_entry_returns_same_primary_entry_with_previous_secondary_id(self):
		entries = [_entry(1, 0, 'A'), _entry(2, 0, 'B'), _entry(2, 4, 'C')]
		self._assert_selects_entry(entries, 2, 2, 'B')

	def test_select_resolution_entry_returns_exact_embedded_source(self):
		entries = [_entry(1, 0), _entry(2, 0), _entry(5, 6)]
		self._assert_selects_entry(entries, 5, 6, '0506')

	def test_select_resolution_entry_returns_none_when_no_primary_id_applies(self):
		self._assert_selects_entry([_entry(2, 0), _entry(5, 6)], 1, 0, None)

	def test_select_resolution_entry_returns_none_when_no_entry_source_is_at_or_before_transaction(self):
		self._assert_selects_entry([_entry(5, 6), _entry(7, 0)], 5, 3, None)

	def test_select_resolution_entry_returns_none_when_same_primary_entries_are_after_transaction(self):
		self._assert_selects_entry([_entry(5, 6), _entry(7, 0)], 5, 0, None)

	def test_is_alias_mosaic_id_returns_true_for_namespace_id(self):
		self._assert_is_alias_mosaic_id('E74B99BA41F4AFEE', True)

	def test_is_alias_mosaic_id_returns_false_for_mosaic_id(self):
		self._assert_is_alias_mosaic_id('72C0212E67A08BCE', False)
