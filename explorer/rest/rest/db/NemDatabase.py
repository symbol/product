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
			height=result[0],
			timestamp=str(result[1]),
			total_fees=result[2],
			total_transactions=result[3],
			difficulty=result[4],
			block_hash=_format_bytes(result[5]),
			signer=_format_bytes(result[6]),
			signature=_format_bytes(result[7])
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

	def get_blocks(self, limit, offset, min_height):
		"""Gets blocks pagination in database."""

		with self.connection() as connection:
			cursor = connection.cursor()
			cursor.execute('''
				SELECT *
				FROM blocks
				WHERE height >= %s
				LIMIT %s OFFSET %s
			''', (min_height, limit, offset,))
			results = cursor.fetchall()

			return [self._create_block_view(result) for result in results]
