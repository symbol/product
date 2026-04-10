from binascii import hexlify

from symbolchain.CryptoTypes import PublicKey
from symbolchain.nem.Network import Address

from rest.model.Account import AccountView
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
		(
			height,
			timestamp,
			total_fee,
			total_transactions,
			difficulty,
			block_hash,
			beneficiary,
			signer,
			signature,
			size
		) = result

		return BlockView(
			height=height,
			timestamp=str(timestamp),
			total_fees=_format_xem_relative(total_fee),
			total_transactions=total_transactions,
			difficulty=difficulty,
			block_hash=_format_bytes(block_hash),
			beneficiary=str(Address(beneficiary)),
			signer=str(self.network.public_key_to_address(PublicKey(signer))),
			signature=_format_bytes(signature),
			size=size
		)

	@staticmethod
	def _create_account_view(result):  # pylint: disable=too-many-locals
		(
			address,
			public_key,
			remote_address,
			importance,
			balance,
			vested_balance,
			mosaics,
			harvested_fees,
			harvested_blocks,
			status,
			remote_status,
			last_harvested_height,
			min_cosignatories,
			cosignatory_of,
			cosignatories
		) = result

		return AccountView(
			address=str(Address(address)),
			public_key=str(PublicKey(public_key)) if public_key else None,
			remote_address=str(Address(remote_address)) if remote_address else None,
			importance=importance,
			balance=_format_xem_relative(balance),
			vested_balance=_format_xem_relative(vested_balance),
			mosaics=[{
				'namespace_name': mosaic['namespace'],
				'quantity': mosaic['quantity'],
			} for mosaic in mosaics],
			harvested_fees=_format_xem_relative(harvested_fees),
			harvested_blocks=harvested_blocks,
			status=status,
			remote_status=remote_status,
			last_harvested_height=last_harvested_height,
			min_cosignatories=min_cosignatories,
			cosignatory_of=[str(Address(address)) for address in cosignatory_of] if cosignatory_of else None,
			cosignatories=[str(Address(address)) for address in cosignatories] if cosignatories else None
		)

	@staticmethod
	def _create_namespace_view(result):
		(
			root_namespace,
			owner,
			registered_height,
			registered_timestamp,
			expiration_height,
			sub_namespaces
		) = result

		return NamespaceView(
			root_namespace=root_namespace,
			owner=str(PublicKey(owner)),
			registered_height=registered_height,
			registered_timestamp=str(registered_timestamp),
			expiration_height=expiration_height,
			sub_namespaces=sub_namespaces
		)

	def _create_mosaic_view(self, result):  # pylint: disable=too-many-locals
		levy_types = {
			1: 'absolute fee',
			2: 'percentile'
		}

		(
			namespace_name,
			description,
			creator,
			mosaic_registered_height,
			mosaic_registered_timestamp,
			initial_supply,
			total_supply,
			divisibility,
			supply_mutable,
			transferable,
			levy_type,
			levy_namespace_name,
			levy_divisibility,
			levy_fee,
			levy_recipient,
			root_namespace_registered_height,
			root_namespace_registered_timestamp,
			root_namespace_expiration_height
		) = result

		return MosaicView(
			namespace_name=namespace_name,
			description=description,
			creator=str(self.network.public_key_to_address(PublicKey(creator))),
			mosaic_registered_height=mosaic_registered_height,
			mosaic_registered_timestamp=str(mosaic_registered_timestamp),
			initial_supply=initial_supply,
			total_supply=total_supply,
			divisibility=divisibility,
			supply_mutable=supply_mutable,
			transferable=transferable,
			levy_type=levy_types.get(levy_type, None),
			levy_namespace_name=levy_namespace_name,
			levy_fee=_format_relative(levy_fee, levy_divisibility) if levy_type else None,
			levy_recipient=str(Address(levy_recipient)) if levy_recipient else None,
			root_namespace_registered_height=root_namespace_registered_height,
			root_namespace_registered_timestamp=str(root_namespace_registered_timestamp),
			root_namespace_expiration_height=root_namespace_expiration_height,
		)

	@staticmethod
	def _generate_account_query(where_condition, order_condition='', limit_condition=''):
		"""Base account query."""

		return f'''
			SELECT
				address,
				public_key,
				remote_address,
				importance::float,
				balance,
				vested_balance,
				mosaics,
				harvested_fees,
				harvested_blocks,
				status,
				remote_status,
				last_harvested_height,
				min_cosignatories,
				cosignatory_of,
				cosignatories
			FROM accounts
			{where_condition}
			{order_condition}
			{limit_condition}
		'''

	@staticmethod
	def _generate_block_query(where_condition, order_condition='', limit_condition=''):
		"""Base block query."""

		return f'''
			SELECT
				height,
				timestamp,
				total_fee,
				total_transactions,
				difficulty,
				hash,
				beneficiary,
				signer,
				signature,
				size
			FROM blocks
			{where_condition}
			{order_condition}
			{limit_condition}
		'''

	@staticmethod
	def _generate_namespace_query(where_condition='', order_condition='', limit_condition=''):
		"""Base namespace query."""

		return f'''
			SELECT
				root_namespace,
				owner,
				registered_height,
				b.timestamp AS registered_timestamp,
				expiration_height ,
				sub_namespaces
			FROM namespaces n
			left join blocks b
				on n.registered_height = b.height
			{where_condition}
			{order_condition}
			{limit_condition}
		'''

	@staticmethod
	def _generate_mosaic_query(where_condition='', order_condition='', limit_condition=''):
		"""Base mosaic query."""

		return f'''
			SELECT
				m.namespace_name,
				m.description,
				m.creator,
				m.registered_height AS mosaic_registered_height,
				m_block.timestamp AS mosaic_registered_timestamp,
				m.initial_supply,
				m.total_supply,
				m.divisibility,
				m.supply_mutable,
				m.transferable,
				m.levy_type,
				m.levy_namespace_name,
				CASE
					WHEN m.levy_namespace_name = 'nem.xem' THEN 6
					ELSE levy.divisibility
				END AS levy_divisibility,
				m.levy_fee,
				m.levy_recipient,
				ns.registered_height AS root_namespace_registered_height,
				ns_block.timestamp AS root_namespace_registered_timestamp,
				ns.expiration_height AS root_namespace_expiration_height
			FROM mosaics m
			LEFT JOIN mosaics levy
				ON levy.namespace_name = m.levy_namespace_name
			LEFT JOIN namespaces ns
				ON ns.root_namespace = m.root_namespace
			LEFT JOIN blocks ns_block
				ON ns_block.height = ns.registered_height
			LEFT JOIN blocks m_block
				ON m_block.height = m.registered_height
			{where_condition}
			{order_condition}
			{limit_condition}
		'''

	def _get_account(self, where_condition, query_bytes):
		"""Gets account by where clause."""

		sql = self._generate_account_query(where_condition=where_condition)

		with self.connection() as connection:
			cursor = connection.cursor()
			cursor.execute(sql, (query_bytes,))
			result = cursor.fetchone()

			return self._create_account_view(result) if result else None

	def get_block(self, height):
		"""Gets block by height in database."""

		where_condition = 'WHERE height = %s'

		sql = self._generate_block_query(where_condition)

		with self.connection() as connection:
			cursor = connection.cursor()
			cursor.execute(sql, (height,))
			result = cursor.fetchone()

			return self._create_block_view(result) if result else None

	def get_blocks(self, pagination, min_height, sort):
		"""Gets blocks pagination in database."""

		where_condition = ' WHERE height >= %s'
		order_condition = f' ORDER BY id {sort}'
		limit_condition = ' LIMIT %s OFFSET %s'

		sql = self._generate_block_query(
			where_condition=where_condition,
			order_condition=order_condition,
			limit_condition=limit_condition
		)

		params = [min_height, pagination.limit, pagination.offset]

		with self.connection() as connection:
			cursor = connection.cursor()
			cursor.execute(sql, params)
			results = cursor.fetchall()

			return [self._create_block_view(result) for result in results]

	def get_account_by_address(self, address):
		"""Gets account by address."""

		where_condition = 'WHERE address = %s'

		return self._get_account(where_condition, address.bytes)

	def get_account_by_public_key(self, public_key):
		"""Gets account by public key."""

		where_condition = 'WHERE public_key = %s'

		return self._get_account(where_condition, public_key.bytes)

	def get_accounts(self, pagination, sorting, is_harvesting):
		"""Gets accounts pagination in database."""

		where_condition = " WHERE remote_status = 'ACTIVE' " if is_harvesting else ''
		order_condition = f' ORDER BY {sorting.field} {sorting.order} '
		limit_condition = ' LIMIT %s OFFSET %s'

		params = [pagination.limit, pagination.offset]

		sql = self._generate_account_query(limit_condition=limit_condition, order_condition=order_condition, where_condition=where_condition)

		with self.connection() as connection:
			cursor = connection.cursor()
			cursor.execute(sql, params)
			results = cursor.fetchall()

			return [self._create_account_view(result) for result in results]

	def get_namespace_by_name(self, name):
		"""Gets namespace by root namespace or sub namespace name."""

		where_condition = 'WHERE n.root_namespace = %s or %s = ANY(n.sub_namespaces)'

		sql = self._generate_namespace_query(where_condition)

		with self.connection() as connection:
			cursor = connection.cursor()
			cursor.execute(sql, (name, name))
			result = cursor.fetchone()

			return self._create_namespace_view(result) if result else None

	def get_namespaces(self, pagination, sort):
		"""Gets namespaces pagination in database."""

		order_condition = f' ORDER BY registered_height {sort}'
		limit_condition = ' LIMIT %s OFFSET %s'

		sql = self._generate_namespace_query(
			order_condition=order_condition,
			limit_condition=limit_condition
		)

		params = [pagination.limit, pagination.offset]

		with self.connection() as connection:
			cursor = connection.cursor()
			cursor.execute(sql, params)
			results = cursor.fetchall()

			return [self._create_namespace_view(result) for result in results]

	def get_mosaic_by_name(self, namespace_name):
		"""Gets mosaic by namespace name in database."""

		where_condition = 'WHERE m.namespace_name = %s'

		sql = self._generate_mosaic_query(where_condition=where_condition)

		with self.connection() as connection:
			cursor = connection.cursor()
			cursor.execute(sql, (namespace_name,))
			result = cursor.fetchone()

			return self._create_mosaic_view(result) if result else None

	def get_mosaics(self, pagination, sort):
		"""Gets mosaics pagination in database."""

		order_condition = f' ORDER BY m.registered_height {sort}'
		limit_condition = ' LIMIT %s OFFSET %s'

		sql = self._generate_mosaic_query(order_condition=order_condition, limit_condition=limit_condition)

		params = [pagination.limit, pagination.offset]

		with self.connection() as connection:
			cursor = connection.cursor()
			cursor.execute(sql, params)
			results = cursor.fetchall()

			return [self._create_mosaic_view(result) for result in results]
