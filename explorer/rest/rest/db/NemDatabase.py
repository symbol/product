# pylint: disable=too-many-lines
from binascii import hexlify

from symbolchain.CryptoTypes import PublicKey
from symbolchain.nc import TransactionType
from symbolchain.nem.Network import Address

from rest.model.common import DEFAULT_HARVESTING_ACTIVE_WINDOW_DAYS
from rest.model.nem.Account import AccountView
from rest.model.nem.Block import BlockView
from rest.model.nem.Mosaic import MosaicRichListView, MosaicView
from rest.model.nem.Namespace import NamespaceView
from rest.model.nem.Statistic import (
	StatisticAccountView,
	StatisticTransactionDateRangeDataView,
	StatisticTransactionDateRangeView,
	StatisticTransactionView
)
from rest.model.nem.Transaction import TransactionRecord, TransactionView

from .DatabaseConnection import DatabaseConnectionPool


def _format_bytes(buffer):
	return hexlify(buffer).decode('utf8').upper()


def _format_address_bytes_to_string(buffer):
	return str(Address(buffer))


def _format_xem_relative(amount):
	return amount / (10 ** 6)


def _format_relative(amount, divisibility):
	return amount / (10 ** divisibility)


class NemDatabase(DatabaseConnectionPool):
	"""Database containing Nem blockchain data."""

	def __init__(self, db_config, network, harvesting_active_window_days=DEFAULT_HARVESTING_ACTIVE_WINDOW_DAYS):
		super().__init__(db_config)
		self.network = network
		self._harvesting_active_window_days = harvesting_active_window_days

	def _format_public_key_to_address(self, public_key):
		return str(self.network.public_key_to_address(PublicKey(public_key)))

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
			beneficiary=_format_address_bytes_to_string(beneficiary),
			signer=self._format_public_key_to_address(signer),
			signature=_format_bytes(signature),
			size=size
		)

	def _create_account_view(self, result, main_address=None):  # pylint: disable=too-many-locals
		(
			address,
			height,
			public_key,
			remote_address,
			importance,
			balance,
			vested_balance,
			mosaics,
			harvested_fees,
			harvested_blocks,
			remote_status,
			last_harvested_height,
			is_harvesting_active,
			min_cosignatories,
			cosignatory_of,
			cosignatories,
			remark
		) = result

		return AccountView(
			address=_format_address_bytes_to_string(address),
			height=height,
			public_key=str(PublicKey(public_key)) if public_key else None,
			remote_address=_format_address_bytes_to_string(remote_address) if remote_address else None,
			main_address=_format_address_bytes_to_string(main_address) if main_address else None,
			importance=importance,
			balance=_format_xem_relative(balance),
			vested_balance=_format_xem_relative(vested_balance),
			mosaics=[{
				'namespace_name': mosaic['namespace_name'],
				'amount': _format_relative(mosaic['quantity'], mosaic['divisibility']),
				'creator': self._format_public_key_to_address(mosaic['creator'])
			} for mosaic in mosaics],
			harvested_fees=_format_xem_relative(harvested_fees),
			harvested_blocks=harvested_blocks,
			remote_status=remote_status,
			last_harvested_height=last_harvested_height,
			is_harvesting_active=is_harvesting_active,
			min_cosignatories=min_cosignatories,
			cosignatory_of=[_format_address_bytes_to_string(address) for address in cosignatory_of] if cosignatory_of else None,
			cosignatories=[_format_address_bytes_to_string(address) for address in cosignatories] if cosignatories else None,
			remark=remark
		)

	@staticmethod
	def _create_account_statistic_view(result):

		(
			total_accounts,
			accounts_with_balance,
			harvested_accounts,
			total_importance,
			eligible_harvest_accounts
		) = result

		return StatisticAccountView(
			total_accounts=total_accounts,
			accounts_with_balance=accounts_with_balance,
			harvested_accounts=harvested_accounts,
			eligible_harvest_accounts=eligible_harvest_accounts,
			total_importance=float(total_importance)
		)

	def _create_namespace_view(self, result):
		(
			root_namespace,
			owner,
			registered_height,
			registered_timestamp,
			expiration_height,
			sub_namespaces,
			mosaics
		) = result

		return NamespaceView(
			root_namespace=root_namespace,
			owner=self._format_public_key_to_address(owner),
			registered_height=registered_height,
			registered_timestamp=str(registered_timestamp),
			expiration_height=expiration_height,
			sub_namespaces=sub_namespaces,
			mosaics=[{
				'namespace_name': mosaic['namespace_name'],
				'total_supply': mosaic['total_supply'],
				'divisibility': mosaic['divisibility'],
				'registered_height': mosaic['registered_height'],
				'registered_timestamp': mosaic['registered_timestamp']
			} for mosaic in mosaics]
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
			creator=self._format_public_key_to_address(creator),
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
			levy_recipient=_format_address_bytes_to_string(levy_recipient) if levy_recipient else None,
			root_namespace_registered_height=root_namespace_registered_height,
			root_namespace_registered_timestamp=str(root_namespace_registered_timestamp),
			root_namespace_expiration_height=root_namespace_expiration_height,
		)

	@staticmethod
	def _create_mosaic_rich_list_view(result):
		(
			address,
			remark,
			balance,
			divisibility
		) = result

		return MosaicRichListView(
			address=_format_address_bytes_to_string(address),
			remark=remark,
			balance=_format_relative(balance, divisibility)
		)

	def _create_transaction_view(self, transaction, inner_transaction=None):
		value = self._build_transaction_payload(transaction.transaction_type, transaction.payload, transaction.mosaics)
		embedded_transaction = []
		from_address = _format_address_bytes_to_string(transaction.from_address)
		to_address = _format_address_bytes_to_string(transaction.to_address) if transaction.to_address else None

		if inner_transaction:
			value = None
			embedded_transaction.append({
				'initiator': _format_address_bytes_to_string(transaction.from_address),
				'transactionHash': _format_bytes(inner_transaction.transaction_hash) if inner_transaction.transaction_hash else None,
				'transactionType': TransactionType(inner_transaction.transaction_type).name,
				'signatures': [{
					'fee': _format_xem_relative(signature['fee']),
					'signature': signature['signature'],
					'signer': self._format_public_key_to_address(signature['sender'])
				} for signature in transaction.payload['signatures']],
				'fee': _format_xem_relative(inner_transaction.fee),
				'value': self._build_transaction_payload(
					inner_transaction.transaction_type,
					inner_transaction.payload,
					inner_transaction.mosaics
				),
			})
			from_address = _format_address_bytes_to_string(inner_transaction.from_address)
			to_address = _format_address_bytes_to_string(inner_transaction.to_address) if inner_transaction.to_address else None

		return TransactionView(
			transaction_hash=_format_bytes(transaction.transaction_hash) if transaction.transaction_hash else None,
			transaction_type=TransactionType(transaction.transaction_type).name,
			from_address=from_address,
			to_address=to_address,
			value=value,
			embedded_transactions=embedded_transaction or None,
			fee=_format_xem_relative(transaction.fee),
			height=transaction.height,
			timestamp=str(transaction.timestamp),
			deadline=str(transaction.deadline),
			signature=_format_bytes(transaction.signature),
			size=transaction.size,
			version=transaction.version
		)

	@staticmethod
	def _create_transaction_statistic_view(result):

		(
			total_transactions,
			transaction_last_24_hours,
			transaction_last_30_days
		) = result

		return StatisticTransactionView(
			total_transactions=total_transactions,
			transaction_last_24_hours=transaction_last_24_hours,
			transaction_last_30_days=transaction_last_30_days
		)

	@staticmethod
	def _create_transaction_date_range_statistic_view(results, period_type):

		return StatisticTransactionDateRangeView(
			period_type=period_type,
			data=[
				StatisticTransactionDateRangeDataView(
					period=period,
					total_transactions=total_transactions
				) for period, total_transactions in results
			]
		)

	@staticmethod
	def _generate_account_query(where_condition, order_condition='', limit_condition=''):
		"""Base account query."""

		return f'''
			SELECT
				a.address,
				a.height,
				public_key,
				remote_address,
				importance::float,
				balance,
				vested_balance,
				COALESCE(am.mosaics, '[]'::json) AS mosaics,
				harvested_fees,
				harvested_blocks,
				remote_status,
				last_harvested_height,
				(a.last_harvested_height >= %s) AS is_harvesting_active,
				min_cosignatories,
				cosignatory_of,
				cosignatories,
				ar.remark
			FROM (
				SELECT * FROM accounts a
				{where_condition}
				{order_condition}
				{limit_condition}
			) a
			LEFT JOIN account_remark ar
				ON ar.address = a.address
			LEFT JOIN LATERAL (
				SELECT json_agg(json_build_object(
					'namespace_name', mosaic.item->>'namespace_name',
					'quantity', (mosaic.item->>'quantity')::bigint,
					'creator', encode(m.creator, 'hex'),
					'divisibility', m.divisibility
				) ORDER BY mosaic.ordinality) AS mosaics
				FROM jsonb_array_elements(a.mosaics) WITH ORDINALITY AS mosaic(item, ordinality)
				LEFT JOIN mosaics m
					ON m.namespace_name = mosaic.item->>'namespace_name'
			) am ON true
			{order_condition}
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
				n.root_namespace,
				n.owner,
				n.registered_height,
				b.timestamp AS registered_timestamp,
				n.expiration_height,
				n.sub_namespaces,
				COALESCE(m.mosaics, '[]'::json) AS mosaics
			FROM (
				SELECT * FROM namespaces n
				{where_condition}
				{order_condition}
				{limit_condition}
			) n
			LEFT JOIN blocks b
				on n.registered_height = b.height
			LEFT JOIN LATERAL (
				SELECT json_agg(json_build_object(
					'namespace_name', ms.namespace_name,
					'total_supply', ms.total_supply,
					'divisibility', ms.divisibility,
					'registered_height', ms.registered_height,
					'registered_timestamp', mb.timestamp::text
				) ORDER BY ms.namespace_name) AS mosaics
				FROM mosaics ms
				LEFT JOIN blocks mb
					ON ms.registered_height = mb.height
				WHERE ms.root_namespace = n.root_namespace
			) m ON true
			{order_condition}
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
			FROM (
				SELECT * FROM mosaics m
				{where_condition}
				{order_condition}
				{limit_condition}
			) m
			LEFT JOIN mosaics levy
				ON levy.namespace_name = m.levy_namespace_name
			LEFT JOIN namespaces ns
				ON ns.root_namespace = m.root_namespace
			LEFT JOIN blocks ns_block
				ON ns_block.height = ns.registered_height
			LEFT JOIN blocks m_block
				ON m_block.height = m.registered_height
			{order_condition}
		'''

	@staticmethod
	def _generate_transaction_sql_query(where_condition='', order_condition='', limit_condition=''):
		"""Base transaction query."""

		return f'''
			SELECT
				t.transaction_hash,
				t.transaction_type,
				t.sender_address as from_address,
				t.fee,
				t.height,
				t.timestamp,
				t.deadline,
				t.signature,
				t.recipient_address as to_address,
				t.payload,
				COALESCE(m.mosaics, '[]'::json) AS mosaics,
				t.size,
				t.version
			FROM (
				SELECT * FROM transactions t
				{where_condition}
				{order_condition}
				{limit_condition}
			) t
			LEFT JOIN LATERAL (
				SELECT json_agg(json_build_object(
				'namespace_name', tm.namespace_name,
				'quantity', tm.quantity,
				'divisibility', mo.divisibility)) AS mosaics
			FROM transactions_mosaic tm
			LEFT JOIN mosaics mo
				ON mo.namespace_name = tm.namespace_name
			WHERE tm.transaction_id = t.id
			) m ON true
			{order_condition}
		'''

	def _read_harvesting_active_cutoff_height(self, cursor):
		"""Reads the lowest height that still counts as recent harvesting activity."""

		cursor.execute('''
			SELECT COALESCE((
				SELECT height
				FROM blocks
				WHERE timestamp >= (SELECT MAX(timestamp) FROM blocks) - make_interval(days => %s)
				ORDER BY timestamp
				LIMIT 1
			), 1)
		''', (self._harvesting_active_window_days,))

		return cursor.fetchone()[0]

	@staticmethod
	def _read_main_address(cursor, address):
		"""Reads the main account that harvests through this account, if this account is a remote one."""

		cursor.execute('SELECT address FROM accounts WHERE remote_address = %s', (address,))
		result = cursor.fetchone()

		return result[0] if result else None

	def _get_account(self, where_condition, query_bytes):
		"""Gets account by where clause."""

		sql = self._generate_account_query(where_condition=where_condition)

		with self.connection() as connection:
			cursor = connection.cursor()
			cutoff_height = self._read_harvesting_active_cutoff_height(cursor)
			cursor.execute(sql, (cutoff_height, query_bytes))
			result = cursor.fetchone()
			if not result:
				return None

			return self._create_account_view(result, self._read_main_address(cursor, result[0]))

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

		where_condition = 'WHERE a.address = %s'

		return self._get_account(where_condition, address.bytes)

	def get_account_by_public_key(self, public_key):
		"""Gets account by public key."""

		where_condition = 'WHERE public_key = %s'

		return self._get_account(where_condition, public_key.bytes)

	def get_accounts(self, pagination, sorting, is_harvesting):
		"""Gets accounts pagination in database."""

		where_condition = ' WHERE a.last_harvested_height >= %s ' if is_harvesting else ''
		order_condition = f' ORDER BY {sorting.field} {sorting.order} '
		limit_condition = ' LIMIT %s OFFSET %s'

		sql = self._generate_account_query(limit_condition=limit_condition, order_condition=order_condition, where_condition=where_condition)

		with self.connection() as connection:
			cursor = connection.cursor()
			cutoff_height = self._read_harvesting_active_cutoff_height(cursor)
			params = [cutoff_height] + ([cutoff_height] if is_harvesting else []) + [pagination.limit, pagination.offset]
			cursor.execute(sql, params)
			results = cursor.fetchall()

			return [self._create_account_view(result) for result in results]

	def get_account_statistics(self):
		"""Gets account statistics from database."""

		with self.connection() as connection:
			cursor = connection.cursor()
			cutoff_height = self._read_harvesting_active_cutoff_height(cursor)
			cursor.execute('''
				SELECT
					COUNT(*) AS total_accounts,
					COUNT(*) FILTER (WHERE balance > 0) AS accounts_with_balance,
					COUNT(*) FILTER (WHERE last_harvested_height >= %s) AS harvested_accounts,
					COALESCE(SUM(importance), 0) AS total_importance,
					COUNT(*) FILTER (WHERE vested_balance > 10000000000) AS eligible_harvest_accounts
				FROM accounts
			''', (cutoff_height,))
			result = cursor.fetchone()

			return self._create_account_statistic_view(result)

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

		order_condition = f' ORDER BY registered_height {sort}, root_namespace ASC'
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

		order_condition = f' ORDER BY m.registered_height {sort}, m.namespace_name'
		limit_condition = ' LIMIT %s OFFSET %s'

		sql = self._generate_mosaic_query(order_condition=order_condition, limit_condition=limit_condition)

		params = [pagination.limit, pagination.offset]

		with self.connection() as connection:
			cursor = connection.cursor()
			cursor.execute(sql, params)
			results = cursor.fetchall()

			return [self._create_mosaic_view(result) for result in results]

	def get_mosaic_rich_list(self, pagination, namespace_name):
		"""Gets mosaic rich list by namespace name pagination in database."""

		sql = '''
			WITH mosaic_list AS (
					SELECT
						a.address,
						ar.remark,
						(mosaic->>'quantity')::bigint as balance
					FROM
						accounts a
						LEFT JOIN account_remark ar
							ON ar.address = a.address
						CROSS JOIN LATERAL jsonb_array_elements(a.mosaics) AS mosaic
						WHERE (mosaic->>'namespace_name') = %s AND (mosaic->>'quantity')::bigint > 0
				)
				SELECT
					ml.address,
					ml.remark,
					ml.balance,
					m.divisibility
				FROM
					mosaic_list ml
					LEFT JOIN mosaics m
						ON m.namespace_name = %s
				ORDER BY ml.balance DESC
				LIMIT %s OFFSET %s
		'''

		params = [namespace_name, namespace_name, pagination.limit, pagination.offset]

		with self.connection() as connection:
			cursor = connection.cursor()
			cursor.execute(sql, params)
			results = cursor.fetchall()

			return [self._create_mosaic_rich_list_view(result) for result in results]

	def _build_transaction_payload(self, transaction_type, payload, mosaics):
		"""Builds transaction payload based on transaction type."""

		value = []

		if transaction_type == TransactionType.TRANSFER.value:
			if payload['message']:
				value.append({
					'message': {
						'type': payload['message']['type'],
						'payload': payload['message']['payload']
					},
				})

			for mosaic in mosaics:
				value.append({
					'namespace': mosaic['namespace_name'],
					'amount': _format_relative(mosaic['quantity'], mosaic['divisibility'])
				})
		elif transaction_type == TransactionType.ACCOUNT_KEY_LINK.value:
			value.append({
				'mode': payload['mode'],
				'remoteAccount': payload['remote_account'],
				'remoteAddress': self._format_public_key_to_address(payload['remote_account'])
			})
		elif transaction_type == TransactionType.MULTISIG_ACCOUNT_MODIFICATION.value:
			value.append({
				'minCosignatories': payload['min_cosignatories'],
				'modifications': [{
					'cosignatoryAccount': self._format_public_key_to_address(modification['cosignatory_account']),
					'modificationType': modification['modification_type']
				} for modification in payload['modifications']]
			})
		elif transaction_type == TransactionType.NAMESPACE_REGISTRATION.value:
			value.append({
				'sinkFee': _format_xem_relative(payload['rental_fee']),
				'parent': payload['parent'],
				'namespaceName': payload['namespace']
			})
		elif transaction_type == TransactionType.MOSAIC_DEFINITION.value:
			value.append({
				'sinkFee': _format_xem_relative(payload['creation_fee']),
				'mosaicNamespaceName': payload['namespace_name'],
			})
		elif transaction_type == TransactionType.MOSAIC_SUPPLY_CHANGE.value:
			value.append({
				'supplyType': payload['supply_type'],
				'delta': payload['delta'],
				'namespaceName': payload['namespace_name']
			})

		return value

	def _get_transaction_query(self, transaction_hash, is_inner=False):
		"""Gets transaction by where clause."""

		where_condition = ' WHERE t.transaction_hash = %s AND t.is_inner = %s'
		sql = self._generate_transaction_sql_query(where_condition=where_condition)

		params = ['\\x' + transaction_hash, is_inner]

		with self.connection() as connection:
			cursor = connection.cursor()
			cursor.execute(sql, params)
			result = cursor.fetchone()

			return TransactionRecord(*result) if result else None

	def get_transaction_by_hash(self, transaction_hash, is_inner=False):
		"""Gets transaction by hash in database."""

		transaction = self._get_transaction_query(transaction_hash, is_inner)
		inner_transaction = None

		if transaction and transaction.transaction_type == TransactionType.MULTISIG.value:
			inner_hash = transaction.payload['inner_hash']
			inner_transaction = self._get_transaction_query(inner_hash, is_inner=True)

		return self._create_transaction_view(transaction, inner_transaction) if transaction else None

	def get_transaction_statistics(self):
		"""Gets transaction statistics from database."""

		with self.connection() as connection:
			cursor = connection.cursor()
			cursor.execute('''
				WITH latest_block AS (
					SELECT MAX(timestamp) AS max_timestamp
					FROM blocks
				)
				SELECT
					COALESCE(SUM(b.total_transactions), 0) AS total_transactions,
					COALESCE(SUM(
						CASE
							WHEN b.timestamp > lb.max_timestamp - INTERVAL '24 hours'
							THEN b.total_transactions
							ELSE 0
						END
					), 0) AS transaction_last_24_hours,
					COALESCE(SUM(
						CASE
							WHEN b.timestamp > lb.max_timestamp - INTERVAL '30 days'
							THEN b.total_transactions
							ELSE 0
						END
					), 0) AS transaction_last_30_days
				FROM blocks b
				CROSS JOIN latest_block lb;
			''')
			result = cursor.fetchone()

			return self._create_transaction_statistic_view(result) if result else None

	def get_transaction_statistics_by_date_range(self, start_date, end_date, period_type):  # pylint: disable=invalid-name
		"""Gets transaction statistics grouped by period from database."""

		period_format = 'YYYY-MM-DD' if 'DAY' == period_type else 'YYYY-MM'

		sql = f'''
			SELECT
				TO_CHAR(DATE_TRUNC('{period_type}', timestamp), '{period_format}') AS period,
				COALESCE(SUM(total_transactions), 0) AS total_transactions
			FROM blocks
			WHERE timestamp >= %s::date AND timestamp < %s::date + INTERVAL '1 day'
			GROUP BY DATE_TRUNC('{period_type}', timestamp)
			ORDER BY DATE_TRUNC('{period_type}', timestamp) ASC
		'''

		with self.connection() as connection:
			cursor = connection.cursor()
			cursor.execute(sql, (start_date, end_date))
			results = cursor.fetchall()

			return self._create_transaction_date_range_statistic_view(results, period_type)

	def _get_transactions(self, params, where_condition='', order_condition='', limit_condition=''):
		"""Gets transactions by where clause."""

		sql = self._generate_transaction_sql_query(
			where_condition=where_condition,
			order_condition=order_condition,
			limit_condition=limit_condition
		)

		with self.connection() as connection:
			cursor = connection.cursor()
			cursor.execute(sql, params)
			results = cursor.fetchall()

			return [TransactionRecord(*result) for result in results]

	def _get_inner_transactions(self, transaction_hashes):
		"""Gets inner transactions by transaction hashes."""

		if not transaction_hashes:
			return []

		where_condition = ' WHERE t.transaction_hash IN %s AND t.is_inner = true'
		order_condition = ' ORDER BY t.height DESC'
		params = [tuple('\\x' + tx_hash for tx_hash in transaction_hashes)]

		return self._get_transactions(
			params,
			where_condition=where_condition,
			order_condition=order_condition
		)

	@staticmethod
	def _create_transaction_filters(transaction_query, transaction_type_column):
		"""Creates the optional listing filters, reading the transaction type from the given column."""

		condition = ''
		params = []

		if transaction_query.height:
			condition += ' AND t.height = %s'
			params.append(transaction_query.height)

		if transaction_query.transaction_types:
			condition += f' AND {transaction_type_column} IN %s'
			params.append(tuple(transaction_query.transaction_types))

		if transaction_query.mosaic:
			condition += (
				' AND EXISTS (SELECT 1 FROM transactions_mosaic tm'
				' WHERE tm.transaction_id = t.id AND tm.namespace_name = %s)'
			)
			params.append(transaction_query.mosaic)

		return condition, params

	@staticmethod
	def _create_address_branches(transaction_query):
		"""Creates one branch per address role being searched; a sender and recipient pair narrows a single branch."""

		if transaction_query.address:
			address = transaction_query.address.bytes

			return [('sender_address', '', [address]), ('recipient_address', '', [address])]

		if transaction_query.sender_address and transaction_query.recipient_address:
			return [(
				'sender_address',
				' AND t.recipient_address = %s',
				[transaction_query.sender_address.bytes, transaction_query.recipient_address.bytes]
			)]

		if transaction_query.sender_address:
			return [('sender_address', '', [transaction_query.sender_address.bytes])]

		if transaction_query.recipient_address:
			return [('recipient_address', '', [transaction_query.recipient_address.bytes])]

		return []

	@staticmethod
	def _create_address_page_condition(branches, sort, filters, pagination):
		"""Restricts the listing to one page of ids, chosen by index ordered branches before any row is hydrated."""

		filter_condition, filter_params = filters
		page_size = pagination.limit + pagination.offset
		branch_sql = []
		params = []

		for column, extra_condition, address_params in branches:
			branch_sql.append(
				' (SELECT COALESCE(o.id, t.id) AS id, t.height'
				' FROM transactions t'
				' LEFT JOIN transactions o ON o.transaction_hash = t.aggregate_hash'
				f' WHERE t.{column} = %s{extra_condition}'
				f' AND t.transaction_type <> {TransactionType.MULTISIG.value}'
				f'{filter_condition}'
				f' ORDER BY t.height {sort}, t.id {sort}'
				' LIMIT %s)'
			)
			params.extend(address_params + filter_params + [page_size])

		# a branch resolves an inner row to its owner, so only an unlinked one could reach here; listing it would
		# expose a row that carries no signature, so the listing states outright that it holds top level transactions
		return (
			' WHERE t.is_inner = false AND t.id IN (SELECT id FROM ('
			f' SELECT DISTINCT id, height FROM ({" UNION ALL ".join(branch_sql)}) page'
			f' ORDER BY height {sort}, id {sort}'
			' LIMIT %s OFFSET %s) page_ids)',
			params + [pagination.limit, pagination.offset]
		)

	@staticmethod
	def _create_mosaic_page_condition(mosaic, sort, filters, pagination):
		"""Restricts the listing to one page of ids, chosen from the mosaic index before any row is hydrated."""

		filter_condition, filter_params = filters

		# a multisig transaction carries its mosaics on the inner transfer, so the mosaic resolves to its owner;
		# ids are handed out in height order, which lets the page be ordered without joining the transfer first
		return (
			' WHERE t.is_inner = false AND t.id IN ('
			' SELECT COALESCE(o.id, t.id)'
			' FROM transactions_mosaic tm'
			' JOIN transactions t ON t.id = tm.transaction_id'
			' LEFT JOIN transactions o ON o.transaction_hash = t.aggregate_hash'
			f' WHERE tm.namespace_name = %s{filter_condition}'
			f' ORDER BY tm.transaction_id {sort}'
			' LIMIT %s OFFSET %s)',
			[mosaic] + filter_params + [pagination.limit, pagination.offset]
		)

	def get_transactions(self, pagination, sort, transaction_query):
		"""Gets transactions pagination."""

		order_condition = f' ORDER BY t.height {sort}'
		branches = self._create_address_branches(transaction_query)

		if branches:
			# the page is chosen by the branches, so the outer query has nothing left to limit
			limit_condition = ''
			# ties are broken the same way the branches order them, otherwise the page and its rows disagree
			order_condition += f', t.id {sort}'
			where_condition, params = self._create_address_page_condition(
				branches,
				sort,
				self._create_transaction_filters(transaction_query, 'COALESCE(o.transaction_type, t.transaction_type)'),
				pagination
			)
		elif transaction_query.mosaic:
			limit_condition = ''
			order_condition += f', t.id {sort}'
			where_condition, params = self._create_mosaic_page_condition(
				transaction_query.mosaic,
				sort,
				# the mosaic selects the page here, so it must not be repeated as a filter on the rows
				self._create_transaction_filters(
					transaction_query._replace(mosaic=None),
					'COALESCE(o.transaction_type, t.transaction_type)'
				),
				pagination
			)
		else:
			limit_condition = ' LIMIT %s OFFSET %s'
			filter_condition, filter_params = self._create_transaction_filters(transaction_query, 't.transaction_type')
			where_condition = ' WHERE t.is_inner = False ' + filter_condition
			params = filter_params + [pagination.limit, pagination.offset]

		transactions = self._get_transactions(
			params,
			where_condition=where_condition,
			order_condition=order_condition,
			limit_condition=limit_condition
		)

		inner_transaction_hashes = [
			transaction.payload['inner_hash']
			for transaction in transactions
			if transaction.transaction_type == TransactionType.MULTISIG.value
		]

		if inner_transaction_hashes:
			inner_transactions = self._get_inner_transactions(inner_transaction_hashes)
			inner_transaction_map = {
				_format_bytes(inner_transaction.transaction_hash).lower(): inner_transaction for inner_transaction in inner_transactions
			}

			return [
				self._create_transaction_view(
					transaction,
					inner_transaction_map.get(transaction.payload.get('inner_hash'))
				)
				for transaction in transactions
			]

		return [self._create_transaction_view(transaction) for transaction in transactions]

	def _convert_timestamp_to_datetime(self, timestamp):
		return self.network.datetime_converter.to_datetime(timestamp).strftime('%Y-%m-%d %H:%M:%S')

	def _create_unconfirmed_mosaic_records(self, mosaics, amount):
		if not mosaics:
			# create default nem.xem mosaic record for v1 transfer transaction
			return [
				{
					'namespace_name': 'nem.xem',
					'quantity': amount,
					'divisibility': 6
				}
			]

		mosaic_names = [mosaic.namespace_name for mosaic in mosaics]
		divisibility_map = self._get_mosaic_divisibility_by_names(mosaic_names)
		mosaic_records = []
		for mosaic in mosaics:
			namespace_name = mosaic.namespace_name
			mosaic_records.append({
				'namespace_name': namespace_name,
				'quantity': mosaic.quantity * amount // (10 ** 6),
				'divisibility': divisibility_map.get(namespace_name, 0)
			})

		return mosaic_records

	def _build_unconfirmed_transaction_record(self, transaction):
		"""Converts a connector unconfirmed transaction response into a database-style transaction record."""

		payload = None
		recipient_address = None
		mosaics = None
		if transaction.transaction_type == TransactionType.TRANSFER.value:
			payload = {
				'message': {
					'payload': transaction.message.payload,
					'type': transaction.message.type,
				} if transaction.message else None
			}
			recipient_address = transaction.recipient.bytes
			mosaics = self._create_unconfirmed_mosaic_records(transaction.mosaics, transaction.amount)
		elif transaction.transaction_type == TransactionType.ACCOUNT_KEY_LINK.value:
			payload = {
				'mode': transaction.mode,
				'remote_account': str(transaction.remote_account)
			}
		elif transaction.transaction_type == TransactionType.MULTISIG_ACCOUNT_MODIFICATION.value:
			payload = {
				'min_cosignatories': transaction.min_cosignatories,
				'modifications': [
					{
						'modification_type': modification.modification_type,
						'cosignatory_account': str(modification.cosignatory_account)
					}
					for modification in transaction.modifications
				]
			}
		elif transaction.transaction_type == TransactionType.MULTISIG.value:
			payload = {
				'inner_hash': transaction.inner_hash,
				'signatures': [
					{
						'transaction_type': signature.transaction_type,
						'timestamp': self._convert_timestamp_to_datetime(signature.timestamp),
						'deadline': self._convert_timestamp_to_datetime(signature.deadline),
						'fee': signature.fee,
						'other_hash': signature.other_hash,
						'other_account': str(signature.other_account),
						'sender': str(signature.sender),
						'signature': signature.signature
					} for signature in transaction.signatures
				]
			}
		elif transaction.transaction_type == TransactionType.NAMESPACE_REGISTRATION.value:
			payload = {
				'rental_fee': transaction.rental_fee,
				'parent': transaction.parent,
				'namespace': transaction.namespace
			}
			recipient_address = transaction.rental_fee_sink.bytes
		elif transaction.transaction_type == TransactionType.MOSAIC_DEFINITION.value:
			payload = {
				'creation_fee': transaction.creation_fee,
				'creator': str(transaction.sender),
				'description': transaction.description,
				'namespace_name': transaction.namespace_name,
				'mosaic_properties': {
					'divisibility': transaction.properties.divisibility,
					'initial_supply': transaction.properties.initial_supply,
					'supply_mutable': transaction.properties.supply_mutable,
					'transferable': transaction.properties.transferable
				},
				'levy': {
					'type': transaction.levy.type,
					'namespace_name': transaction.levy.namespace_name,
					'fee': transaction.levy.fee,
					'recipient': str(transaction.levy.recipient)
				} if transaction.levy else None
			}
			recipient_address = transaction.creation_fee_sink.bytes
		elif transaction.transaction_type == TransactionType.MOSAIC_SUPPLY_CHANGE.value:
			payload = {
				'namespace_name': transaction.namespace_name,
				'supply_type': transaction.supply_type,
				'delta': transaction.delta
			}

		return TransactionRecord(
			transaction_hash=None,
			transaction_type=transaction.transaction_type,
			from_address=self.network.public_key_to_address(transaction.sender).bytes,
			fee=transaction.fee,
			height=0,
			timestamp=self._convert_timestamp_to_datetime(transaction.timestamp),
			deadline=self._convert_timestamp_to_datetime(transaction.deadline),
			signature=bytes.fromhex(transaction.signature) if transaction.signature else None,
			to_address=recipient_address,
			payload=payload,
			mosaics=mosaics,
			size=transaction.size,
			version=transaction.version
		)

	def _get_mosaic_divisibility_by_names(self, names):
		"""Gets mosaic by namespace name in database."""

		sql = '''
			SELECT
				m.namespace_name,
				m.divisibility
			FROM mosaics m
			WHERE m.namespace_name IN %s
			'''

		with self.connection() as connection:
			cursor = connection.cursor()
			cursor.execute(sql, (tuple(names),))
			results = cursor.fetchall()

			return {result[0]: result[1] for result in results}

	def get_unconfirmed_transactions(self, transactions):
		"""Gets unconfirmed transactions."""

		unconfirmed_transactions = []

		for transaction in transactions:
			if transaction.transaction_type == TransactionType.MULTISIG.value:
				inner_transaction = self._build_unconfirmed_transaction_record(transaction.other_transaction)
			else:
				inner_transaction = None

			unconfirmed_transactions.append(
				self._create_transaction_view(
					self._build_unconfirmed_transaction_record(transaction),
					inner_transaction
				)
			)

		return unconfirmed_transactions
