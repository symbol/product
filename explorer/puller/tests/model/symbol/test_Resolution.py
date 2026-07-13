from unittest import TestCase

from puller.model.symbol.Resolution import is_alias_mosaic_id, select_resolution_entry


def _entry(primary_id, secondary_id, resolved=None):
	return {
		'source': {'primaryId': primary_id, 'secondaryId': secondary_id},
		'resolved': resolved or f'{primary_id:02X}{secondary_id:02X}'
	}


class ResolutionTest(TestCase):
	def _assert_selects_entry(self, entries, primary_id, secondary_id, expected):
		# Act:
		resolved = select_resolution_entry(entries, primary_id, secondary_id)

		# Assert:
		self.assertEqual(expected, resolved)

	def test_select_resolution_entry_returns_single_entry_without_source_comparison(self):
		self._assert_selects_entry([_entry(4, 2)], 1, 0, '0402')

	def test_select_resolution_entry_returns_last_secondary_entry_from_previous_primary_id(self):
		entries = [_entry(1, 0), _entry(2, 0), _entry(4, 2), _entry(4, 4), _entry(7, 6)]
		self._assert_selects_entry(entries, 5, 0, '0404')

	def test_select_resolution_entry_returns_entry_from_immediately_previous_primary_id(self):
		entries = [_entry(1, 0), _entry(2, 0), _entry(4, 2), _entry(4, 4), _entry(7, 6)]
		self._assert_selects_entry(entries, 3, 0, '0200')

	def test_select_resolution_entry_falls_back_for_embedded_source_before_first_secondary_id(self):
		entries = [_entry(1, 0), _entry(2, 0), _entry(5, 6)]
		self._assert_selects_entry(entries, 5, 3, '0200')

	def test_select_resolution_entry_returns_exact_embedded_source(self):
		entries = [_entry(1, 0), _entry(2, 0), _entry(5, 6)]
		self._assert_selects_entry(entries, 5, 6, '0506')

	def test_select_resolution_entry_returns_none_when_no_primary_id_applies(self):
		self._assert_selects_entry([_entry(2, 0), _entry(5, 6)], 1, 0, None)

	def test_select_resolution_entry_returns_none_when_embedded_fallback_has_no_previous_primary_id(self):
		self._assert_selects_entry([_entry(5, 6), _entry(7, 0)], 5, 3, None)

	def test_select_resolution_entry_returns_none_when_top_level_secondary_entry_is_missing(self):
		self._assert_selects_entry([_entry(5, 6), _entry(7, 0)], 5, 0, None)

	def test_is_alias_mosaic_id_returns_true_for_namespace_id(self):
		self.assertEqual(True, is_alias_mosaic_id('E74B99BA41F4AFEE'))

	def test_is_alias_mosaic_id_returns_false_for_mosaic_id(self):
		self.assertEqual(False, is_alias_mosaic_id('72C0212E67A08BCE'))
