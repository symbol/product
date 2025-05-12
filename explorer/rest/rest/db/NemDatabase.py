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

	def _generate_namespace_sql_query(self, where_condition=None):  # pylint: disable=no-self-use
		"""Base SQL query for namespaces."""

		where_clause = f'WHERE {where_condition}' if where_condition else ''

		return f'''
			SELECT
				n.id,
				n.root_namespace,
				n.owner,
				n.registered_height,
				b1.timestamp AS registered_timestamp,
				n.expiration_height,
				n.sub_namespaces,
				CASE
					WHEN COUNT(m.namespace_name) = 0 THEN '[]'
					ELSE json_agg(json_build_object(
						'namespace_name', namespace_name,
						'total_supply', m.total_supply,
						'divisibility', m.divisibility,
						'registered_height', m.registered_height,
						'registered_timestamp', b2.timestamp
					))
				END AS mosaics
			FROM namespaces n
			LEFT JOIN mosaics m
				ON n.root_namespace = m.root_namespace
			LEFT JOIN blocks b1
				ON n.registered_height = b1.height
			LEFT JOIN blocks b2
				ON m.registered_height = b2.height
			{where_clause}
			GROUP BY
				n.id,
				n.root_namespace,
				n.owner,
				n.registered_height,
				b1.timestamp,
				n.expiration_height,
				n.sub_namespaces
		'''

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
		owner_public_key = PublicKey(_format_bytes(result[2]))

		mosaics = []

		if result[7] != []:
			# Formatting mosaics info
			for mosaic in result[7]:
				namespace_mosaic_name = mosaic['namespace_name'].split('.')
				namespace_name = '.'.join(namespace_mosaic_name[:-1])
				mosaic_name = namespace_mosaic_name[-1]

				mosaics.append({
					'namespaceName': namespace_name,
					'mosaicName': mosaic_name,
					'totalSupply': mosaic['total_supply'],
					'divisibility': mosaic['divisibility'],
					'registeredHeight': mosaic['registered_height'],
					'registeredTimestamp': mosaic['registered_timestamp'].replace('T', ' ')
				})

		return NamespaceView(
			root_namespace=result[1],
			owner=self.network.public_key_to_address(owner_public_key),
			registered_height=result[3],
			registered_timestamp=str(result[4]),
			expiration_height=result[5],
			sub_namespaces=result[6],
			mosaics=mosaics
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

	def get_namespace(self, namespace):
		"""Gets namespace by name in database."""

		sql = self._generate_namespace_sql_query(
			'n.root_namespace = %s or %s = ANY(n.sub_namespaces)'
		)
		params = (namespace, namespace)

		with self.connection() as connection:
			cursor = connection.cursor()
			cursor.execute(sql, params)
			result = cursor.fetchone()

			return self._create_namespace_view(result) if result else None

	def get_namespaces(self, limit, offset, sort):
		"""Gets namespaces pagination in database."""

		sql = self._generate_namespace_sql_query()
		sql += f'''
			ORDER BY n.id {sort}
			LIMIT %s OFFSET %s
		'''
		params = (limit, offset)

		with self.connection() as connection:
			cursor = connection.cursor()
			cursor.execute(sql, params)
			results = cursor.fetchall()

			return [self._create_namespace_view(result) for result in results]
