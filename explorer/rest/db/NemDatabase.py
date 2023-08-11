from binascii import hexlify

from rest.db.DatabaseConnection import DatabaseConnectionPool
from rest.model.Block import BlockView


def _format_bytes(buffer):
	return hexlify(buffer).decode('utf8')


class NemDatabase(DatabaseConnectionPool):
	"""Database containing Nem blockchain data."""

	def get_block(self, height):
		"""Gets block by height in database."""

		with self.connection() as conn:
			cursor = conn.cursor()
			cursor.execute('''
				SELECT *
				FROM blocks
				WHERE height = %s
			''', (height,))
			result = cursor.fetchone()

			return BlockView(
				height=result[0],
				timestamp=result[1],
				total_fees=result[2],
				total_transactions=result[3],
				difficulty=result[4],
				block_hash=_format_bytes(result[5]),
				signer=_format_bytes(result[6]),
				signature=_format_bytes(result[7])
			) if result else None

	def get_blocks(self, limit, offset, min_height):
		"""Gets blocks pagination in database."""

		with self.connection() as conn:
			cursor = conn.cursor()
			cursor.execute('''
				SELECT *
				FROM blocks
				WHERE height >= %s
				LIMIT %s OFFSET %s
			''', (min_height, limit, offset,))
			results = cursor.fetchall()

			return [BlockView(
				height=result[0],
				timestamp=result[1],
				total_fees=result[2],
				total_transactions=result[3],
				difficulty=result[4],
				block_hash=_format_bytes(result[5]),
				signer=_format_bytes(result[6]),
				signature=_format_bytes(result[7])
			) for result in results]
