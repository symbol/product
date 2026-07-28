# pylint: disable=too-many-arguments,too-many-positional-arguments
from collections import namedtuple

from symbolchain.sc import MosaicFlags

MOSAIC_ID = '72C0212E67A08BCE'
MOSAIC_OWNER_ADDRESS = '9889432DE263BB8FE88444A4DA28D3609BD8BB8FAE18AE95'
UNSET = object()

PersistedMosaicState = namedtuple(
	'PersistedMosaicState',
	[
		'mosaic_id',
		'owner_address_hex',
		'start_height',
		'duration',
		'expiration_height',
		'supply',
		'divisibility',
		'flags',
		'supply_mutable',
		'transferable',
		'restrictable',
		'revokable',
		'alias_names',
		'raw_payload',
		'updated_at_height'
	])


def create_mosaic_item(
	mosaic_id=MOSAIC_ID,
	owner_address=MOSAIC_OWNER_ADDRESS,
	start_height='1',
	duration='0',
	supply='8359527600677922',
	divisibility=6,
	flags=MosaicFlags.TRANSFERABLE.value,
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


def create_expected_mosaic_row(
	mosaic_item,
	observed_height,
	*,
	expiration_height=UNSET,
	supply_mutable=UNSET,
	transferable=UNSET,
	restrictable=UNSET,
	revokable=UNSET
):
	"""Creates an expected row for the default unlimited, transferable fixture.

	``None`` is a valid expected value for an unlimited mosaic, so it cannot also
	serve as the unspecified sentinel. Flag expectations are booleans, but they
	use the same ``UNSET`` sentinel so all omitted values are handled consistently.
	For non-default duration or flags, callers must provide normalized expectations
	instead of having this helper repeat production calculations and create a
	tautological test.
	"""

	mosaic = mosaic_item['mosaic']
	if expiration_height is UNSET:
		if 0 != int(mosaic['duration']):
			raise ValueError('expiration_height must be explicit for finite mosaics')
		expiration_height = None

	if any(value is UNSET for value in (supply_mutable, transferable, restrictable, revokable)):
		if MosaicFlags.TRANSFERABLE.value != int(mosaic['flags']):
			raise ValueError('all flag expectations must be explicit for non-default flags')
		supply_mutable = False if supply_mutable is UNSET else supply_mutable
		transferable = True if transferable is UNSET else transferable
		restrictable = False if restrictable is UNSET else restrictable
		revokable = False if revokable is UNSET else revokable

	row = {
		'mosaic_id': mosaic['id'],
		'owner_address': bytes.fromhex(mosaic['ownerAddress']),
		'start_height': int(mosaic['startHeight']),
		'duration': int(mosaic['duration']),
		'expiration_height': expiration_height,
		'supply': int(mosaic['supply']),
		'divisibility': int(mosaic['divisibility']),
		'flags': int(mosaic['flags']),
		'supply_mutable': supply_mutable,
		'transferable': transferable,
		'restrictable': restrictable,
		'revokable': revokable,
		'raw_payload': mosaic_item,
		'updated_at_height': observed_height
	}

	return row


def create_persisted_mosaic_state(row, alias_names):
	"""Creates the complete persisted mosaic state expected by database tests."""

	return PersistedMosaicState(
		row['mosaic_id'],
		row['owner_address'].hex(),
		row['start_height'],
		row['duration'],
		row['expiration_height'],
		row['supply'],
		row['divisibility'],
		row['flags'],
		row['supply_mutable'],
		row['transferable'],
		row['restrictable'],
		row['revokable'],
		alias_names,
		row['raw_payload'],
		row['updated_at_height'])


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

	return [PersistedMosaicState(*row) for row in cursor.fetchall()]
