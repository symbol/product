# pylint: disable=too-many-arguments,too-many-positional-arguments

MOSAIC_ID = '72C0212E67A08BCE'
MOSAIC_OWNER_ADDRESS = '9889432DE263BB8FE88444A4DA28D3609BD8BB8FAE18AE95'


def create_mosaic_item(
	mosaic_id=MOSAIC_ID,
	owner_address=MOSAIC_OWNER_ADDRESS,
	start_height='1',
	duration='0',
	supply='8359527600677922',
	divisibility=6,
	flags=2,
	item_id='6733BA562D1F6AABA297D735'
):
	"""Creates a Symbol node mosaic batch item for puller tests."""

	return {
		'mosaic': {
			'version': 1,
			'id': mosaic_id,
			'supply': supply,
			'startHeight': start_height,
			'ownerAddress': owner_address,
			'revision': 1,
			'flags': flags,
			'divisibility': divisibility,
			'duration': duration
		},
		'id': item_id
	}


def create_expected_mosaic_row(mosaic_item, observed_height, **overrides):
	"""Creates a hardcoded expected normalized mosaic row for tests."""

	mosaic = mosaic_item['mosaic']
	row = {
		'mosaic_id': mosaic['id'],
		'owner_address': bytes.fromhex(mosaic['ownerAddress']),
		'start_height': int(mosaic['startHeight']),
		'duration': int(mosaic['duration']),
		'expiration_height': None,
		'supply': int(mosaic['supply']),
		'divisibility': int(mosaic['divisibility']),
		'flags': int(mosaic['flags']),
		'supply_mutable': False,
		'transferable': True,
		'restrictable': False,
		'revokable': False,
		'raw_payload': mosaic_item,
		'updated_at_height': observed_height
	}
	row.update(overrides)

	return row


def fetch_mosaic_state(database):
	"""Fetches the complete persisted mosaic projection in deterministic order."""

	cursor = database.connection.cursor()
	cursor.execute(
		'''
		SELECT mosaic_id, encode(owner_address, 'hex'), start_height, duration, expiration_height, supply,
			divisibility, flags, supply_mutable, transferable, restrictable, revokable, alias_names,
			raw_payload, updated_at_height
		FROM symbol_mosaics
		ORDER BY mosaic_id
		''')

	return cursor.fetchall()
