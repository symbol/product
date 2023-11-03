from binascii import hexlify

from rest.model.Block import BlockView

from .DatabaseConnection import DatabaseConnectionPool


def _format_bytes(buffer):
	return hexlify(buffer).decode('utf8').upper()


class NemDatabase(DatabaseConnectionPool):
	"""Database containing Nem blockchain data."""

	@staticmethod
	def _create_block_view(result):
		return BlockView(
			height=result[1],
			timestamp=str(result[2]),
			total_fees=result[3],
			total_transactions=result[4],
			difficulty=result[5],
			block_hash=_format_bytes(result[6]),
			signer=_format_bytes(result[7]),
			signature=_format_bytes(result[8]),
			size=result[9]
		)

	def get_block(self, height):
		"""Gets block by height in database."""

		with self.connection() as connection:
			cursor = connection.cursor()
			cursor.execute('''
				SELECT *
				FROM blocks
				WHERE height = %s
			''', (height,))
			result = cursor.fetchone()

			return self._create_block_view(result) if result else None

	def get_blocks(self, limit, offset, min_height, sort):
		"""Gets blocks pagination in database."""

		with self.connection() as connection:
			cursor = connection.cursor()
			cursor.execute(f'''
				SELECT *
				FROM blocks
				WHERE height >= %s
				ORDER BY id {sort}
				LIMIT %s OFFSET %s
			''', (min_height, limit, offset,))
			results = cursor.fetchall()

			return [self._create_block_view(result) for result in results]
