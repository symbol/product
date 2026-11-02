from unittest import TestCase

from rest.db.SymbolDatabaseCommon import bytes_or_none, is_non_public_state, try_get_readable_height


class SymbolDatabaseCommonTest(TestCase):
	def test_bytes_or_none_preserves_null_and_converts_bytes(self):
		# Arrange:
		value = bytearray(b'abc')

		# Act:
		result = bytes_or_none(value)

		# Assert:
		self.assertEqual(b'abc', result)
		self.assertIsNone(bytes_or_none(None))

	def test_try_get_readable_height_applies_dirty_watermark(self):
		# Arrange:
		sync_state = {'status': 'healthy', 'last_synced_height': 10, 'dirty_state_from_height': 6}

		# Act:
		result = try_get_readable_height(sync_state)

		# Assert:
		self.assertEqual(5, result)

	def test_try_get_readable_height_returns_none_for_unreadable_state(self):
		# Arrange:
		sync_state = {'status': 'initialized', 'last_synced_height': 10, 'dirty_state_from_height': None}

		# Act:
		result = try_get_readable_height(sync_state)

		# Assert:
		self.assertIsNone(result)

	def test_is_non_public_state_distinguishes_repairing_and_dirty_states(self):
		# Arrange:
		states = (
			({'status': 'healthy', 'dirty_state_from_height': None}, False),
			({'status': 'healthy', 'dirty_state_from_height': 10}, True),
			({'status': 'repairing', 'dirty_state_from_height': None}, True)
		)

		# Act + Assert:
		for sync_state, expected in states:
			with self.subTest(sync_state=sync_state):
				self.assertEqual(expected, is_non_public_state(sync_state))
