from symbolchain.sc import MosaicFlags


def create_mosaic_row(mosaic_item, observed_height):
	"""Creates one persisted mosaic row from a Symbol node mosaic response."""

	mosaic = mosaic_item['mosaic']
	start_height = int(mosaic['startHeight'])
	duration = int(mosaic['duration'])
	flags = int(mosaic['flags'])
	return {
		'mosaic_id': mosaic['id'],
		'owner_address': bytes.fromhex(mosaic['ownerAddress']),
		'start_height': start_height,
		'duration': duration,
		'expiration_height': None if 0 == duration else start_height + duration,
		'supply': int(mosaic['supply']),
		'divisibility': int(mosaic['divisibility']),
		'flags': flags,
		'supply_mutable': bool(flags & MosaicFlags.SUPPLY_MUTABLE.value),
		'transferable': bool(flags & MosaicFlags.TRANSFERABLE.value),
		'restrictable': bool(flags & MosaicFlags.RESTRICTABLE.value),
		'revokable': bool(flags & MosaicFlags.REVOKABLE.value),
		'raw_payload': mosaic_item,
		'updated_at_height': observed_height
	}
