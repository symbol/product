import sqlite3
import unittest

from symbolchain.CryptoTypes import Hash256
from symbolchain.nem.Network import Address as NemAddress
from symbolchain.symbol.Network import Address as SymbolAddress

from puller.db.CompletedOptinDatabase import CompletedOptinDatabase

from ..test.DatabaseTestUtils import get_all_table_names
from ..test.OptinRequestTestUtils import HASHES, NEM_ADDRESSES, SYMBOL_ADDRESSES


class CompletedOptinDatabaseTest(unittest.TestCase):
	# region create

	def test_can_create_tables(self):
		# Act:
		table_names = get_all_table_names(CompletedOptinDatabase)

		# Assert:
		self.assertEqual(set(['optin_id', 'nem_source', 'nem_transactions', 'symbol_destination']), table_names)

	# endregion

	# region insert_mapping - valid

	def _assert_db_contents(self, connection, expected_optin_count, expected_data):
		cursor = connection.cursor()
		cursor.execute('''SELECT COUNT(*) FROM optin_id''')
		optin_count = cursor.fetchone()[0]

		cursor.execute('''SELECT attribute_flags, label FROM optin_id ORDER BY id''')
		flags_and_label = cursor.fetchall()

		cursor.execute('''SELECT * FROM nem_source ORDER BY balance DESC''')
		nem_sources = cursor.fetchall()

		cursor.execute('''SELECT * FROM nem_transactions ORDER BY address,nem_tx_hash DESC''')
		nem_transactions = cursor.fetchall()

		cursor.execute('''SELECT * FROM symbol_destination ORDER BY balance DESC''')
		symbol_destinations = cursor.fetchall()

		# Assert:
		self.assertEqual(expected_optin_count, optin_count)
		self.assertEqual(expected_data['flags_labels'], flags_and_label)
		self.assertEqual(expected_data['nem_sources'], nem_sources)
		self.assertEqual(expected_data['nem_transactions'], nem_transactions)
		self.assertEqual(expected_data['symbol_destinations'], symbol_destinations)

	def _assert_can_insert_mappings(self, one_or_more_mappings, expected_nem_sources, expected_flags_labels, expected_symbol_destinations):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			mappings = one_or_more_mappings if isinstance(one_or_more_mappings, list) else [one_or_more_mappings]

			database = CompletedOptinDatabase(connection)
			database.create_tables()

			# Act:
			for mapping in mappings:
				database.insert_mapping(*mapping)

			# Assert:
			self._assert_db_contents(connection, len(mappings), {
				'flags_labels': expected_flags_labels,
				'nem_sources': expected_nem_sources,
				'nem_transactions': [],
				'symbol_destinations': expected_symbol_destinations
			})

	def test_can_insert_one_to_one_with_matching_balances(self):
		self._assert_can_insert_mappings((
			{NEM_ADDRESSES[0]: 558668349881393},
			{SYMBOL_ADDRESSES[0]: 558668349881393}
		), [
			(NemAddress(NEM_ADDRESSES[0]).bytes, 558668349881393, 1)
		], [
			(1, None)
		], [
			(SymbolAddress(SYMBOL_ADDRESSES[0]).bytes, 558668349881393, 1)
		])

	def test_can_insert_merge_with_matching_balances(self):
		self._assert_can_insert_mappings((
			{NEM_ADDRESSES[0]: 43686866144523, NEM_ADDRESSES[1]: 16108065258303},
			{SYMBOL_ADDRESSES[0]: 59794931402826}
		), [
			(NemAddress(NEM_ADDRESSES[0]).bytes, 43686866144523, 1),
			(NemAddress(NEM_ADDRESSES[1]).bytes, 16108065258303, 1)
		], [
			(1, None)
		], [
			(SymbolAddress(SYMBOL_ADDRESSES[0]).bytes, 59794931402826, 1)
		])

	def test_can_insert_multi_with_matching_balances(self):
		self._assert_can_insert_mappings((
			{NEM_ADDRESSES[0]: 43686866144523, NEM_ADDRESSES[1]: 16108065258303},
			{SYMBOL_ADDRESSES[0]: 33686866144523, SYMBOL_ADDRESSES[1]: 26108065200000, SYMBOL_ADDRESSES[2]: 58303},
		), [
			(NemAddress(NEM_ADDRESSES[0]).bytes, 43686866144523, 1),
			(NemAddress(NEM_ADDRESSES[1]).bytes, 16108065258303, 1)
		], [
			(1, None)
		], [
			(SymbolAddress(SYMBOL_ADDRESSES[0]).bytes, 33686866144523, 1),
			(SymbolAddress(SYMBOL_ADDRESSES[1]).bytes, 26108065200000, 1),
			(SymbolAddress(SYMBOL_ADDRESSES[2]).bytes, 58303, 1)
		])

	def test_can_insert_multiple_mappings_with_matching_balances(self):
		self._assert_can_insert_mappings([
			(
				{NEM_ADDRESSES[0]: 558668349881393},
				{SYMBOL_ADDRESSES[0]: 558668349881393}
			),
			(
				{NEM_ADDRESSES[1]: 43686866144523, NEM_ADDRESSES[2]: 16108065258303},
				{SYMBOL_ADDRESSES[1]: 33686866144523, SYMBOL_ADDRESSES[2]: 26108065200000, SYMBOL_ADDRESSES[3]: 58303},
			)
		], [
			(NemAddress(NEM_ADDRESSES[0]).bytes, 558668349881393, 1),
			(NemAddress(NEM_ADDRESSES[1]).bytes, 43686866144523, 2),
			(NemAddress(NEM_ADDRESSES[2]).bytes, 16108065258303, 2)
		], [
			(1, None),
			(1, None)
		], [
			(SymbolAddress(SYMBOL_ADDRESSES[0]).bytes, 558668349881393, 1),
			(SymbolAddress(SYMBOL_ADDRESSES[1]).bytes, 33686866144523, 2),
			(SymbolAddress(SYMBOL_ADDRESSES[2]).bytes, 26108065200000, 2),
			(SymbolAddress(SYMBOL_ADDRESSES[3]).bytes, 58303, 2)
		])

	# endregion

	# region insert_mapping - invalid mismatched balances

	def _assert_cannot_insert_last_mapping(self, one_or_more_mappings, expected_error=ValueError):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			mappings = one_or_more_mappings if isinstance(one_or_more_mappings, list) else [one_or_more_mappings]

			database = CompletedOptinDatabase(connection)
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
			{SYMBOL_ADDRESSES[0]: 558668349881393}
		))

	def test_cannot_insert_merge_without_matching_balances(self):
		self._assert_cannot_insert_last_mapping((
			{NEM_ADDRESSES[0]: 43686866144523, NEM_ADDRESSES[1]: 16108065258303},
			{SYMBOL_ADDRESSES[0]: 59794941402826}
		))

	def test_cannot_insert_multi_without_matching_balances(self):
		self._assert_cannot_insert_last_mapping((
			{NEM_ADDRESSES[0]: 43686866144523, NEM_ADDRESSES[1]: 16108065258303},
			{SYMBOL_ADDRESSES[0]: 33686866144523, SYMBOL_ADDRESSES[1]: 26108065200000, SYMBOL_ADDRESSES[2]: 56303}
		))

	# endregion

	# region insert_mapping - constraints

	def test_can_map_multiple_sources_to_same_destination(self):
		self._assert_can_insert_mappings([
			(
				{NEM_ADDRESSES[0]: 43686866144523},
				{SYMBOL_ADDRESSES[0]: 43686866144523}
			),
			(
				{NEM_ADDRESSES[1]: 16108065258303},
				{SYMBOL_ADDRESSES[0]: 16108065258303}
			)
		], [
			(NemAddress(NEM_ADDRESSES[0]).bytes, 43686866144523, 1),
			(NemAddress(NEM_ADDRESSES[1]).bytes, 16108065258303, 2)
		], [
			(1, None),
			(1, None)
		], [
			(SymbolAddress(SYMBOL_ADDRESSES[0]).bytes, 43686866144523, 1),
			(SymbolAddress(SYMBOL_ADDRESSES[0]).bytes, 16108065258303, 2)
		])

	def test_cannot_map_same_source_multiple_times(self):
		self._assert_cannot_insert_last_mapping([
			(
				{NEM_ADDRESSES[0]: 43686866144523},
				{SYMBOL_ADDRESSES[0]: 43686866144523}
			),
			(
				{NEM_ADDRESSES[0]: 16108065258303},
				{SYMBOL_ADDRESSES[1]: 16108065258303}
			)
		], sqlite3.IntegrityError)

	# endregion

	# region insert_mappings_from_json

	@staticmethod
	def _create_database_with_json_mappings(connection, remove_nem_transactions=True):
		database = CompletedOptinDatabase(connection)
		database.create_tables()
		entry_1 = {
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
				{'sym-address': SYMBOL_ADDRESSES[0], 'sym-balance': 558668349881393}
			]
		}

		entry_2 = {
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
				{'sym-address': SYMBOL_ADDRESSES[1], 'sym-balance': 33686866144523},
				{'sym-address': SYMBOL_ADDRESSES[2], 'sym-balance': 26108065200000},
				{'sym-address': SYMBOL_ADDRESSES[3], 'sym-balance': 58303}
			],
			'destination_total': 0  # in original json but ignored
		}

		json_data = [
			{
				'info': 'comment that should be ignored'
			},
			entry_1,
			entry_2
		]

		if remove_nem_transactions:
			for entry in json_data:
				if 'source' not in entry:
					continue
				for source in entry['source']:
					del source['transactions']

		# Act:
		collected = []
		for entry in database.insert_mappings_from_json(json_data, False):
			collected.append(entry)

		return {
			'database': database,
			'collected': collected,
			'entries': [entry_1, entry_2]
		}

	def test_can_insert_mappings_from_json_without_transactinos(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			# Act:
			state = self._create_database_with_json_mappings(connection)

			# Assert:
			self._assert_db_contents(connection, 2, {
				'flags_labels': [
					(0, 'test-label'),
					(0, None)
				],
				'nem_sources': [
					(NemAddress(NEM_ADDRESSES[0]).bytes, 558668349881393, 1),
					(NemAddress(NEM_ADDRESSES[1]).bytes, 43686866144523, 2),
					(NemAddress(NEM_ADDRESSES[2]).bytes, 16108065258303, 2)
				],
				'nem_transactions': [],
				'symbol_destinations': [
					(SymbolAddress(SYMBOL_ADDRESSES[0]).bytes, 558668349881393, 1),
					(SymbolAddress(SYMBOL_ADDRESSES[1]).bytes, 33686866144523, 2),
					(SymbolAddress(SYMBOL_ADDRESSES[2]).bytes, 26108065200000, 2),
					(SymbolAddress(SYMBOL_ADDRESSES[3]).bytes, 58303, 2)
				]})

			self.assertEqual(state['entries'], state['collected'])

	def test_can_insert_mappings_from_json_with_transactions(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			# Act:
			state = self._create_database_with_json_mappings(connection, False)

			# Assert:
			self._assert_db_contents(connection, 2, {
				'flags_labels': [
					(0, 'test-label'),
					(0, None)
				],
				'nem_sources': [
					(NemAddress(NEM_ADDRESSES[0]).bytes, 558668349881393, 1),
					(NemAddress(NEM_ADDRESSES[1]).bytes, 43686866144523, 2),
					(NemAddress(NEM_ADDRESSES[2]).bytes, 16108065258303, 2)
				],
				'nem_transactions': [
					(NemAddress(NEM_ADDRESSES[0]).bytes, Hash256(HASHES[2]).bytes, 456),
					(NemAddress(NEM_ADDRESSES[0]).bytes, Hash256(HASHES[3]).bytes, 123),
					(NemAddress(NEM_ADDRESSES[1]).bytes, Hash256(HASHES[1]).bytes, 789),
					(NemAddress(NEM_ADDRESSES[2]).bytes, Hash256(HASHES[0]).bytes, 333),
				],
				'symbol_destinations': [
					(SymbolAddress(SYMBOL_ADDRESSES[0]).bytes, 558668349881393, 1),
					(SymbolAddress(SYMBOL_ADDRESSES[1]).bytes, 33686866144523, 2),
					(SymbolAddress(SYMBOL_ADDRESSES[2]).bytes, 26108065200000, 2),
					(SymbolAddress(SYMBOL_ADDRESSES[3]).bytes, 58303, 2)
				]})

			self.assertEqual(state['entries'], state['collected'])

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
