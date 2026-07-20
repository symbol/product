from symbolchain.symbol.IdGenerator import is_mosaic_alias


def is_alias_mosaic_id(mosaic_id_hex):
	"""Returns whether a mosaic id encodes a namespace alias."""

	return is_mosaic_alias(int(mosaic_id_hex, 16))


def select_resolution_entry(resolution_entries, primary_id, secondary_id):
	"""Selects the resolution value applicable to a transaction source.

	This ports the source ordering and selection from the current official
	``symbol/symbol`` REST/Rosetta implementation.
	"""

	transaction_source = (primary_id, secondary_id)
	for entry in reversed(resolution_entries):
		entry_source = (
			int(entry['source']['primaryId']),
			int(entry['source']['secondaryId'])
		)
		if entry_source <= transaction_source:
			return entry['resolved']

	return None
