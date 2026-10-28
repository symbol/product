from unittest import TestCase

from .SymbolDatabaseTestUtils import normalize_sync_state


class SymbolDatabaseTestUtilsTest(TestCase):
	def test_normalize_sync_state_converts_hashes_and_preserves_input_and_other_fields(self):
		# Arrange:
		other_field = {'value': [1, 2, 3]}
		sync_state = {
			'status': 'healthy',
			'finalized_hash': memoryview(b'finalized-hash'),
			'finalized_epoch': 12,
			'last_synced_block_hash': memoryview(b'last-block-hash'),
			'dirty_state_from_height': None,
			'other_field': other_field
		}
		original_sync_state = sync_state.copy()

		# Act:
		normalized_sync_state = normalize_sync_state(sync_state)

		# Assert:
		self.assertIs(original_sync_state['finalized_hash'], sync_state['finalized_hash'])
		self.assertIs(original_sync_state['last_synced_block_hash'], sync_state['last_synced_block_hash'])
		self.assertEqual({
			'status': 'healthy',
			'finalized_hash': b'finalized-hash',
			'finalized_epoch': 12,
			'last_synced_block_hash': b'last-block-hash',
			'dirty_state_from_height': None,
			'other_field': other_field
		}, normalized_sync_state)
		self.assertEqual(original_sync_state, sync_state)
		self.assertIsNot(sync_state, normalized_sync_state)
		self.assertIs(other_field, normalized_sync_state['other_field'])

	def test_normalize_sync_state_preserves_none_hashes(self):
		# Arrange:
		sync_state = {
			'finalized_hash': None,
			'last_synced_block_hash': None,
			'other_field': 'preserved'
		}

		# Act:
		normalized_sync_state = normalize_sync_state(sync_state)

		# Assert:
		self.assertEqual(sync_state, normalized_sync_state)
		self.assertIsNot(sync_state, normalized_sync_state)
