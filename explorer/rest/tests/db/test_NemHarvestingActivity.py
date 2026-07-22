import unittest

from rest.db.NemHarvestingActivity import HARVESTING_ACTIVE_WINDOW_BLOCKS, harvesting_active_cutoff_height, harvesting_active_window_blocks


class NemHarvestingActivityTest(unittest.TestCase):
	def test_can_convert_window_to_blocks_for_nem_block_time(self):
		# Assert: 7 days at one block per minute
		self.assertEqual(10080, HARVESTING_ACTIVE_WINDOW_BLOCKS)

	def test_can_convert_window_to_blocks_for_arbitrary_block_time(self):
		# Assert:
		self.assertEqual(604, harvesting_active_window_blocks(1000))

	def test_cutoff_height_spans_exactly_the_window(self):
		# Act:
		cutoff_height = harvesting_active_cutoff_height(100000, HARVESTING_ACTIVE_WINDOW_BLOCKS)

		# Assert: the tip and the cutoff are both inside the window
		self.assertEqual(89921, cutoff_height)
		self.assertEqual(HARVESTING_ACTIVE_WINDOW_BLOCKS, 100000 - cutoff_height + 1)

	def test_cutoff_height_is_clamped_for_chains_shorter_than_the_window(self):
		# Assert:
		self.assertEqual(1, harvesting_active_cutoff_height(1, HARVESTING_ACTIVE_WINDOW_BLOCKS))
		self.assertEqual(1, harvesting_active_cutoff_height(500, HARVESTING_ACTIVE_WINDOW_BLOCKS))

	def test_cutoff_height_is_clamped_for_empty_chain(self):
		# Assert:
		self.assertEqual(1, harvesting_active_cutoff_height(0, HARVESTING_ACTIVE_WINDOW_BLOCKS))
		self.assertEqual(1, harvesting_active_cutoff_height(None, HARVESTING_ACTIVE_WINDOW_BLOCKS))
