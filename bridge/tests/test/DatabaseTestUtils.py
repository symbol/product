import sqlite3
from collections import namedtuple

from symbolchain.CryptoTypes import Hash256
from symbolchain.symbol.Network import Address

from bridge.db.WrapRequestDatabase import PayoutDetails
from bridge.models.WrapRequest import WrapError, WrapRequest

from .BridgeTestUtils import NEM_ADDRESSES, SYMBOL_ADDRESSES, make_request, make_request_error

FilteringTestParameters = namedtuple('FilteringTestParameters', [
	'address_index', 'hash_index', 'offset', 'limit',
	'expected_all', 'expected_hash_filter', 'expected_custom_offset_and_limit'
])


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


def get_default_filtering_test_parameters():  # pylint: disable=invalid-name
	"""Gets parameters and expected heights for default filtering tests."""

	return FilteringTestParameters(1, 3, 5, 7, [
		1, 3,
		5, 7,
		9, 11,
		13, 15,
		17, 19,
		21, 23,
		25, 27,
		29, 31,
		33, 35,
		37, 39,
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
		11,
		13, 15,
		17, 19,
		21, 23
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
		make_request(3, height=444, amount=1234, destination_address=SYMBOL_ADDRESSES[3])   # failed
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

	database.mark_payout_failed(seed_requests[3], 'failed to send payout')

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
