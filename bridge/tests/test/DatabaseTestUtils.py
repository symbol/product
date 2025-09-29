import sqlite3
from collections import namedtuple

from symbolchain.CryptoTypes import Hash256, PrivateKey
from symbolchain.symbol.Network import Address

from bridge.db.WrapRequestDatabase import PayoutDetails
from bridge.models.WrapRequest import WrapError, WrapRequest

from .BridgeTestUtils import NEM_ADDRESSES, SYMBOL_ADDRESSES, make_request, make_request_error

FilteringTestParameters = namedtuple('FilteringTestParameters', [
	'address_index', 'hash_index', 'offset', 'limit',
	'payout_transaction_hash', 'payout_status',
	'expected_all', 'expected_address_filter', 'expected_destination_address_filter', 'expected_hash_filter', 'expected_payout_hash_filter',
	'expected_payout_status_filter',
	'expected_custom_offset_and_limit', 'expected_custom_offset_and_limit_desc'
])


# region get_all_table_names

def get_all_table_names(database_class, *args):
	# Arrange:
	with sqlite3.connect(':memory:') as connection:
		database = database_class(connection, *args)

		# Act: call create_tables multiple times in order to ensure it is idempotent
		database.create_tables()
		database.create_tables()

		cursor = connection.cursor()
		tables = cursor.execute('''SELECT name FROM sqlite_master
			WHERE type = 'table'
			ORDER BY 1;
		''')
		table_names = set(tuple[0] for tuple in tables)
		return table_names

# endregion


# region bespoke seeding

def add_requests_wrap(database, request_tuples):
	"""Add wrap requests to database."""

	for (height, amount, fee) in request_tuples:
		transaction_hash = Hash256(PrivateKey.random().bytes)
		request = WrapRequest(height, transaction_hash, -1, transaction_hash, 0, 'tbd')
		database.add_request(request)

		payout_transaction_hash = Hash256(PrivateKey.random().bytes)
		database.mark_payout_sent(request, PayoutDetails(payout_transaction_hash, amount, fee, 0))


def add_requests_unwrap(database, request_tuples):
	"""Add unwrap requests to database."""

	for (height, amount, raw_payout_transaction_hash) in request_tuples:
		transaction_hash = Hash256(PrivateKey.random().bytes)
		request = WrapRequest(height, transaction_hash, -1, transaction_hash, amount, 'tbd')
		database.add_request(request)

		if raw_payout_transaction_hash:
			database.mark_payout_sent(request, PayoutDetails(Hash256(raw_payout_transaction_hash), 0, 0, 0))


def add_transfers(database, transfer_tuples, formatted_mosaic_id='foo:bar'):
	"""Add transfers to database."""

	for (height, amount, raw_transaction_hash) in transfer_tuples:
		transaction_hash = Hash256(raw_transaction_hash) if raw_transaction_hash else Hash256.zero()
		database.add_transfer(height, formatted_mosaic_id, amount, transaction_hash)
		database.add_transfer(height, 'foo:other', 2 * amount, transaction_hash)  # should be ignored by mosaic filtering

# endregion


# region filtering

def get_default_filtering_test_parameters():  # pylint: disable=invalid-name
	"""Gets parameters and expected heights for default filtering tests."""

	payout_transaction_hash = Hash256('066E5BF4B539230E12DD736D44CEFB5274FACBABC22735F2264A40F72AFB0124')
	return FilteringTestParameters(1, 3, 5, 7, payout_transaction_hash, 1, list(range(1, 26)), [
		1, 3,
		5, 7,
		9, 11,
		13, 15,
		17, 19,
		21, 23,
		25, 27,
		29, 31,
		33, 35,
		37, 39
	], [
		3,
		7,
		11,
		15,
		19,
		23,
		27,
		31,
		35,
		39
	], [
		1,
		5,
		9,
		13,
		17,
		21,
		25,
		29,
		33,
		37
	], [
		6
	], [
		4,
		6,
		12,
		20,
		28,
		36
	], [
		11,
		13, 15,
		17, 19,
		21, 23
	], [
		29,
		27, 25,
		23, 21,
		19, 17
	])


def _swap_request_error_addresses(error):
	return WrapError(
		error.transaction_height,
		error.transaction_hash,
		error.transaction_subindex,
		Address(SYMBOL_ADDRESSES[NEM_ADDRESSES.index(str(error.sender_address))]),
		error.message)


def seed_database_with_simple_errors(database, is_unwrap=False):
	"""Seeds database with simple errors."""

	seed_errors = [
		make_request_error(0, 'this is an error message', height=111),
		make_request_error(1, 'this is another error message', height=222),
		make_request_error(2, 'error message', height=333)
	]
	if is_unwrap:
		seed_errors = [_swap_request_error_addresses(error) for error in seed_errors]
	for error in seed_errors:
		database.add_error(error)

	database.set_block_timestamp(111, 1020)
	database.set_block_timestamp(222, 3040)
	database.set_block_timestamp(333, 4050)


def seed_database_with_many_errors(database, is_unwrap=False):
	"""Seeds database  with many errors for filtering tests."""

	for i in range(10):
		seed_errors = [
			make_request_error(0, 'this is an error message', height=4 + i * 4, transaction_subindex=i),
			make_request_error(1, 'this is another error message', height=3 + i * 4, transaction_subindex=i),
			make_request_error(2, 'error message', height=2 + i * 4, transaction_subindex=i),
			make_request_error(3, 'other error message', height=1 + i * 4, address_index=1, transaction_subindex=i)
		]
		if is_unwrap:
			seed_errors = [_swap_request_error_addresses(error) for error in seed_errors]
		for error in seed_errors:
			database.add_error(error)
			database.set_block_timestamp(error.transaction_height, 2 * error.transaction_height)


def _swap_request_addresses(request):
	return WrapRequest(
		request.transaction_height,
		request.transaction_hash,
		request.transaction_subindex,
		Address(SYMBOL_ADDRESSES[NEM_ADDRESSES.index(str(request.sender_address))]),
		request.amount,
		NEM_ADDRESSES[SYMBOL_ADDRESSES.index(request.destination_address)])


def seed_database_with_simple_requests(database, is_unwrap=False):
	"""Seeds database with simple requests."""

	seed_requests = [
		make_request(0, height=111, amount=5554, destination_address=SYMBOL_ADDRESSES[0]),  # unprocessed
		make_request(1, height=222, amount=8865, destination_address=SYMBOL_ADDRESSES[1]),  # sent
		make_request(2, height=333, amount=8889, destination_address=SYMBOL_ADDRESSES[2]),  # completed
		make_request(3, height=444, amount=1234, destination_address=SYMBOL_ADDRESSES[3], transaction_subindex=2),  # failed

		# add another failed with different subindex to test subindex join
		make_request(5, height=555, amount=7788, destination_address=SYMBOL_ADDRESSES[5], hash_index=3, transaction_subindex=1)
	]
	if is_unwrap:
		seed_requests = [_swap_request_addresses(request) for request in seed_requests]
	for request in seed_requests:
		database.add_request(request)

	database.set_block_timestamp(111, 1020)
	database.set_block_timestamp(222, 3040)
	database.set_block_timestamp(333, 4050)
	database.set_block_timestamp(444, 5060)
	database.set_block_timestamp(555, 7080)

	payout_transaction_hash_1 = Hash256('066E5BF4B539230E12DD736D44CEFB5274FACBABC22735F2264A40F72AFB0124')
	database.mark_payout_sent(seed_requests[1], PayoutDetails(payout_transaction_hash_1, 2200, 450, 156))

	payout_transaction_hash_2 = Hash256('ACFF5E24733CD040504448A3A75F1CE32E90557E5FBA02E107624242F4FA251D')
	database.mark_payout_sent(seed_requests[2], PayoutDetails(payout_transaction_hash_2, 1100, 300, 121))
	database.mark_payout_completed(payout_transaction_hash_2, 1122)

	database.mark_payout_failed(seed_requests[3], 'failed to send payout 2')
	database.mark_payout_failed(seed_requests[4], 'failed to send payout 1')

	database.set_payout_block_timestamp(1122, 3333)
	database.set_payout_block_timestamp(2233, 4444)


def seed_database_with_many_requests(database, is_unwrap=False):
	"""Seeds database  with many requests for filtering tests."""

	for i in range(10):
		seed_requests = [
			make_request(0, height=4 + i * 4, transaction_subindex=i, destination_address=SYMBOL_ADDRESSES[0]),
			make_request(1, height=3 + i * 4, transaction_subindex=i, destination_address=SYMBOL_ADDRESSES[1]),
			make_request(2, height=2 + i * 4, transaction_subindex=i, destination_address=SYMBOL_ADDRESSES[2]),
			make_request(3, height=1 + i * 4, address_index=1, transaction_subindex=i, destination_address=SYMBOL_ADDRESSES[3])
		]
		if is_unwrap:
			seed_requests = [_swap_request_addresses(request) for request in seed_requests]
		for request in seed_requests:
			database.add_request(request)
			database.set_block_timestamp(request.transaction_height, 2 * request.transaction_height)

		if 1 == i:
			# only set payout transaction hash once because it has unique constraint in database
			payout_transaction_hash = get_default_filtering_test_parameters().payout_transaction_hash
			database.mark_payout_sent(seed_requests[2], PayoutDetails(payout_transaction_hash, 2200, 450, 156))

		if 0 == i % 2:
			database.mark_payout_sent(seed_requests[0], PayoutDetails(Hash256(bytes([i] * Hash256.SIZE)), 2200 + i, 450 + i, 156 + i))

# endregion
