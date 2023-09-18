from binascii import hexlify

from symbolchain.CryptoTypes import PublicKey
from symbolchain.nem.Network import Network
from symbolchain.Network import NetworkLocator

from rest.model.Block import BlockView
from rest.model.Namespace import NamespaceView

from .DatabaseConnection import DatabaseConnectionPool


def _format_bytes(buffer):
	return hexlify(buffer).decode('utf8').upper()


def _format_xem_relative(amount):
	return amount / (10 ** 6)


class NemDatabase(DatabaseConnectionPool):
	"""Database containing Nem blockchain data."""

	def __init__(self, db_config, network_name):
		super().__init__(db_config)
		self.network = NetworkLocator.find_by_name(Network.NETWORKS, network_name)

	def _create_block_view(self, result):
		harvest_public_key = PublicKey(_format_bytes(result[7]))
		return BlockView(
			height=result[1],
			timestamp=str(result[2]),
			total_fees=_format_xem_relative(result[3]),
			total_transactions=result[4],
			difficulty=result[5],
			block_hash=_format_bytes(result[6]),
			signer=self.network.public_key_to_address(harvest_public_key),
			signature=_format_bytes(result[8]),
			size=result[9]
		)

	def _create_namespace_view(self, result):
		owner_public_key = PublicKey(_format_bytes(result[1]))
		return NamespaceView(
			root_namespace=result[0],
			owner=self.network.public_key_to_address(owner_public_key),
			registered_height=result[2],
			expiration_height=result[3],
			sub_namespaces=result[4]
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

	def get_namespace(self, root_namespace):
		"""Gets namespace by name in database."""

		with self.connection() as connection:
			cursor = connection.cursor()
			cursor.execute('''
				SELECT
					root_namespace,
					owner,
					registered_height,
					expiration_height,
					sub_namespaces
				FROM namespaces
				WHERE root_namespace = %s
			''', (root_namespace,))
			result = cursor.fetchone()

			return self._create_namespace_view(result) if result else None

	def get_namespaces(self, limit, offset, sort):
		"""Gets namespaces pagination in database."""

		with self.connection() as connection:
			cursor = connection.cursor()
			cursor.execute(f'''
				SELECT
					root_namespace,
					owner,
					registered_height,
					expiration_height,
					sub_namespaces
				FROM namespaces
				ORDER BY id {sort}
				LIMIT %s OFFSET %s
			''', (limit, offset,))
			results = cursor.fetchall()

			return [self._create_namespace_view(result) for result in results]
