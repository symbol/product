from decimal import Decimal

XYM_DIVISIBILITY = 6


def _format_timestamp(timestamp):
	return timestamp.strftime('%Y-%m-%dT%H:%M:%SZ')


def _hex_or_none(value):
	return value.hex().upper() if value else None


def _hex(value):
	return value.hex().upper()


def _str_or_none(value):
	return str(value) if value is not None else None


def _format_total_fee(total_fee):
	return float(Decimal(total_fee) / (Decimal(10) ** XYM_DIVISIBILITY))
