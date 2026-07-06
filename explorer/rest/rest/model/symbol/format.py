from decimal import Decimal

XYM_DIVISIBILITY = 6


def format_timestamp(timestamp):
	return timestamp.strftime('%Y-%m-%dT%H:%M:%SZ')


def to_hex_or_none(value):
	return value.hex().upper() if value else None


def to_hex(value):
	return value.hex().upper()


def str_or_none(value):
	return str(value) if value is not None else None


def format_xym_amount(total_fee):
	return float(Decimal(total_fee) / (Decimal(10) ** XYM_DIVISIBILITY))
