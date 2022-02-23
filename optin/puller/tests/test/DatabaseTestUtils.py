import sqlite3


def get_all_table_names(database_class):
	# Arrange:
	with sqlite3.connect(':memory:') as connection:
		database = database_class(connection)

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
