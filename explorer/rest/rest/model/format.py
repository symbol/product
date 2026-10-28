from datetime import timezone


def format_timestamp(timestamp):
	"""Format a timestamp as UTC `YYYY-MM-DD HH:mm:ss`.

	Normalize timezone-aware values to UTC. Treat naive values as UTC when the
	stored value represents UTC. Truncate fractional seconds and return None
	unchanged.
	"""

	if timestamp is None:
		return None

	if timestamp.utcoffset() is None:
		timestamp = timestamp.replace(tzinfo=timezone.utc)
	else:
		timestamp = timestamp.astimezone(timezone.utc)

	return timestamp.strftime('%Y-%m-%d %H:%M:%S')
