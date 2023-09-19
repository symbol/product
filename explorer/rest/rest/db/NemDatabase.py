from binascii import hexlify

from symbolchain.CryptoTypes import PublicKey
from symbolchain.nem.Network import Address

from rest.model.Block import BlockView
from rest.model.Mosaic import MosaicView
from rest.model.Namespace import NamespaceView

from .DatabaseConnection import DatabaseConnectionPool


def _format_bytes(buffer):
	return hexlify(buffer).decode('utf8').upper()


def _format_xem_relative(amount):
	return amount / (10 ** 6)


def _format_relative(amount, divisibility):
	return amount / (10 ** divisibility)


class NemDatabase(DatabaseConnectionPool):
	"""Database containing Nem blockchain data."""

	def __init__(self, db_config, network):
		super().__init__(db_config)
		self.network = network

	def _create_block_view(self, result):
		harvest_public_key = PublicKey(_format_bytes(result[6]))
		return BlockView(
			height=result[0],
			timestamp=str(result[1]),
			total_fees=_format_xem_relative(result[2]),
			total_transactions=result[3],
			difficulty=result[4],
			block_hash=_format_bytes(result[5]),
			signer=self.network.public_key_to_address(harvest_public_key),
			signature=_format_bytes(result[7]),
			size=result[8]
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

	def _create_mosaic_view(self, result):
		levy_types = {
			1: 'absolute fee',
			2: 'percentile'
		}

		creator_public_key = PublicKey(_format_bytes(result[2]))
		levy_type = levy_types.get(result[8], None)
		levy_fee = _format_relative(result[11], result[10]) if levy_type else None

		return MosaicView(
			namespace_name=result[0],
			description=result[1],
			creator=self.network.public_key_to_address(creator_public_key),
			registered_height=result[3],
			initial_supply=result[4],
			divisibility=result[5],
			supply_mutable=result[6],
			transferable=result[7],
			levy_type=levy_type,
			levy_namespace=result[9],
			levy_fee=levy_fee,
			levy_recipient=Address(result[12]) if result[12] else None
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
				ORDER BY height {sort}
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

	def get_mosaic(self, namespace_name):
		"""Gets mosaic by namespace name in database."""

		with self.connection() as connection:
			cursor = connection.cursor()
			cursor.execute('''
				SELECT
					m1.namespace_name,
					m1.description,
					m1.creator,
					m1.registered_height,
					m1.initial_supply,
					m1.divisibility,
					m1.supply_mutable,
					m1.transferable,
					m1.levy_type,
					m1.levy_namespace_name,
					CASE
						WHEN m1.levy_namespace_name = 'nem.xem' THEN 6
						WHEN m1.levy_namespace_name IS NULL THEN NULL
						ELSE m2.divisibility
					END AS levy_namespace_divisibility,
					m1.levy_fee,
					m1.levy_recipient
				FROM mosaics m1
				LEFT JOIN mosaics m2 ON m1.levy_namespace_name = m2.namespace_name AND m1.levy_namespace_name IS NOT NULL
				WHERE m1.namespace_name = %s
			''', (namespace_name,))
			result = cursor.fetchone()

			return self._create_mosaic_view(result) if result else None

	def get_mosaics(self, limit, offset, sort):
		"""Gets mosaics pagination in database."""

		with self.connection() as connection:
			cursor = connection.cursor()
			cursor.execute(f'''
				SELECT
					m1.namespace_name,
					m1.description,
					m1.creator,
					m1.registered_height,
					m1.initial_supply,
					m1.divisibility,
					m1.supply_mutable,
					m1.transferable,
					m1.levy_type,
					m1.levy_namespace_name,
					CASE
						WHEN m1.levy_namespace_name = 'nem.xem' THEN 6
						WHEN m1.levy_namespace_name IS NULL THEN NULL
						ELSE m2.divisibility
					END AS levy_namespace_divisibility,
					m1.levy_fee,
					m1.levy_recipient
				FROM mosaics m1
				LEFT JOIN mosaics m2 ON m1.levy_namespace_name = m2.namespace_name AND m1.levy_namespace_name IS NOT NULL
				ORDER BY m1.id {sort}
				LIMIT %s OFFSET %s
			''', (limit, offset,))
			results = cursor.fetchall()

			return [self._create_mosaic_view(result) for result in results]
