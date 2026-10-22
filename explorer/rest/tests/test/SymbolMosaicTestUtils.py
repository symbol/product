from datetime import datetime, timezone

from rest.model.symbol.Mosaic import SymbolMosaicView


def create_symbol_mosaic(mosaic_id, divisibility):
	"""Creates one current-state Mosaic row for REST database tests."""

	return {
		'mosaic_id': mosaic_id,
		'owner_address': bytes.fromhex('9889432DE263BB8FE88444A4DA28D3609BD8BB8FAE18AE95'),
		'start_height': 1,
		'duration': 0,
		'expiration_height': None,
		'supply': 1,
		'divisibility': divisibility,
		'flags': 0,
		'supply_mutable': False,
		'transferable': False,
		'restrictable': False,
		'revokable': False,
		'raw_payload': {'id': mosaic_id},
		'updated_at_height': 1
	}


def create_symbol_mosaic_view(**overrides_map):
	"""Creates current mosaic metadata with optional field overrides for REST tests."""

	fields_map = {
		'mosaic_id': '72C0212E67A08BCE',
		'owner_address': 'TATNE7Q5BITMUTRRN6IB4I7FLSDRDWZA34I2PMQ',
		'start_height': 123,
		'registration_timestamp': datetime(2026, 1, 1, tzinfo=timezone.utc),
		'expiration_height': 579,
		'duration': 456,
		'supply': 1234567,
		'divisibility': 6,
		'supply_mutable': False,
		'transferable': True,
		'restrictable': False,
		'revokable': True,
		'alias_names': ['example', 'example.token']
	}
	fields_map.update(overrides_map)
	return SymbolMosaicView(**fields_map)
