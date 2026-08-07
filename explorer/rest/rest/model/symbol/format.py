from decimal import Decimal

from symbolchain.symbol.Network import Address


def format_timestamp(timestamp):
	return timestamp.strftime('%Y-%m-%dT%H:%M:%SZ')


def to_hex_or_none(value):
	return value.hex().upper() if value else None


def to_hex(value):
	return value.hex().upper()


def str_or_none(value):
	return str(value) if value is not None else None


def format_amount(amount, divisibility):
	"""Formats an absolute amount using the supplied mosaic divisibility."""

	return float(Decimal(amount) / (Decimal(10) ** divisibility))


def format_address(address):
	"""Formats a persisted Symbol address byte sequence as canonical text."""

	if address is None:
		return None

	return str(Address(bytes(address)))


def format_hex_id(identifier):
	"""Formats a persisted or textual Symbol identifier as uppercase hexadecimal."""

	if identifier is None:
		return None

	return identifier.upper()
