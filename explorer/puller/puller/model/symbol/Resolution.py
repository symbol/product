from symbolchain.symbol.IdGenerator import is_mosaic_alias


def is_alias_mosaic_id(mosaic_id_hex):
	"""Returns whether a mosaic id encodes a namespace alias."""

	return is_mosaic_alias(int(mosaic_id_hex, 16))


def select_resolution_entry(resolution_entries, primary_id, secondary_id):
	"""Selects the resolution value applicable to a transaction source.

	This ports the official SDK combination of ``Statement.getResolvedFromReceipt``
	and ``ResolutionStatement.getResolutionEntryById``.
	"""

	if 1 == len(resolution_entries):
		return resolution_entries[0]['resolved']

	primary_ids = [
		int(entry['source']['primaryId'])
		for entry in resolution_entries
		if int(entry['source']['primaryId']) <= primary_id
	]
	resolved_primary_id = max(primary_ids, default=0)
	if 0 == resolved_primary_id:
		return None

	entries_at_primary_id = [
		entry
		for entry in resolution_entries
		if resolved_primary_id == int(entry['source']['primaryId'])
	]
	if primary_id > resolved_primary_id:
		return max(entries_at_primary_id, key=lambda entry: int(entry['source']['secondaryId']))['resolved']

	secondary_ids = [
		int(entry['source']['secondaryId'])
		for entry in entries_at_primary_id
		if int(entry['source']['secondaryId']) <= secondary_id
	]
	resolved_secondary_id = max(secondary_ids, default=0)
	if 0 == resolved_secondary_id and 0 != secondary_id:
		previous_primary_ids = [
			int(entry['source']['primaryId'])
			for entry in resolution_entries
			if int(entry['source']['primaryId']) < resolved_primary_id
		]
		previous_primary_id = max(previous_primary_ids, default=0)
		if 0 == previous_primary_id:
			return None

		entries_at_previous_primary_id = [
			entry
			for entry in resolution_entries
			if previous_primary_id == int(entry['source']['primaryId'])
		]
		return max(entries_at_previous_primary_id, key=lambda entry: int(entry['source']['secondaryId']))['resolved']

	selected_entry = next((
		entry
		for entry in entries_at_primary_id
		if resolved_secondary_id == int(entry['source']['secondaryId'])
	), None)
	return selected_entry['resolved'] if selected_entry else None
