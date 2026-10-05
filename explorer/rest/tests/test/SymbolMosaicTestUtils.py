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
