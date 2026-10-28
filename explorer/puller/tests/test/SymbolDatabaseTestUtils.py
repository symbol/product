def fetch_full_block_state(database):
	cursor = database.connection.cursor()
	cursor.execute('SELECT * FROM symbol_blocks ORDER BY height')
	return [
		tuple(bytes(value) if isinstance(value, memoryview) else value for value in row)
		for row in cursor.fetchall()
	]


def normalize_sync_state(sync_state):
	"""Returns a sync-state copy with PostgreSQL bytea hashes normalized to bytes."""
	return {
		**sync_state,
		'finalized_hash': bytes(sync_state['finalized_hash']) if sync_state['finalized_hash'] is not None else None,
		'last_synced_block_hash': bytes(sync_state['last_synced_block_hash'])
		if sync_state['last_synced_block_hash'] is not None else None
	}


def fetch_normalized_sync_state(database):
	sync_state = database.get_sync_state()
	if sync_state is None:
		return None

	return normalize_sync_state(sync_state)
