from decimal import Decimal


def format_timestamp(timestamp):
	return timestamp.strftime('%Y-%m-%dT%H:%M:%SZ')


def to_hex_or_none(value):
	return value.hex().upper() if value else None


def to_hex(value):
	return value.hex().upper()


def str_or_none(value):
	return str(value) if value is not None else None


def format_amount(amount, divisibility):
	"""Formats a relative mosaic amount using the explicit mosaic divisibility."""

	return float(Decimal(amount) / (Decimal(10) ** divisibility))
