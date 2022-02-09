import sqlite3
import unittest

from puller.db.OptinDatabase import OptinDatabase

NEM_ADDRESSES = [
	'NBMUCRGBBF7LIVQWS2AHYOEAM7NMSDHJX7SQ54GJ',
	'NBUPC3R7PU23FTDD53KNJAFVAOXJPXEHTSHG7TBX',
	'ND4RNHKOOWJGRTC6PJWDTYR7MPPKCTKVJWQETKGR'
]


SYMBOL_ADDRESSES = [
	'NCU36L7K7B4I5JP5HHROFVFZYSCKKXWQI6PDT6I',
	'NCLAZCJ36LUDVHNYZPWN67NI4V5E6VZJNZ666XY',
	'NBLVHBI6VOMCI4QV53ZCKV5IRM7ZKCAYZYBECXQ',
	'NCRCD5QSQYXPOFGJS7KJFUKROMHJZLX3JWUEOLY'
]


class OptinDatabaseTest(unittest.TestCase):
	# region create

	def test_can_create_tables(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = OptinDatabase(connection)

			# Act:
			database.create_tables()

			cursor = connection.cursor()
			tables = cursor.execute('''SELECT name FROM sqlite_master
				WHERE type = 'table'
				ORDER BY 1;
			''')
			table_names = set(tuple[0] for tuple in tables)

			# Assert:
			self.assertEqual(set(['optin_id', 'nem_source', 'symbol_destination']), table_names)

	# endregion

	# region insert_mapping - valid

	def _assert_db_contents(self, connection, expected_optin_count, expected_nem_sources, expected_symbol_destinations):
		cursor = connection.cursor()
		cursor.execute('''SELECT COUNT(*) FROM optin_id''')
		optin_count = cursor.fetchone()[0]

		cursor.execute('''SELECT * FROM nem_source ORDER BY balance DESC''')
		nem_sources = cursor.fetchall()

		cursor.execute('''SELECT * FROM symbol_destination ORDER BY balance DESC''')
		symbol_destinations = cursor.fetchall()

		# Assert:
		self.assertEqual(expected_optin_count, optin_count)
		self.assertEqual(expected_nem_sources, nem_sources)
		self.assertEqual(expected_symbol_destinations, symbol_destinations)

	def _assert_can_insert_mappings(self, one_or_more_mappings, expected_nem_sources, expected_symbol_destinations):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			mappings = one_or_more_mappings if isinstance(one_or_more_mappings, list) else [one_or_more_mappings]

			database = OptinDatabase(connection)
			database.create_tables()

			# Act:
			for mapping in mappings:
				database.insert_mapping(*mapping)

			# Assert:
			self._assert_db_contents(connection, len(mappings), expected_nem_sources, expected_symbol_destinations)

	def test_can_insert_one_to_one_with_matching_balances(self):
		self._assert_can_insert_mappings((
			{NEM_ADDRESSES[0]: 558668349881393},
			{SYMBOL_ADDRESSES[0]: 558668349881393}
		), [
			(NEM_ADDRESSES[0], 558668349881393, 1)
		], [
			(SYMBOL_ADDRESSES[0], 558668349881393, 1)
		])

	def test_can_insert_merge_with_matching_balances(self):
		self._assert_can_insert_mappings((
			{NEM_ADDRESSES[0]: 43686866144523, NEM_ADDRESSES[1]: 16108065258303},
			{SYMBOL_ADDRESSES[0]: 59794931402826}
		), [
			(NEM_ADDRESSES[0], 43686866144523, 1),
			(NEM_ADDRESSES[1], 16108065258303, 1)
		], [
			(SYMBOL_ADDRESSES[0], 59794931402826, 1)
		])

	def test_can_insert_multi_with_matching_balances(self):
		self._assert_can_insert_mappings((
			{NEM_ADDRESSES[0]: 43686866144523, NEM_ADDRESSES[1]: 16108065258303},
			{SYMBOL_ADDRESSES[0]: 33686866144523, SYMBOL_ADDRESSES[1]: 26108065200000, SYMBOL_ADDRESSES[2]: 58303},
		), [
			(NEM_ADDRESSES[0], 43686866144523, 1),
			(NEM_ADDRESSES[1], 16108065258303, 1)
		], [
			(SYMBOL_ADDRESSES[0], 33686866144523, 1),
			(SYMBOL_ADDRESSES[1], 26108065200000, 1),
			(SYMBOL_ADDRESSES[2], 58303, 1)
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
			(NEM_ADDRESSES[0], 558668349881393, 1),
			(NEM_ADDRESSES[1], 43686866144523, 2),
			(NEM_ADDRESSES[2], 16108065258303, 2)
		], [
			(SYMBOL_ADDRESSES[0], 558668349881393, 1),
			(SYMBOL_ADDRESSES[1], 33686866144523, 2),
			(SYMBOL_ADDRESSES[2], 26108065200000, 2),
			(SYMBOL_ADDRESSES[3], 58303, 2)
		])

	# endregion

	# region insert_mapping - invalid mismatched balances

	def _assert_cannot_insert_last_mapping(self, one_or_more_mappings, expected_error=ValueError):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			mappings = one_or_more_mappings if isinstance(one_or_more_mappings, list) else [one_or_more_mappings]

			database = OptinDatabase(connection)
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
			(NEM_ADDRESSES[0], 43686866144523, 1),
			(NEM_ADDRESSES[1], 16108065258303, 2)
		], [
			(SYMBOL_ADDRESSES[0], 43686866144523, 1),
			(SYMBOL_ADDRESSES[0], 16108065258303, 2)
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

	def test_can_insert_mappings_from_json(self):
		# Arrange:
		with sqlite3.connect(':memory:') as connection:
			database = OptinDatabase(connection)
			database.create_tables()

			# Act:
			database.insert_mappings_from_json([
				{
					'info': 'comment that should be ignored'
				},
				{
					'source': [
						{'nis-address': NEM_ADDRESSES[0], 'nis-balance': '558668349881393'},
					],
					'type': '1-to-1',
					'destination': [
						{'sym-address': SYMBOL_ADDRESSES[0], 'sym-balance': 558668349881393}
					]
				},
				{
					'source': [
						{'nis-address': NEM_ADDRESSES[1], 'nis-balance': '43686866144523'},
						{'nis-address': NEM_ADDRESSES[2], 'nis-balance': '16108065258303'}
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
			])

			# Assert:
			self._assert_db_contents(connection, 2, [
				(NEM_ADDRESSES[0], 558668349881393, 1),
				(NEM_ADDRESSES[1], 43686866144523, 2),
				(NEM_ADDRESSES[2], 16108065258303, 2)
			], [
				(SYMBOL_ADDRESSES[0], 558668349881393, 1),
				(SYMBOL_ADDRESSES[1], 33686866144523, 2),
				(SYMBOL_ADDRESSES[2], 26108065200000, 2),
				(SYMBOL_ADDRESSES[3], 58303, 2)
			])

	# endregion
