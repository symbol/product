from rest.db.DatabaseConnection import DatabaseConnection
from rest.utils.DataTransformer import DataTransformer


class NemDatabase(DatabaseConnection):
	"""Database containing Nem blockchain data."""

	def get_block(self, height):
		"""Gets block by height in database."""

		cursor = self.connection.cursor()
		cursor.execute('''SELECT * FROM blocks WHERE height = %s''', (height,))
		result = cursor.fetchone()
		return DataTransformer.convert_memoryview_to_hex([result])[0] if result else None

