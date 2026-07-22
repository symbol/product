"""Definition of the 'recently harvesting' account window used by the NEM explorer."""

HARVESTING_ACTIVE_WINDOW_DAYS = 7

BLOCK_TARGET_SECONDS = 60

_SECONDS_PER_DAY = 24 * 60 * 60


def harvesting_active_window_blocks(block_target_seconds):
	"""Converts the activity window into a block count for a chain's target block time."""

	return HARVESTING_ACTIVE_WINDOW_DAYS * _SECONDS_PER_DAY // block_target_seconds


HARVESTING_ACTIVE_WINDOW_BLOCKS = harvesting_active_window_blocks(BLOCK_TARGET_SECONDS)


def harvesting_active_cutoff_height(chain_height, window_blocks):
	"""Calculates the inclusive lowest height that still counts as recent harvesting activity."""

	if chain_height is None or 0 >= chain_height:
		return 1

	return max(1, chain_height - window_blocks + 1)
