from binascii import hexlify, unhexlify

from symbolchain.CryptoTypes import PublicKey
from symbolchain.nc import TransactionType
from symbolchain.nem.Network import Address

from rest.model.Account import AccountQuery, AccountView
from rest.model.Block import BlockView
from rest.model.Mosaic import MosaicRichListView, MosaicTransfersView, MosaicView
from rest.model.Namespace import NamespaceView
from rest.model.Statistic import StatisticAccountView, StatisticTransactionView
from rest.model.Transaction import TransactionListView, TransactionQuery

from .DatabaseConnection import DatabaseConnectionPool


def _format_address_bytes(buffer):
	return unhexlify(_format_bytes(buffer))


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

	def _generate_block_sql_query(self):
		"""Base block sql query."""

		return """
			SELECT
				b.height,
				b.timestamp,
				b.total_fees,
				b.total_transactions,
				b.difficulty,
				b.hash,
				b.signer,
				b.signature,
				b.size
			FROM blocks b
		"""

	def _generate_transaction_sql_query(self):
		"""Base transaction sql query."""

		return """
			SELECT
				t.transaction_hash,
				t.transaction_type,
				t.sender AS from,
				t.fee,
				t.height,
				t.timestamp,
				t.deadline,
				t.signature,
				CASE
					WHEN transaction_type = 257 THEN t.recipient_address
					WHEN transaction_type = 8193 THEN tnr.rental_fee_sink
					WHEN transaction_type = 16385 THEN tmdc.creation_fee_sink
					ELSE NULL
				END AS to,
				CASE
					WHEN transaction_type = 257 Then t.mosaics
					ELSE NULL
				END AS transfer_mosaic,
				CASE
					WHEN transaction_type = 257 Then tt.amount
					ELSE NULL
				END AS transfer_amount,
				CASE
					WHEN transaction_type = 257 Then tt.message
					ELSE NULL
				END AS transfer_message,
				CASE
					WHEN transaction_type = 8193 THEN tnr.namespace
					WHEN transaction_type = 16385 THEN tmdc.namespace_name
				END AS mosaic_namespace_creation_name,
				CASE
					WHEN transaction_type = 4100 Then tm.initiator
					ELSE NULL
				END AS multisig_initiator,
				CASE
					WHEN transaction_type = 4100 Then tm.other_transaction
					ELSE NULL
				END AS multisig_inner_transaction,
				CASE
					WHEN transaction_type = 4100 Then tm.signatures
					ELSE NULL
				END AS multisig_signatures,
				CASE
					WHEN transaction_type = 2049 Then takl.mode
					ELSE NULL
				END AS account_key_link_mode,
				CASE
					WHEN transaction_type = 2049 Then takl.remote_account
					ELSE NULL
				END AS account_key_link_remote_account,
				CASE
					WHEN transaction_type = 4097 Then tmam.min_cosignatories
					ELSE NULL
				END AS multisig_account_modification_min_cosignatories,
				CASE
					WHEN transaction_type = 4097 Then tmam.modifications
					ELSE NULL
				END AS multisig_account_modification_modifications,
				CASE
					WHEN transaction_type = 16386 Then tmsc.supply_type
					ELSE NULL
				END AS mosaic_supply_change_type,
				CASE
					WHEN transaction_type = 16386 Then tmsc.delta
					ELSE NULL
				END AS mosaic_supply_change_delta,
				CASE
					WHEN transaction_type = 16386 Then tmsc.namespace_name
					ELSE NULL
				END AS mosaic_supply_change_namespace_name,
				CASE
					WHEN transaction_type = 8193 THEN tnr.rental_fee
					WHEN transaction_type = 16385 THEN tmdc.creation_fee
					ELSE NULL
				END AS mosaic_namespace_sink_fee
			FROM transactions t
			LEFT JOIN transactions_account_key_link takl
				ON t.id = takl.transaction_id
			LEFT JOIN transactions_mosaic_definition_creation tmdc
				ON t.id = tmdc.transaction_id
			LEFT JOIN transactions_mosaic_supply_change tmsc
				ON t.id = tmsc.transaction_id
			LEFT JOIN transactions_multisig tm
				ON t.id = tm.transaction_id
			LEFT JOIN transactions_multisig_account_modification tmam
				ON t.id = tmam.transaction_id
			LEFT JOIN transactions_namespace_registration tnr
				ON t.id = tnr.transaction_id
			LEFT JOIN transactions_transfer tt
				ON t.id = tt.transaction_id
		"""

	def _generate_account_sql_query(self):
		"""Base account sql query."""

		return """
			SELECT
				a.address,
				a.public_key,
				a.remote_address,
				a.importance,
				a.balance,
				a.vested_balance,
				a.mosaics,
				a.harvested_fees,
				a.harvested_blocks,
				a.harvest_status,
				a.harvest_remote_status,
				a.height,
				a.min_cosignatories,
				a.cosignatory_of,
				a.cosignatories,
				ar.remarks
			FROM accounts a
			LEFT JOIN account_remarks ar
				ON ar.address = a.address
		"""

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

		mosaics = []

		if result[6] != []:
			# Formatting mosaics info
			for mosaic in result[6]:
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
			root_namespace=result[0],
			owner=self.network.public_key_to_address(owner_public_key),
			registered_height=result[2],
			registered_timestamp=str(result[3]),
			expiration_height=result[4],
			sub_namespaces=result[5],
			mosaics=mosaics
		)

	def _create_mosaic_view(self, result):
		levy_types = {
			1: 'absolute fee',
			2: 'percentile'
		}

		creator_public_key = PublicKey(_format_bytes(result[2]))
		levy_type = levy_types.get(result[10], None)
		levy_fee = _format_relative(result[13], result[12]) if levy_type else None

		namespace_mosaic_name = result[0].split('.')
		namespace_name = '.'.join(namespace_mosaic_name[:-1])
		mosaic_name = namespace_mosaic_name[-1]

		return MosaicView(
			mosaic_name=mosaic_name,
			namespace_name=namespace_name,
			description=result[1],
			creator=self.network.public_key_to_address(creator_public_key),
			registered_height=result[3],
			registered_timestamp=result[4],
			initial_supply=result[5],
			total_supply=result[6],
			divisibility=result[7],
			supply_mutable=result[8],
			transferable=result[9],
			levy_type=levy_type,
			levy_namespace=result[12],
			levy_fee=levy_fee,
			levy_recipient=Address(result[14]) if result[14] else None,
			root_namespace_registered_height=result[15],
			root_namespace_registered_timestamp=result[16],
			root_namespace_expiration_height=result[17],
		)

	def _create_transaction_list_view(self, result):
		transaction_type_mapping = {
			257: TransactionType.TRANSFER.name,
			2049: TransactionType.ACCOUNT_KEY_LINK.name,
			4100: TransactionType.MULTISIG.name,
			4097: TransactionType.MULTISIG_ACCOUNT_MODIFICATION.name,
			16385: TransactionType.MOSAIC_DEFINITION.name,
			16386: TransactionType.MOSAIC_SUPPLY_CHANGE.name,
			8193: TransactionType.NAMESPACE_REGISTRATION.name
		}

		(
			transaction_hash,
			transaction_type,
			address_from,
			fee,
			height,
			timestamp,
			deadline,
			signature,
			address_to,
			transfer_mosaic,
			transfer_amount,
			transfer_message,
			mosaic_namespace_creation_name,
			multisig_initiator,
			multisig_inner_transaction,
			multisig_signatures,
			account_key_link_mode,
			account_key_link_remote_account,
			multisig_account_modification_min_cosignatories,
			multisig_account_modification_modifications,
			mosaic_supply_change_type,
			mosaic_supply_change_delta,
			mosaic_supply_change_namespace_name,
			mosaic_namespace_sink_fee
		) = result

		from_address = self.network.public_key_to_address(PublicKey(_format_bytes(address_from)))
		to_address = Address(unhexlify(_format_bytes(address_to))) if address_to else None
		fee = _format_xem_relative(fee)

		value = []
		embedded_transactions = None

		if transaction_type == 257:  # Transfer
			value.append({
				'message': transfer_message
			})

			# Todo: supply formatting divisibility
			if transfer_mosaic is None:
				value.append({
					'namespace': 'nem.xem',
					'amount': _format_xem_relative(transfer_amount)
				})
			else:
				multiply = transfer_amount if transfer_amount == 0 else transfer_amount / 1000000

				for mosaic in transfer_mosaic:
					amount = mosaic['quantity'] * multiply
					value.append({
						'namespace': mosaic['namespace_name'],
						'amount': _format_xem_relative(amount) if mosaic['namespace_name'] == 'nem.xem' else amount
					})

		elif transaction_type == 2049:  # Account key link
			value.append({
				'mode': account_key_link_mode,
				'remoteAccount': _format_bytes(account_key_link_remote_account)
			})

		elif transaction_type == 4097:  # Multisig account modification
			value.append({
				'minCosignatories': multisig_account_modification_min_cosignatories,
				'modifications': [{
					'cosignatoryAccount': str(self.network.public_key_to_address(PublicKey(modification['cosignatory_account']))),
					'modificationType': modification['modification_type']
				} for modification in multisig_account_modification_modifications]
			})

		elif transaction_type == 4100:  # Multisig
			value = None
			embedded_transactions = []
			inner_transaction = {}

			to_address = None

			inner_transaction_type = multisig_inner_transaction['transaction_type']

			inner_transaction['initiator'] = str(self.network.public_key_to_address(PublicKey(_format_bytes(multisig_initiator))))
			inner_transaction['transactionType'] = transaction_type_mapping.get(inner_transaction_type, None)
			inner_transaction['signatures'] = [{
				'signer': str(self.network.public_key_to_address(PublicKey(signature['sender']))),
				'signature': signature['signature'].upper()
			} for signature in multisig_signatures]

			if inner_transaction_type == 257:
				to_address = multisig_inner_transaction['recipient']

				mosaics = multisig_inner_transaction['mosaics']
				amount = multisig_inner_transaction['amount']

				inner_transaction['message'] = {
					'payload': multisig_inner_transaction['message'][0],
					'is_plain': multisig_inner_transaction['message'][1]
				} if multisig_inner_transaction['message'] else None

				if not mosaics:
					inner_transaction['mosaics'] = {
						'namespace': 'nem.xem',
						'amount': _format_xem_relative(amount)
					}
				else:
					multiply = amount if amount == 0 else amount / 1000000

					# sample inner txs: [['nem.xem', 1000]]
					for mosaic in mosaics:
						amount = mosaic[1] * multiply
						inner_transaction['mosaics'] = {
							'namespace': mosaic[1],
							'amount': (_format_xem_relative(amount) if mosaic[0] == 'nem.xem' else amount)
						}

			elif inner_transaction_type == 2049:
				inner_transaction['mode'] = multisig_inner_transaction['mode']
				inner_transaction['remoteAccount'] = multisig_inner_transaction['remote_account']

			elif inner_transaction_type == 4097:
				inner_transaction['minCosignatories'] = multisig_inner_transaction['min_cosignatories']
				inner_transaction['modifications'] = [{
					'cosignatoryAccount': str(self.network.public_key_to_address(PublicKey(modification[1]))),
					'modificationType': modification[0]
				} for modification in multisig_inner_transaction['modifications']]

			elif inner_transaction_type == 8193:
				to_address = multisig_inner_transaction['rental_fee_sink']
				rental_fee = multisig_inner_transaction['rental_fee']
				namespace = multisig_inner_transaction['namespace']

				inner_transaction['namespaceName'] = namespace
				inner_transaction['sinkFee'] = _format_xem_relative(rental_fee)

			elif inner_transaction_type == 16385:
				to_address = multisig_inner_transaction['creation_fee_sink']
				creation_fee = multisig_inner_transaction['creation_fee']
				namespace_name = multisig_inner_transaction['namespace_name']

				inner_transaction['mosaicNamespaceName'] = namespace_name
				inner_transaction['sinkFee'] = _format_xem_relative(creation_fee)

			elif inner_transaction_type == 16386:
				inner_transaction['supplyType'] = multisig_inner_transaction['supply_type']
				inner_transaction['delta'] = multisig_inner_transaction['delta']
				inner_transaction['namespaceName'] = multisig_inner_transaction['namespace_name']

			embedded_transactions.append(inner_transaction)

		elif transaction_type == 8193:  # Namespace registration
			value.append({
				'namespaceName': mosaic_namespace_creation_name,
				'sinkFee': _format_xem_relative(mosaic_namespace_sink_fee)
			})
		elif transaction_type == 16385:  # Mosaic namespace creation
			value.append({
				'mosaicNamespaceName': mosaic_namespace_creation_name,
				'sinkFee': _format_xem_relative(mosaic_namespace_sink_fee)
			})
		elif transaction_type == 16386:  # Mosaic supply change
			value.append({
				'supplyType': mosaic_supply_change_type,
				'delta': mosaic_supply_change_delta,
				'namespaceName': mosaic_supply_change_namespace_name
			})

		return TransactionListView(
			transaction_hash=_format_bytes(transaction_hash),
			transaction_type=transaction_type_mapping.get(transaction_type, None),
			from_address=from_address,
			to_address=to_address,
			value=value,
			fee=fee,
			height=height,
			timestamp=timestamp,
			deadline=deadline,
			embedded_transactions=embedded_transactions,
			signature=_format_bytes(signature)
		)

	def _create_account_view(self, result):

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
			harvest_status,
			harvest_remote_status,
			height,
			min_cosignatories,
			cosignatory_of,
			cosignatories,
			remarks
		) = result

		return AccountView(
			address=str(Address(_format_address_bytes(address))),
			public_key=_format_bytes(public_key) if public_key else None,
			remote_address=str(Address(_format_address_bytes(remote_address))) if remote_address else None,
			importance=importance,
			balance=_format_xem_relative(balance),
			vested_balance=_format_xem_relative(vested_balance),
			mosaics=mosaics,
			harvested_fees=_format_xem_relative(harvested_fees),
			harvested_blocks=harvested_blocks,
			harvest_status=harvest_status,
			harvest_remote_status=harvest_remote_status,
			height=height,
			min_cosignatories=min_cosignatories,
			cosignatory_of=[str(Address(_format_address_bytes(address))) for address in cosignatory_of] if cosignatory_of else None,
			cosignatories=[str(Address(_format_address_bytes(address))) for address in cosignatories] if cosignatories else None,
			remarks=remarks
		)

	def _create_transaction_statistic_view(self, result):

		(
			total_transactions,
			transaction_last_24_hours,
			transaction_last_30_day
		) = result

		return StatisticTransactionView(
			total_transactions=total_transactions,
			transaction_last_24_hours=transaction_last_24_hours,
			transaction_last_30_day=transaction_last_30_day
		)

	def _create_account_statistic_view(self, result):

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
			total_importance=total_importance
		)

	def _create_mosaic_rich_list_view(self, result):

		(
			address,
			remark,
			balance
		) = result

		return MosaicRichListView(
			address=str(Address(_format_address_bytes(address))),
			remark=remark,
			balance=_format_xem_relative(balance)
		)

	def _create_mosaic_transfers_view(self, result):

		(
			sender_address,
			recipient_address,
			timestamp,
			quantity
		) = result

		return MosaicTransfersView(
			sender_address=str(Address(_format_address_bytes(sender_address))),
			recipient_address=str(Address(_format_address_bytes(recipient_address))),
			timestamp=str(timestamp),
			quantity=quantity
		)

	def get_block(self, height):
		"""Gets block by height in database."""

		sql = self._generate_block_sql_query()
		sql += ' WHERE b.height = %s'
		params = (height,)

		with self.connection() as connection:
			cursor = connection.cursor()
			cursor.execute(sql, params)
			result = cursor.fetchone()

			return self._create_block_view(result) if result else None

	def get_blocks(self, limit, offset, min_height, sort):
		"""Gets blocks pagination in database."""

		sql = self._generate_block_sql_query()
		sql += ' WHERE b.height >= %s'
		sql += f' ORDER BY b.id {sort} LIMIT %s OFFSET %s'
		params = (min_height, limit, offset)

		with self.connection() as connection:
			cursor = connection.cursor()
			cursor.execute(sql, params)
			results = cursor.fetchall()

			return [self._create_block_view(result) for result in results]

	def get_namespace(self, namespace):
		"""Gets namespace by name in database."""

		with self.connection() as connection:
			cursor = connection.cursor()
			cursor.execute('''
				SELECT
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
				WHERE n.root_namespace = %s or %s = ANY(n.sub_namespaces)
				GROUP BY
					n.root_namespace,
					n.owner,
					n.registered_height,
					b1.timestamp,
					n.expiration_height,
					n.sub_namespaces
			''', (namespace, namespace))
			result = cursor.fetchone()

			return self._create_namespace_view(result) if result else None

	def get_namespaces(self, limit, offset, sort):
		"""Gets namespaces pagination in database."""

		with self.connection() as connection:
			cursor = connection.cursor()
			cursor.execute(f'''
			SELECT
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
			GROUP BY
				n.root_namespace,
				n.owner,
				n.registered_height,
				b1.timestamp,
				n.expiration_height,
				n.sub_namespaces
			ORDER BY n.registered_height {sort}
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
					m1.registered_height as mosaic_registered_height,
					b2.timestamp as mosaic_registered_timestamp,
					m1.initial_supply,
					m1.total_supply,
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
					m1.levy_recipient,
					n.registered_height AS root_namespace_registered_height,
					b1.timestamp AS root_namespace_registered_timestamp,
					n.expiration_height
				FROM mosaics m1
				LEFT JOIN mosaics m2
					ON m1.levy_namespace_name = m2.namespace_name AND m1.levy_namespace_name IS NOT NULL
				LEFT JOIN namespaces n
					ON m1.root_namespace = n.root_namespace
				LEFT JOIN blocks b1
					ON b1.height = n.registered_height
				LEFT JOIN blocks b2
					ON b2.height = m1.registered_height
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
					m1.registered_height as mosaic_registered_height,
					b2.timestamp as mosaic_registered_timestamp,
					m1.initial_supply,
					m1.total_supply,
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
					m1.levy_recipient,
					n.registered_height AS root_namespace_registered_height,
					b1.timestamp AS root_namespace_registered_timestamp,
					n.expiration_height
				FROM mosaics m1
				LEFT JOIN mosaics m2
					ON m1.levy_namespace_name = m2.namespace_name AND m1.levy_namespace_name IS NOT NULL
				LEFT JOIN namespaces n
					ON m1.root_namespace = n.root_namespace
				LEFT JOIN blocks b1
					ON b1.height = n.registered_height
				LEFT JOIN blocks b2
					ON b2.height = m1.registered_height
				ORDER BY m1.id {sort}
				LIMIT %s OFFSET %s
			''', (limit, offset,))
			results = cursor.fetchall()

			return [self._create_mosaic_view(result) for result in results]

	def get_mosaic_rich_list(self, limit, offset, namespace_name):
		"""Gets mosaic rich list by namespace name pagination in database."""

		with self.connection() as connection:
			cursor = connection.cursor()
			cursor.execute('''
				WITH mosaic_list AS (
					SELECT
						a.address,
						ar.remarks,
						(mosaic->>'namespace_name') as namespace_name,
						(mosaic->>'quantity')::bigint as balance
					FROM
						accounts a
						LEFT JOIN account_remarks ar
							ON ar.address = a.address,
						jsonb_array_elements(mosaics) as mosaic
				)
				SELECT
					address,
					remarks,
					balance
				FROM
					mosaic_list
				WHERE namespace_name = %s
				ORDER BY balance DESC
				LIMIT %s OFFSET %s
			''', (namespace_name, limit, offset,))
			results = cursor.fetchall()

			return [self._create_mosaic_rich_list_view(result) for result in results]

	def get_transaction(self, transaction_hash):
		"""Gets transaction by transaction hash in database."""

		sql = self._generate_transaction_sql_query()
		sql += " WHERE t.transaction_hash = %s"
		params = ('\\x' + transaction_hash,)

		with self.connection() as connection:
			cursor = connection.cursor()
			cursor.execute(sql, params)
			result = cursor.fetchone()

			return self._create_transaction_list_view(result) if result else None

	def get_transactions(self, limit, offset, sort, query: TransactionQuery):
		"""Gets transactions pagination in database."""

		height, transaction_types, sender, address, sender_address, recipient_address, mosaic = query

		# Base SQL with CTE
		sql = """
			WITH transaction_list as (
				SELECT *
				FROM transactions t
		"""

		# Define parameters list
		params = []

		# Create a list to hold WHERE clauses
		where_clauses = []

		# Check for height filter
		if height is not None:
			where_clauses.append("t.height = %s")
			params.append(height)

		# Check for transaction type filter
		if transaction_types is not None:
			placeholders = ', '.join(['%s'] * len(transaction_types))
			where_clauses.append(f"t.transaction_type IN ({placeholders})")
			params.extend(transaction_types)

		# Check for address filter
		if address is not None:
			where_clauses.append("(t.signer_address = %s OR t.recipient_address = %s)")
			params.extend(['\\x' + Address(address).bytes.hex(), '\\x' + Address(address).bytes.hex()])
		else:
			# Check for sender address filter
			if sender_address is not None:
				where_clauses.append("t.signer_address = %s")
				params.extend(['\\x' + Address(sender_address).bytes.hex()])
			else:
				# Check for sender public key
				if sender is not None:
					where_clauses.append("t.sender = %s")
					params.extend(['\\x' + PublicKey(sender).bytes.hex()])

			# Check for recipient address filter
			if recipient_address is not None:
				where_clauses.append("t.recipient_address = %s")
				params.extend(['\\x' + Address(recipient_address).bytes.hex()])

		if mosaic:
			where_clauses.append(f"t.mosaics @> '[{{\"namespace_name\": \"{mosaic}\"}}]'")

		# Append WHERE clauses to SQL string if any exists
		if where_clauses:
			sql += " WHERE " + " AND ".join(where_clauses)

		# Closing CTE and adding ORDER BY, LIMIT, and OFFSET
		sql += f" ORDER BY t.height {sort} LIMIT %s OFFSET %s )"
		params.extend([limit, offset])

		# Join main query column from CTE table
		sql += self._generate_transaction_sql_query().replace('FROM transactions t', 'FROM transaction_list t')

		with self.connection() as connection:
			cursor = connection.cursor()
			cursor.execute(sql, params)
			results = cursor.fetchall()

			return [self._create_transaction_list_view(result) for result in results]

	def get_account(self, query: AccountQuery):
		"""Gets account by address in database."""

		address, public_key = query

		sql = self._generate_account_sql_query()

		params = []

		where_clauses = []

		if address is not None:
			where_clauses.append("(a.address = %s)")
			params.extend(['\\x' + Address(address).bytes.hex(),])
		else:
			if public_key is not None:
				where_clauses.append("a.public_key = %s")
				params.extend(['\\x' + PublicKey(public_key).bytes.hex()])

		if where_clauses:
			sql += " WHERE " + " AND ".join(where_clauses)

		with self.connection() as connection:
			cursor = connection.cursor()
			cursor.execute(sql, params)
			result = cursor.fetchone()

			return self._create_account_view(result) if result else None

	def get_accounts(self, limit, offset, sort):
		"""Gets accounts pagination in database."""

		sql = self._generate_account_sql_query()

		params = []

		sql += f" ORDER BY a.balance {sort} LIMIT %s OFFSET %s"
		params.extend([limit, offset])

		with self.connection() as connection:
			cursor = connection.cursor()
			cursor.execute(sql, params)
			results = cursor.fetchall()

			return [self._create_account_view(result) for result in results]

	def get_transaction_statistics(self):
		"""Gets transaction statistics from database."""

		with self.connection() as connection:
			cursor = connection.cursor()
			cursor.execute('''
				SELECT
					(SELECT SUM(total_transactions) FROM blocks) AS total_transactions,
					(SELECT SUM(total_transactions) FROM (
						SELECT total_transactions
						FROM blocks
						ORDER BY height DESC
						LIMIT 1440
					) AS latest_blocks) AS transaction_last_24_hours,
					(SELECT SUM(total_transactions) FROM (
						SELECT total_transactions
						FROM blocks
						ORDER BY height DESC
						LIMIT 43200
					) AS latest_blocks) AS transaction_last_30_day;
			''')
			result = cursor.fetchone()

			return self._create_transaction_statistic_view(result) if result else None

	def get_account_statistics(self):
		"""Gets account statistics from database."""

		with self.connection() as connection:
			cursor = connection.cursor()
			cursor.execute('''
				SELECT
					(SELECT COUNT(*) FROM accounts) AS total_accounts,
					(SELECT COUNT(*) FROM accounts WHERE balance > 0) AS accounts_with_balance,
					(SELECT COUNT(*) FROM accounts WHERE harvested_blocks > 0) AS harvested_accounts,
					(SELECT SUM(importance) FROM accounts) AS total_importance,
					(SELECT COUNT(*) FROM accounts WHERE vested_balance > 0 AND balance > 10000000000) AS eligible_harvest_accounts
			''')
			result = cursor.fetchone()

			return self._create_account_statistic_view(result) if result else None

	def get_mosaic_transfers(self, limit, offset, namespace_name):
		"""Gets mosaic transfers by namespace name pagination in database."""

		with self.connection() as connection:
			cursor = connection.cursor()
			cursor.execute('''
				SELECT
					t.signer_address,
					t.recipient_address,
					t.timestamp,
					mosaic_item->>'quantity' AS quantity
				FROM transactions t,
					jsonb_array_elements(t.mosaics) mosaic_item
				WHERE mosaic_item->>'namespace_name' = %s
				ORDER BY t.height DESC
				LIMIT %s OFFSET %s
			''', (namespace_name, limit, offset,))
			results = cursor.fetchall()

			return [self._create_mosaic_transfers_view(result) for result in results]
