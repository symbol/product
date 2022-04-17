import sqlite3
import unittest
from collections import namedtuple

from symbolchain.CryptoTypes import Hash256
from symbolchain.nem.Network import Address as NemAddress
from symbolchain.symbol.Network import Address as SymbolAddress

from puller.db.CompletedOptinDatabase import CompletedOptinDatabase

from ..test.DatabaseTestUtils import get_all_table_names
from ..test.MockNetworkTimeConverter import MockNetworkTimeConverter
from ..test.OptinRequestTestUtils import HASHES, NEM_ADDRESSES, SYMBOL_ADDRESSES

ZERO_TIMESTAMP = 303  # MockNetworkTimeConverter maps 0 Symbol network time to this value
MARKER_HASHES = [
	'11223344556677889900AABBCCDDEEFF11223344556677889900AABBCCDDEEFF',
	'1111222233334444555566667777888899990000AAAABBBBCCCCDDDDEEEEFFFF',
	'1111111122222222333333334444444455555555666666667777777788888888',
	'9999999900000000AAAAAAAABBBBBBBBCCCCCCCCDDDDDDDDEEEEEEEEFFFFFFFF'
]


ExpectedData = namedtuple(
	'ExpectedData',
	['flags', 'nem_sources', 'nem_labels', 'nem_transactions', 'symbol_destinations'],
	defaults=(None,) * 5)


class CompletedOptinDatabaseTest(unittest.TestCase):
	# pylint: disable=too-many-public-methods

	# region create

	def test_can_create_tables(self):
		# Act:
		table_names = get_all_table_names(CompletedOptinDatabase, MockNetworkTimeConverter())

		# Assert:
		self.assertEqual(
			set(['nem_block_timestamps', 'optin_id', 'nem_source', 'nem_label', 'nem_transaction', 'symbol_destination']), table_names)

	# endregion

	# region assert db contents

	def _assert_db_contents(self, connection, expected_optin_count, expected_data):
		cursor = connection.cursor()
		cursor.execute('''SELECT COUNT(*) FROM optin_id''')
		optin_count = cursor.fetchone()[0]

		cursor.execute('''SELECT is_postoptin FROM optin_id ORDER BY id''')
		flags = cursor.fetchall()

		cursor.execute('''SELECT * FROM nem_source ORDER BY balance DESC''')
		nem_sources = cursor.fetchall()

		cursor.execute('''SELECT * FROM nem_label ORDER BY label DESC''')
		nem_labels = cursor.fetchall()

		cursor.execute('''SELECT * FROM nem_transaction ORDER BY address,hash DESC''')
		nem_transactions = cursor.fetchall()

		cursor.execute('''SELECT * FROM symbol_destination ORDER BY balance DESC''')
		symbol_destinations = cursor.fetchall()

		# Assert:
		self.assertEqual(expected_optin_count, optin_count)
		self.assertEqual(expected_data.flags or [], flags)
		self.assertEqual(expected_data.nem_sources or [], nem_sources)
		self.assertEqual(expected_data.nem_labels or [], nem_labels)
		self.assertEqual(expected_data.nem_transactions or [], nem_transactions)
		self.assertEqual(expected_data.symbol_destinations or [], symbol_destinations)

	# endregion

	# region insert_transaction - valid

	def _assert_can_insert_transactions(self, address_transaction_tuples, expected_data):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = CompletedOptinDatabase(connection, MockNetworkTimeConverter())
			database.create_tables()

			# Act:
			for address, transaction in address_transaction_tuples:
				database.insert_transaction(address, transaction)

			heights = database.optin_transaction_heights()

			# Assert
			self._assert_db_contents(connection, 0, expected_data)

			expected_heights = set(map(lambda transaction: transaction[2], expected_data.nem_transactions))
			self.assertEqual(expected_heights, heights)

	def test_can_insert_single_transaction(self):
		self._assert_can_insert_transactions(
			[
				(NEM_ADDRESSES[0], {'hash': MARKER_HASHES[0], 'height': 123})
			], ExpectedData(
				nem_transactions=[
					(NemAddress(NEM_ADDRESSES[0]).bytes, Hash256(MARKER_HASHES[0]).bytes, 123),
				]
			))

	def test_can_insert_multiple_transactions_with_same_source(self):
		self._assert_can_insert_transactions(
			[
				(NEM_ADDRESSES[0], {'hash': MARKER_HASHES[0], 'height': 123}),
				(NEM_ADDRESSES[0], {'hash': MARKER_HASHES[1], 'height': 456}),
				(NEM_ADDRESSES[0], {'hash': MARKER_HASHES[2], 'height': 789})
			], ExpectedData(
				nem_transactions=[
					(NemAddress(NEM_ADDRESSES[0]).bytes, Hash256(MARKER_HASHES[0]).bytes, 123),
					(NemAddress(NEM_ADDRESSES[0]).bytes, Hash256(MARKER_HASHES[1]).bytes, 456),
					(NemAddress(NEM_ADDRESSES[0]).bytes, Hash256(MARKER_HASHES[2]).bytes, 789),
				]
			))

	# endregion

	# region insert_mapping - valid

	def _assert_can_insert_mappings(self, one_or_more_mappings, expected_data):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			mappings = one_or_more_mappings if isinstance(one_or_more_mappings, list) else [one_or_more_mappings]

			database = CompletedOptinDatabase(connection, MockNetworkTimeConverter())
			database.create_tables()

			# Act:
			for mapping in mappings:
				database.insert_mapping(*mapping)

			# Assert:
			self._assert_db_contents(connection, len(mappings), expected_data)

	def test_can_insert_one_to_one_with_matching_balances(self):
		self._assert_can_insert_mappings(
			(
				{NEM_ADDRESSES[0]: 558668349881393},
				{SYMBOL_ADDRESSES[0]: {'sym-balance': 558668349881393, 'height': 345, 'timestamp': 1234}}
			),
			ExpectedData(
				flags=[(True,)],
				nem_sources=[(NemAddress(NEM_ADDRESSES[0]).bytes, 558668349881393, 1)],
				symbol_destinations=[
					# time converter is used
					(SymbolAddress(SYMBOL_ADDRESSES[0]).bytes, 558668349881393, None, 345, 1234 * 3, 1)
				]))

	def test_can_insert_merge_with_matching_balances(self):
		self._assert_can_insert_mappings(
			(
				{
					NEM_ADDRESSES[0]: 43686866144523,
					NEM_ADDRESSES[1]: 16108065258303
				},
				{SYMBOL_ADDRESSES[0]: {'sym-balance': 59794931402826, 'height': 345, 'timestamp': 1234}}
			),
			ExpectedData(
				flags=[(True,)],
				nem_sources=[
					(NemAddress(NEM_ADDRESSES[0]).bytes, 43686866144523, 1),
					(NemAddress(NEM_ADDRESSES[1]).bytes, 16108065258303, 1)
				],
				symbol_destinations=[
					# time converter is used
					(SymbolAddress(SYMBOL_ADDRESSES[0]).bytes, 59794931402826, None, 345, 1234 * 3, 1)
				]))

	def test_can_insert_multi_with_matching_balances(self):
		self._assert_can_insert_mappings(
			(
				{
					NEM_ADDRESSES[0]: 43686866144523,
					NEM_ADDRESSES[1]: 16108065258303
				},
				{
					SYMBOL_ADDRESSES[0]: {'sym-balance': 33686866144523},
					SYMBOL_ADDRESSES[1]: {'sym-balance': 26108065200000},
					SYMBOL_ADDRESSES[2]: {'sym-balance': 58303}
				},
			),
			ExpectedData(
				flags=[(True,)],
				nem_sources=[
					(NemAddress(NEM_ADDRESSES[0]).bytes, 43686866144523, 1),
					(NemAddress(NEM_ADDRESSES[1]).bytes, 16108065258303, 1)
				],
				symbol_destinations=[
					(SymbolAddress(SYMBOL_ADDRESSES[0]).bytes, 33686866144523, None, 1, ZERO_TIMESTAMP, 1),
					(SymbolAddress(SYMBOL_ADDRESSES[1]).bytes, 26108065200000, None, 1, ZERO_TIMESTAMP, 1),
					(SymbolAddress(SYMBOL_ADDRESSES[2]).bytes, 58303, None, 1, ZERO_TIMESTAMP, 1)
				]))

	def test_can_insert_multiple_mappings_with_matching_balances(self):
		self._assert_can_insert_mappings(
			[
				(
					{NEM_ADDRESSES[0]: 558668349881393},
					{SYMBOL_ADDRESSES[0]: {'sym-balance': 558668349881393}}
				),
				(
					{NEM_ADDRESSES[1]: 43686866144523, NEM_ADDRESSES[2]: 16108065258303},
					{
						SYMBOL_ADDRESSES[1]: {'sym-balance': 33686866144523},
						SYMBOL_ADDRESSES[2]: {'sym-balance': 26108065200000},
						SYMBOL_ADDRESSES[3]: {'sym-balance': 58303}
					}
				)
			],
			ExpectedData(
				flags=[
					(True,),
					(True,)
				],
				nem_sources=[
					(NemAddress(NEM_ADDRESSES[0]).bytes, 558668349881393, 1),
					(NemAddress(NEM_ADDRESSES[1]).bytes, 43686866144523, 2),
					(NemAddress(NEM_ADDRESSES[2]).bytes, 16108065258303, 2)
				],
				symbol_destinations=[
					(SymbolAddress(SYMBOL_ADDRESSES[0]).bytes, 558668349881393, None, 1, ZERO_TIMESTAMP, 1),
					(SymbolAddress(SYMBOL_ADDRESSES[1]).bytes, 33686866144523, None, 1, ZERO_TIMESTAMP, 2),
					(SymbolAddress(SYMBOL_ADDRESSES[2]).bytes, 26108065200000, None, 1, ZERO_TIMESTAMP, 2),
					(SymbolAddress(SYMBOL_ADDRESSES[3]).bytes, 58303, None, 1, ZERO_TIMESTAMP, 2)
				]))

	def test_can_insert_multiple_mappings_with_matching_balances_and_nem_transactions(self):
		self._assert_can_insert_mappings(
			[
				(
					{NEM_ADDRESSES[0]: 558668349881393},
					{SYMBOL_ADDRESSES[0]: {'sym-balance': 558668349881393}},
					{NEM_ADDRESSES[0]: [{'hash': MARKER_HASHES[0], 'height': 123}]}
				),
				(
					{
						NEM_ADDRESSES[1]: 43686866144523,
						NEM_ADDRESSES[2]: 16108065258303
					},
					{
						SYMBOL_ADDRESSES[1]: {'sym-balance': 33686866144523},
						SYMBOL_ADDRESSES[2]: {'sym-balance': 26108065200000},
						SYMBOL_ADDRESSES[3]: {'sym-balance': 58303}
					},
					{
						NEM_ADDRESSES[1]: [{'hash': MARKER_HASHES[1], 'height': 456}],
						NEM_ADDRESSES[2]: [
							{'hash': MARKER_HASHES[2], 'height': 789},
							{'hash': MARKER_HASHES[3], 'height': 778899}
						]
					}
				)
			],
			ExpectedData(
				flags=[
					(True,),
					(True,)
				],
				nem_sources=[
					(NemAddress(NEM_ADDRESSES[0]).bytes, 558668349881393, 1),
					(NemAddress(NEM_ADDRESSES[1]).bytes, 43686866144523, 2),
					(NemAddress(NEM_ADDRESSES[2]).bytes, 16108065258303, 2)
				],
				symbol_destinations=[
					(SymbolAddress(SYMBOL_ADDRESSES[0]).bytes, 558668349881393, None, 1, ZERO_TIMESTAMP, 1),
					(SymbolAddress(SYMBOL_ADDRESSES[1]).bytes, 33686866144523, None, 1, ZERO_TIMESTAMP, 2),
					(SymbolAddress(SYMBOL_ADDRESSES[2]).bytes, 26108065200000, None, 1, ZERO_TIMESTAMP, 2),
					(SymbolAddress(SYMBOL_ADDRESSES[3]).bytes, 58303, None, 1, ZERO_TIMESTAMP, 2)
				],
				# note: transactions are sorted (address,hash) tuple so hash[3] will be returned before hash[2]
				nem_transactions=[
					(NemAddress(NEM_ADDRESSES[0]).bytes, Hash256(MARKER_HASHES[0]).bytes, 123),
					(NemAddress(NEM_ADDRESSES[1]).bytes, Hash256(MARKER_HASHES[1]).bytes, 456),
					(NemAddress(NEM_ADDRESSES[2]).bytes, Hash256(MARKER_HASHES[3]).bytes, 778899),
					(NemAddress(NEM_ADDRESSES[2]).bytes, Hash256(MARKER_HASHES[2]).bytes, 789),
				]))

	# endregion

	# region insert_mapping - invalid mismatched balances

	def _assert_cannot_insert_last_mapping(self, one_or_more_mappings, expected_error=ValueError):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			mappings = one_or_more_mappings if isinstance(one_or_more_mappings, list) else [one_or_more_mappings]

			database = CompletedOptinDatabase(connection, MockNetworkTimeConverter())
			database.create_tables()

			for mapping in mappings[:-1]:
				database.insert_mapping(*mapping)

			# Act:
			with self.assertRaises(expected_error):
				database.insert_mapping(*mappings[-1])

			cursor = connection.cursor()
			cursor.execute('''SELECT COUNT(*) FROM optin_id''')
			optin_count = cursor.fetchone()[0]

			# Assert: nothing was inserted
			self.assertEqual(len(mappings) - 1, optin_count)

	def test_cannot_insert_one_to_one_without_matching_balances(self):
		self._assert_cannot_insert_last_mapping((
			{NEM_ADDRESSES[0]: 558668349881383},
			{SYMBOL_ADDRESSES[0]: {'sym-balance': 558668349881393}}
		))

	def test_cannot_insert_merge_without_matching_balances(self):
		self._assert_cannot_insert_last_mapping((
			{NEM_ADDRESSES[0]: 43686866144523, NEM_ADDRESSES[1]: 16108065258303},
			{SYMBOL_ADDRESSES[0]: {'sym-balance': 59794941402826}}
		))

	def test_cannot_insert_multi_without_matching_balances(self):
		self._assert_cannot_insert_last_mapping((
			{NEM_ADDRESSES[0]: 43686866144523, NEM_ADDRESSES[1]: 16108065258303},
			{
				SYMBOL_ADDRESSES[0]: {'sym-balance': 33686866144523},
				SYMBOL_ADDRESSES[1]: {'sym-balance': 26108065200000},
				SYMBOL_ADDRESSES[2]: {'sym-balance': 56303}
			}
		))

	# endregion

	# region insert_mapping - constraints

	def test_can_map_multiple_sources_to_same_destination(self):
		self._assert_can_insert_mappings(
			[
				(
					{NEM_ADDRESSES[0]: 43686866144523},
					{SYMBOL_ADDRESSES[0]: {'sym-balance': 43686866144523}}
				),
				(
					{NEM_ADDRESSES[1]: 16108065258303},
					{SYMBOL_ADDRESSES[0]: {'sym-balance': 16108065258303}}
				)
			],
			ExpectedData(
				flags=[
					(True,),
					(True,)
				],
				nem_sources=[
					(NemAddress(NEM_ADDRESSES[0]).bytes, 43686866144523, 1),
					(NemAddress(NEM_ADDRESSES[1]).bytes, 16108065258303, 2)
				],
				symbol_destinations=[
					(SymbolAddress(SYMBOL_ADDRESSES[0]).bytes, 43686866144523, None, 1, ZERO_TIMESTAMP, 1),
					(SymbolAddress(SYMBOL_ADDRESSES[0]).bytes, 16108065258303, None, 1, ZERO_TIMESTAMP, 2)
				]))

	def test_cannot_map_same_source_multiple_times(self):
		self._assert_cannot_insert_last_mapping(
			[
				(
					{NEM_ADDRESSES[0]: 43686866144523},
					{SYMBOL_ADDRESSES[0]: {'sym-balance': 43686866144523}}
				),
				(
					{NEM_ADDRESSES[0]: 16108065258303},
					{SYMBOL_ADDRESSES[1]: {'sym-balance': 16108065258303}}
				)
			],
			sqlite3.IntegrityError)

	# endregion

	# region insert_mappings_from_json

	@staticmethod
	def _create_entry_one():
		return {
			'source': [
				{
					'nis-address': NEM_ADDRESSES[0], 'nis-balance': '558668349881393',
					'transactions': [
						{'hash': HASHES[3], 'height': 123},
						{'hash': HASHES[2], 'height': 456}
					]
				},
			],
			'label': 'test-label',
			'type': '1-to-1',
			'destination': [
				{
					'sym-address': SYMBOL_ADDRESSES[0],
					'sym-balance': 558668349881393,
					'hash': MARKER_HASHES[0],
					'height': 234
				}
			]
		}

	@staticmethod
	def _create_entry_two():
		return {
			'source': [
				{
					'nis-address': NEM_ADDRESSES[1], 'nis-balance': '43686866144523',
					'transactions': [
						{'hash': HASHES[1], 'height': 789}
					]
				},
				{
					'nis-address': NEM_ADDRESSES[2], 'nis-balance': '16108065258303',
					'transactions': [
						{'hash': HASHES[0], 'height': 333}
					]
				}
			],
			'source_total': 0,  # in original json but ignored
			'type': 'multi',  # in original json but ignored
			'destination': [
				{
					'sym-address': SYMBOL_ADDRESSES[1],
					'sym-balance': 33686866144523,
					'hash': MARKER_HASHES[1],
					'height': 345,
					'timestamp': 1234
				},
				{
					'sym-address': SYMBOL_ADDRESSES[2],
					'sym-balance': 26108065200000,
					'hash': MARKER_HASHES[2],
					'height': 456

				},
				{
					'sym-address': SYMBOL_ADDRESSES[3],
					'sym-balance': 58303,
					'hash': MARKER_HASHES[3],
					'height': 567,
					'timestamp': 9876
				}
			],
			'destination_total': 0  # in original json but ignored
		}

	@staticmethod
	def _create_database_with_json_mappings(connection, remove_nem_transactions=True):
		database = CompletedOptinDatabase(connection, MockNetworkTimeConverter())
		database.create_tables()

		entries = [
			CompletedOptinDatabaseTest._create_entry_one(),
			CompletedOptinDatabaseTest._create_entry_two()
		]
		json_data = [{'info': 'comment that should be ignored'}, *entries]

		if remove_nem_transactions:
			for entry in json_data:
				for source in entry.get('source', []):
					del source['transactions']

		# Act:
		collected = []
		for entry in database.insert_mappings_from_json(json_data, False):
			collected.append(entry)

		return {
			'database': database,
			'collected': collected,
			'entries': entries
		}

	def test_can_insert_mappings_from_json_without_transactions(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			# Act:
			state = self._create_database_with_json_mappings(connection)

			# Assert:
			self._assert_db_contents(connection, 2, ExpectedData(
				flags=[
					(False,),
					(False,)
				],
				nem_sources=[
					(NemAddress(NEM_ADDRESSES[0]).bytes, 558668349881393, 1),
					(NemAddress(NEM_ADDRESSES[1]).bytes, 43686866144523, 2),
					(NemAddress(NEM_ADDRESSES[2]).bytes, 16108065258303, 2)
				],
				nem_labels=[
					(NemAddress(NEM_ADDRESSES[0]).bytes, 'test-label')
				],
				symbol_destinations=[
					# time converter is used
					(SymbolAddress(SYMBOL_ADDRESSES[0]).bytes, 558668349881393, Hash256(MARKER_HASHES[0]).bytes, 234, ZERO_TIMESTAMP, 1),
					(SymbolAddress(SYMBOL_ADDRESSES[1]).bytes, 33686866144523, Hash256(MARKER_HASHES[1]).bytes, 345, 1234 * 3, 2),
					(SymbolAddress(SYMBOL_ADDRESSES[2]).bytes, 26108065200000, Hash256(MARKER_HASHES[2]).bytes, 456, ZERO_TIMESTAMP, 2),
					(SymbolAddress(SYMBOL_ADDRESSES[3]).bytes, 58303, Hash256(MARKER_HASHES[3]).bytes, 567, 9876 * 3, 2)
				]))

			self.assertEqual(state['entries'], state['collected'])

	def test_can_insert_mappings_from_json_with_transactions(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			# Act:
			state = self._create_database_with_json_mappings(connection, False)

			# Assert:
			self._assert_db_contents(connection, 2, ExpectedData(
				flags=[
					(False,),
					(False,)
				],
				nem_sources=[
					(NemAddress(NEM_ADDRESSES[0]).bytes, 558668349881393, 1),
					(NemAddress(NEM_ADDRESSES[1]).bytes, 43686866144523, 2),
					(NemAddress(NEM_ADDRESSES[2]).bytes, 16108065258303, 2)
				],
				nem_labels=[
					(NemAddress(NEM_ADDRESSES[0]).bytes, 'test-label')
				],
				nem_transactions=[
					(NemAddress(NEM_ADDRESSES[0]).bytes, Hash256(HASHES[2]).bytes, 456),
					(NemAddress(NEM_ADDRESSES[0]).bytes, Hash256(HASHES[3]).bytes, 123),
					(NemAddress(NEM_ADDRESSES[1]).bytes, Hash256(HASHES[1]).bytes, 789),
					(NemAddress(NEM_ADDRESSES[2]).bytes, Hash256(HASHES[0]).bytes, 333),
				],
				symbol_destinations=[
					# time converter is used
					(SymbolAddress(SYMBOL_ADDRESSES[0]).bytes, 558668349881393, Hash256(MARKER_HASHES[0]).bytes, 234, ZERO_TIMESTAMP, 1),
					(SymbolAddress(SYMBOL_ADDRESSES[1]).bytes, 33686866144523, Hash256(MARKER_HASHES[1]).bytes, 345, 1234 * 3, 2),
					(SymbolAddress(SYMBOL_ADDRESSES[2]).bytes, 26108065200000, Hash256(MARKER_HASHES[2]).bytes, 456, ZERO_TIMESTAMP, 2),
					(SymbolAddress(SYMBOL_ADDRESSES[3]).bytes, 58303, Hash256(MARKER_HASHES[3]).bytes, 567, 9876 * 3, 2)
				]))

			self.assertEqual(state['entries'], state['collected'])

	def test_cannot_insert_conflicting_mappings(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = CompletedOptinDatabase(connection, MockNetworkTimeConverter())
			database.create_tables()

			json_data = [{'info': 'comment that should be ignored'}, self._create_entry_two(), self._create_entry_two()]

		# Act:
		with self.assertRaises(sqlite3.IntegrityError):
			for _ in database.insert_mappings_from_json(json_data, False):
				pass

		cursor = connection.cursor()
		cursor.execute('''SELECT COUNT(*) FROM optin_id''')
		optin_count = cursor.fetchone()[0]

		# Assert: nothing was inserted
		self.assertEqual(0, optin_count)

	# endregion

	# region set_label

	@staticmethod
	def _prepare_database_for_set_label_test(connection):
		database = CompletedOptinDatabase(connection, MockNetworkTimeConverter())
		database.create_tables()

		database.set_label(NemAddress(NEM_ADDRESSES[0]), 'green')
		database.set_label(NemAddress(NEM_ADDRESSES[1]), 'red')
		database.set_label(NemAddress(NEM_ADDRESSES[2]), 'blue')
		return database

	@staticmethod
	def _query_all_labels(connection):
		cursor = connection.cursor()
		cursor.execute('''SELECT * FROM nem_label ORDER BY label DESC''')
		return cursor.fetchall()

	def test_can_set_new_account_label(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			# Act:
			self._prepare_database_for_set_label_test(connection)

			# Assert:
			nem_labels = self._query_all_labels(connection)
			self.assertEqual([
				(NemAddress(NEM_ADDRESSES[1]).bytes, 'red'),
				(NemAddress(NEM_ADDRESSES[0]).bytes, 'green'),
				(NemAddress(NEM_ADDRESSES[2]).bytes, 'blue')
			], nem_labels)

	def test_can_update_new_account_label(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = self._prepare_database_for_set_label_test(connection)

			# Act:
			database.set_label(NemAddress(NEM_ADDRESSES[0]), 'yellow')
			database.set_label(NemAddress(NEM_ADDRESSES[2]), 'orange')

			# Assert:
			nem_labels = self._query_all_labels(connection)
			self.assertEqual([
				(NemAddress(NEM_ADDRESSES[0]).bytes, 'yellow'),
				(NemAddress(NEM_ADDRESSES[1]).bytes, 'red'),
				(NemAddress(NEM_ADDRESSES[2]).bytes, 'orange')
			], nem_labels)

	def test_can_update_new_account_simulate_file_access(self):
		# Arrange:
		with sqlite3.connect('file:mem1?mode=memory&cache=shared', uri=True) as connection:
			database = self._prepare_database_for_set_label_test(connection)
			database.set_label(NemAddress(NEM_ADDRESSES[0]), 'orange')

			# Act:
			with sqlite3.connect('file:mem1?mode=memory&cache=shared', uri=True) as connection2:
				database2 = CompletedOptinDatabase(connection2, MockNetworkTimeConverter())
				database2.set_label(NemAddress(NEM_ADDRESSES[0]), 'yellow')

				# Assert:
				nem_labels = self._query_all_labels(connection)
				self.assertEqual([
					(NemAddress(NEM_ADDRESSES[0]).bytes, 'yellow'),
					(NemAddress(NEM_ADDRESSES[1]).bytes, 'red'),
					(NemAddress(NEM_ADDRESSES[2]).bytes, 'blue')
				], nem_labels)

	# endregion

	# region is_opted_in

	def test_is_opted_in_returns_true_for_opted_in_address(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = self._create_database_with_json_mappings(connection)['database']

			# Act
			for address in NEM_ADDRESSES[:3]:
				# Act:
				is_opted_in = database.is_opted_in(NemAddress(address))

				# Assert:
				self.assertTrue(is_opted_in)

	def test_is_opted_in_returns_false_for_not_opted_in_address(self):
		# Arrange:
		other_nem_addresses = NEM_ADDRESSES[3:] + [
			'NDBRUFE7R5OANEDE43VCTMUVRHTI6XZ7TQFVNTMU', 'NC64UFOWRO6AVMWFV2BFX2NT6W2GURK2EOX6FFMZ',
			'NCES7OKBYZRCSTSNRX45H6E67J6OXABKNT6IRD2P'
		]
		with sqlite3.connect(':memory:') as connection:
			database = self._create_database_with_json_mappings(connection)['database']

			# Act
			for address in other_nem_addresses:
				# Act:
				is_opted_in = database.is_opted_in(NemAddress(address))

				# Assert:
				self.assertFalse(is_opted_in)

	# endregion

	# region optin_transaction_heights

	def test_can_retrieve_optin_transaction_heights(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = self._create_database_with_json_mappings(connection, False)['database']

			# Act:
			heights = database.optin_transaction_heights()

			# Assert
			self.assertEqual(set([123, 456, 789, 333]), heights)

	# endregion
