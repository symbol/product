from collections import namedtuple

TransactionMosaicRecord = namedtuple(
	'TransactionMosaicRecord',
	['mosaic_id', 'amount', 'role', 'position', 'divisibility', 'alias_names'])


class SymbolDataUnavailable(RuntimeError):
	"""Raised when Symbol data is not safely readable."""


READABLE_BLOCK_STATUSES = frozenset(['healthy', 'repairing'])


def bytes_or_none(value):
	"""Converts a database byte value to bytes, preserving null values."""

	return bytes(value) if value else None


def is_non_public_state(sync_state):
	"""Returns whether the sync state includes data that must not be exposed."""

	return sync_state['status'] == 'repairing' or sync_state['dirty_state_from_height'] is not None


def try_get_readable_height(sync_state):
	"""Returns the highest safely readable height, or ``None`` when unavailable."""

	if not sync_state or sync_state.get('status') not in READABLE_BLOCK_STATUSES:
		return None

	last_synced_height = sync_state.get('last_synced_height')
	if not isinstance(last_synced_height, int) or last_synced_height < 1:
		return None

	dirty_state_from_height = sync_state.get('dirty_state_from_height')
	if dirty_state_from_height is not None:
		if not isinstance(dirty_state_from_height, int) or dirty_state_from_height < 1:
			return None

		last_synced_height = min(last_synced_height, dirty_state_from_height - 1)

	return last_synced_height if last_synced_height >= 1 else None
