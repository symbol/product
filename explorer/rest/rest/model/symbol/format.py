from datetime import timezone
from decimal import Decimal


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


def to_hex_or_none(value):
	return value.hex().upper() if value else None


def to_hex(value):
	return value.hex().upper()


def str_or_none(value):
	return str(value) if value is not None else None


def format_amount(amount, divisibility):
	"""Formats a relative mosaic amount using the explicit mosaic divisibility."""

	return float(Decimal(amount) / (Decimal(10) ** divisibility))
