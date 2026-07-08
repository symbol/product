def int_or_none(value):
	"""Converts an optional value to an int."""
	return int(value) if value is not None else None


def bytes_from_hex_or_none(value):
	"""Converts an optional hex string to bytes."""
	return bytes.fromhex(value) if value else None
