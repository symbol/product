from binascii import hexlify

from rest.db.DatabaseConnection import DatabaseConnectionPool


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

			return {
				'height': result[0],
				'timestamp': result[1],
				'total_fees': result[2],
				'total_transactions': result[3],
				'difficulty': result[4],
				'block_hash': _format_bytes(result[5]),
				'signer': _format_bytes(result[6]),
				'signature': _format_bytes(result[7])
			} if result else None

	def get_blocks(self, limit, offset):
		"""Gets blocks pagination in database."""

		with self.connection() as conn:
			cursor = conn.cursor()
			cursor.execute('''
				SELECT *
				FROM blocks
				LIMIT %s OFFSET %s
			''', (limit, offset,))
			results = cursor.fetchall()

			return [{
				'height': result[0],
				'timestamp': result[1],
				'total_fees': result[2],
				'total_transactions': result[3],
				'difficulty': result[4],
				'block_hash': _format_bytes(result[5]),
				'signer': _format_bytes(result[6]),
				'signature': _format_bytes(result[7])
			} for result in results]
