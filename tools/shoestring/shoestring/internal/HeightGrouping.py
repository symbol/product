def calculate_grouped_height(height, grouping):
	"""
	Calculates the grouped height from the supplied height and grouping
	(the number of blocks that should be treated as a group for calculation purposes).
	"""

	if 0 == grouping:
		raise RuntimeError('grouping must be non-zero')

	previous_height = height - 1
	grouped_height = (previous_height // grouping) * grouping
	return max(1, grouped_height)


def calculate_finalization_epoch_for_height(height, grouping):  # pylint: disable=invalid-name
	"""Calculates the finalization epoch for a height given a grouping."""

	if 0 == height:
		raise RuntimeError('height must be non-zero')

	if 0 == grouping:
		raise RuntimeError('grouping must be non-zero')

	if height <= 1:
		return 1

	adjustment = 0 if 0 == height % grouping else 1
	return 1 + adjustment + height // grouping
