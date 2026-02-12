from binascii import hexlify

from symbolchain.CryptoTypes import PublicKey
from symbolchain.nem.Network import Address

from rest.model.Account import AccountView
from rest.model.Block import BlockView

from .DatabaseConnection import DatabaseConnectionPool


def _format_bytes(buffer):
	return hexlify(buffer).decode('utf8').upper()


def _format_xem_relative(amount):
	return amount / (10 ** 6)


class NemDatabase(DatabaseConnectionPool):
	"""Database containing Nem blockchain data."""

	def __init__(self, db_config, network):
		super().__init__(db_config)
		self.network = network

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

	def _create_account_view(self, result):  # pylint: disable=no-self-use,too-many-locals
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

	def _generate_account_query(self, where_condition, order_condition='', limit_condition=''):  # pylint: disable=no-self-use
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

		with self.connection() as connection:
			cursor = connection.cursor()
			cursor.execute('''
				SELECT *
				FROM blocks
				WHERE height = %s
			''', (height,))
			result = cursor.fetchone()

			return self._create_block_view(result) if result else None

	def get_blocks(self, pagination, min_height, sort):
		"""Gets blocks pagination in database."""

		with self.connection() as connection:
			cursor = connection.cursor()
			cursor.execute(f'''
				SELECT *
				FROM blocks
				WHERE height >= %s
				ORDER BY id {sort}
				LIMIT %s OFFSET %s
			''', (min_height, pagination.limit, pagination.offset,))
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
