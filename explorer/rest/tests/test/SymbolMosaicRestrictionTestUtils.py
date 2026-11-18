"""Shared real-database Mosaic Restriction fixtures."""

from common.symbol.NativeMosaic import NativeMosaicInfo
from psycopg2.extras import Json
from symbolchain.symbol.Network import Address

MOSAIC_ID = '1234567890ABCDEF'
OTHER_ID = '2234567890ABCDEF'
EMPTY_ID = '3234567890ABCDEF'
ADDRESS = 'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI'
OTHER_ADDRESS = 'TD3I6ZLS22YLJIL7AIQHOAN34AOUSRNK6OR6OIY'
FIRST_ADDRESS = 'TAHJNXEF62ZEVSOI3NP7YWODLCAMBNZCY6LTIIY'
LAST_ADDRESS = 'TD3MWQTWWFVDJGQ4HTKQYN2SO5NNLU7S6647JXY'
NATIVE = NativeMosaicInfo('72C0212E67A08BCE', 6)


def insert_restriction(  # pylint: disable=too-many-arguments,too-many-positional-arguments
	database, identity, mosaic_id, entry_type, address, rules, height=1):
	with database.connection.cursor() as cursor:
		cursor.execute(
			'''INSERT INTO symbol_mosaic_restrictions
			(composite_hash, mosaic_id, entry_type, target_address, restrictions, raw_payload, updated_at_height)
			VALUES (%s, %s, %s, %s, %s, %s, %s)''',
			(bytes([identity]) * 32, mosaic_id, entry_type, Address(address).bytes if address else None,
				Json(rules), Json({'private': 'must not leak'}), height))

	database.connection.commit()


def restriction_rules():
	return [
		{'key': '18446744073709551615', 'value': '18446744073709551614'},
		{'key': '3', 'value': '9'}
	]


def global_restriction_rules():
	return [
		{'key': str(i), 'restriction': {
			'referenceMosaicId': '0000000000000000' if i == 1 else OTHER_ID,
			'restrictionValue': '18446744073709551615', 'restrictionType': i}}
		for i in range(1, 7)
	]


def seed_restriction_rows(database):
	# Neither insertion order nor composite-hash order matches the contract order.
	insert_restriction(database, 20, MOSAIC_ID, 'global', None, global_restriction_rules())
	insert_restriction(database, 5, OTHER_ID, 'address', OTHER_ADDRESS, [])
	insert_restriction(database, 10, MOSAIC_ID, 'address', LAST_ADDRESS, [])
	insert_restriction(database, 30, MOSAIC_ID, 'address', ADDRESS, restriction_rules())
	insert_restriction(database, 2, OTHER_ID, 'global', None, [])
	# This unpublished row sorts between two published rows at the page boundary.
	insert_restriction(database, 3, MOSAIC_ID, 'address', OTHER_ADDRESS, [], 11)
	insert_restriction(database, 40, MOSAIC_ID, 'address', FIRST_ADDRESS, [], 10)
	insert_restriction(database, 50, OTHER_ID, 'address', ADDRESS, [])
