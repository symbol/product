import time


def assert_database_connections_closed(connection, application_name):
	"""Wait for named backends to exit without ending the observer's transaction."""
	# Client close does not wait for backend exit; refresh statistics without releasing the reader's locks.
	deadline = time.monotonic() + 5
	with connection.cursor() as cursor:
		while True:
			cursor.execute('SELECT pg_stat_clear_snapshot()')
			cursor.execute(
				'SELECT pid, state FROM pg_stat_activity WHERE datname = current_database() AND application_name = %s',
				(application_name,))
			connections = cursor.fetchall()
			if not connections or time.monotonic() >= deadline:
				break

			time.sleep(0.01)

	assert [] == connections, f'Migration connections remain for {application_name}: {connections}'


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
