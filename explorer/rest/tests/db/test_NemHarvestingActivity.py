import unittest

from rest.db.NemHarvestingActivity import (
	DEFAULT_HARVESTING_ACTIVE_WINDOW_BLOCKS,
	harvesting_active_cutoff_height,
	harvesting_active_window_blocks
)


class NemHarvestingActivityTest(unittest.TestCase):
	def test_can_convert_window_to_blocks_for_nem_block_time(self):
		# Assert: 60 days at one block per minute
		self.assertEqual(86400, DEFAULT_HARVESTING_ACTIVE_WINDOW_BLOCKS)

	def test_can_convert_window_to_blocks_for_arbitrary_block_time(self):
		# Assert:
		self.assertEqual(5184, harvesting_active_window_blocks(1000))

	def test_can_convert_window_to_blocks_for_custom_window_days(self):
		# Assert: 14 days at one block per minute
		self.assertEqual(20160, harvesting_active_window_blocks(60, 14))

	def test_cutoff_height_spans_exactly_the_window(self):
		# Act:
		cutoff_height = harvesting_active_cutoff_height(100000, DEFAULT_HARVESTING_ACTIVE_WINDOW_BLOCKS)

		# Assert: the tip and the cutoff are both inside the window
		self.assertEqual(13601, cutoff_height)
		self.assertEqual(DEFAULT_HARVESTING_ACTIVE_WINDOW_BLOCKS, 100000 - cutoff_height + 1)

	def test_cutoff_height_is_clamped_for_chains_shorter_than_the_window(self):
		# Assert:
		self.assertEqual(1, harvesting_active_cutoff_height(1, DEFAULT_HARVESTING_ACTIVE_WINDOW_BLOCKS))
		self.assertEqual(1, harvesting_active_cutoff_height(500, DEFAULT_HARVESTING_ACTIVE_WINDOW_BLOCKS))

	def test_cutoff_height_is_clamped_for_empty_chain(self):
		# Assert:
		self.assertEqual(1, harvesting_active_cutoff_height(0, DEFAULT_HARVESTING_ACTIVE_WINDOW_BLOCKS))
		self.assertEqual(1, harvesting_active_cutoff_height(None, DEFAULT_HARVESTING_ACTIVE_WINDOW_BLOCKS))
