from datetime import datetime, timezone

from symbolchain.CryptoTypes import PublicKey


def int_or_none(value):
	"""Converts an optional value to an int."""
	return int(value) if value is not None else None


def bytes_from_hex_or_none(value):
	"""Converts an optional hex string to bytes."""
	return bytes.fromhex(value) if value else None


def address_from_public_key(public_key, network):
	"""Derives a Symbol address from raw public key bytes using the given network."""

	return network.public_key_to_address(PublicKey(public_key)).bytes


def camel_case_enum_name(name):
	"""Converts an SDK enum member name (e.g. MOSAIC_DEFINITION) to camelCase."""

	parts = name.lower().split('_')
	return parts[0] + ''.join(part.capitalize() for part in parts[1:])


def label_for_type(labels, type_value, entity_name):
	"""Looks up a label for a Symbol type code, raising ValueError when unsupported."""

	try:
		numeric_type = int(type_value)
	except (TypeError, ValueError) as exception:
		raise ValueError(f'Unsupported Symbol {entity_name} type {type_value}') from exception

	if numeric_type not in labels:
		raise ValueError(f'Unsupported Symbol {entity_name} type {type_value}')

	return labels[numeric_type]


def timestamp_from_network_value(value, epoch_adjustment_seconds):
	"""Converts a raw Symbol network timestamp to a UTC datetime."""

	return datetime.fromtimestamp(epoch_adjustment_seconds + int(value) / 1000, timezone.utc)
