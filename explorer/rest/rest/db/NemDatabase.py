from binascii import hexlify

from symbolchain.CryptoTypes import PublicKey
from symbolchain.nc import TransactionType
from symbolchain.nem.Network import Address

from rest.model.Account import AccountView
from rest.model.Block import BlockView
from rest.model.Mosaic import MosaicRichListView, MosaicView
from rest.model.Namespace import NamespaceView
from rest.model.Statistic import StatisticAccountView, StatisticTransactionView
from rest.model.Transaction import TransactionRecord, TransactionView

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
			beneficiary=_format_address_bytes_to_string(beneficiary),
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
			address=_format_address_bytes_to_string(address),
			public_key=str(PublicKey(public_key)) if public_key else None,
			remote_address=_format_address_bytes_to_string(remote_address) if remote_address else None,
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
			cosignatory_of=[_format_address_bytes_to_string(address) for address in cosignatory_of] if cosignatory_of else None,
			cosignatories=[_format_address_bytes_to_string(address) for address in cosignatories] if cosignatories else None
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
		value = self._build_transaction_payload(transaction.transaction_type, transaction.payload, transaction.amount, transaction.mosaics)
		embedded_transaction = []
		from_address = _format_address_bytes_to_string(transaction.from_address)
		to_address = _format_address_bytes_to_string(transaction.to_address) if transaction.to_address else None

		if inner_transaction:
			value = None
			embedded_transaction.append({
				'initiator': _format_address_bytes_to_string(transaction.from_address),
				'transactionHash': _format_bytes(inner_transaction.transaction_hash),
				'transactionType': TransactionType(inner_transaction.transaction_type).name,
				'signatures': [{
					'fee': _format_xem_relative(signature['fee']),
					'signature': signature['signature'],
					'signer': str(self.network.public_key_to_address(PublicKey(signature['sender'])))
				} for signature in transaction.payload['signatures']],
				'fee': _format_xem_relative(inner_transaction.fee),
				'value': self._build_transaction_payload(
					inner_transaction.transaction_type,
					inner_transaction.payload,
					inner_transaction.amount,
					inner_transaction.mosaics
				),
			})
			from_address = _format_address_bytes_to_string(inner_transaction.from_address)
			to_address = _format_address_bytes_to_string(inner_transaction.to_address) if inner_transaction.to_address else None

		return TransactionView(
			transaction_hash=_format_bytes(transaction.transaction_hash),
			transaction_type=TransactionType(transaction.transaction_type).name,
			from_address=from_address,
			to_address=to_address,
			value=value,
			embedded_transactions=embedded_transaction if embedded_transaction else None,
			fee=_format_xem_relative(transaction.fee),
			height=transaction.height,
			timestamp=str(transaction.timestamp),
			deadline=str(transaction.deadline),
			signature=_format_bytes(transaction.signature)
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

	@staticmethod
	def _generate_transaction_sql_query():
		"""Base transaction query."""

		return '''
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
				t.amount,
				COALESCE(m.mosaics, '[]'::json) AS mosaics
			FROM transactions t
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

	def get_account_statistics(self):
		"""Gets account statistics from database."""

		with self.connection() as connection:
			cursor = connection.cursor()
			cursor.execute('''
				SELECT
					(SELECT COUNT(*) FROM accounts) AS total_accounts,
					(SELECT COUNT(*) FROM accounts WHERE balance > 0) AS accounts_with_balance,
					(SELECT COUNT(*) FROM accounts WHERE harvested_blocks > 0) AS harvested_accounts,
					COALESCE((SELECT SUM(importance) FROM accounts), 0) AS total_importance,
					(SELECT COUNT(*) FROM accounts WHERE vested_balance > 10000) AS eligible_harvest_accounts
			''')
			result = cursor.fetchone()

			return self._create_account_statistic_view(result) if result else None

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

	def get_mosaic_rich_list(self, pagination, namespace_name):
		"""Gets mosaic rich list by namespace name pagination in database."""

		sql = '''
			WITH mosaic_list AS (
					SELECT
						a.address,
						ar.remarks,
						(mosaic->>'quantity')::bigint as balance
					FROM
						accounts a
						LEFT JOIN account_remarks ar
							ON ar.address = a.address
						CROSS JOIN LATERAL jsonb_array_elements(a.mosaics) AS mosaic
						WHERE (mosaic->>'namespace') = %s AND (mosaic->>'quantity')::bigint > 0
				)
				SELECT
					ml.address,
					ml.remarks,
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

	def _build_transaction_payload(self, transaction_type, payload, amount, mosaics):
		"""Builds transaction payload based on transaction type."""

		value = []

		if transaction_type == TransactionType.TRANSFER.value:
			if payload['message']:
				value.append({
					'message': {
						'isPlain': payload['message']['is_plain'],
						'payload': payload['message']['payload']
					},
				})

			if mosaics:
				multiplier = 0 if amount == 0 else _format_xem_relative(amount)
				for mosaic in mosaics:
					mosaic_amount = mosaic['quantity'] * multiplier

					value.append({
						'namespace': mosaic['namespace_name'],
						'amount': _format_relative(mosaic_amount, mosaic['divisibility'])
					})
			else:
				value.append({
					'namespace': 'nem.xem',
					'amount': _format_xem_relative(amount)
				})
		elif transaction_type == TransactionType.ACCOUNT_KEY_LINK.value:
			value.append({
				'mode': payload['mode'],
				'remoteAccount': payload['remote_account'],
			})
		elif transaction_type == TransactionType.MULTISIG_ACCOUNT_MODIFICATION.value:
			value.append({
				'minCosignatories': payload['min_cosignatories'],
				'modifications': [{
					'cosignatoryAccount': str(self.network.public_key_to_address(PublicKey(modification['cosignatory_account']))),
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

		sql = self._generate_transaction_sql_query()
		sql += ' WHERE t.transaction_hash = %s AND t.is_inner = %s'
		params = ('\\x' + transaction_hash, is_inner)

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
