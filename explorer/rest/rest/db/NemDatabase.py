from binascii import hexlify, unhexlify

from symbolchain.CryptoTypes import PublicKey
from symbolchain.nem.Network import Address

from rest.model.Block import BlockView
from rest.model.Mosaic import MosaicView
from rest.model.Namespace import NamespaceView
from rest.model.Transaction import TransactionListView

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
			257: 'transfer',
			2049: 'account_key_link',
			4100: 'multisig',
			4097: 'multisig_account_modification',
			16385: 'mosaic_namespace_creation',
			16386: 'mosaic_supply_change',
			8193: 'namespace_registration'
		}

		(
			transaction_hash,
			transaction_type,
			address_from,
			address_to,
			transfer_mosaic,
			transfer_amount,
			mosaic_namespace_creation_name,
			multisig_inner_transaction,
			account_key_link_mode,
			multisig_account_modification_min_cosignatories,
			multisig_account_modification_modifications,
			mosaic_supply_change_type,
			mosaic_supply_change_delta,
			mosaic_supply_change_namespace_name,
			fee,
			mosaic_namespace_sink_fee,
			height,
			timestamp
		) = result

		value = []
		fees = [{
			'transaction_fee': _format_xem_relative(fee)
		}]

		from_address = self.network.public_key_to_address(PublicKey(_format_bytes(address_from)))
		to_address = Address(unhexlify(_format_bytes(address_to))) if address_to else None

		if transaction_type == 257:  # Transfer
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
				'account_key_link_mode': account_key_link_mode
			})
		elif transaction_type == 4097:  # Multisig account modification
			value.append({
				'min_cosignatories': multisig_account_modification_min_cosignatories,
				'modifications': multisig_account_modification_modifications
			})
		elif transaction_type == 4100:  # Multisig
			if multisig_inner_transaction['transaction_type'] == 257:
				to_address = multisig_inner_transaction['recipient']

				mosaics = multisig_inner_transaction['mosaics']
				amount = multisig_inner_transaction['amount']

				if not mosaics:
					value.append({
						'namespace': 'nem.xem',
						'amount': _format_xem_relative(amount)
					})
				else:
					multiply = amount if amount == 0 else amount / 1000000

					for mosaic in mosaics:
						amount = mosaic['quantity'] * multiply
						value.append({
							'namespace': mosaic['namespace_name'],
							'amount': (_format_xem_relative(amount) if mosaic['namespace_name'] == 'nem.xem' else amount)
						})

			elif multisig_inner_transaction['transaction_type'] == 2049:
				value.append({
					'account_key_link_mode': multisig_inner_transaction['mode']
				})

			elif multisig_inner_transaction['transaction_type'] == 4097:
				value.append({
					'min_cosignatories': multisig_inner_transaction['min_cosignatories'],
					'modifications': multisig_inner_transaction['modifications']
				})

			elif multisig_inner_transaction['transaction_type'] == 8193:
				to_address = multisig_inner_transaction['rental_fee_sink']
				rental_fee = multisig_inner_transaction['rental_fee']
				namespace = multisig_inner_transaction['namespace']

				fees.append({
					'sink_fee': _format_xem_relative(rental_fee)
				})
				value.append({
					'namespace_name': namespace
				})

			elif multisig_inner_transaction['transaction_type'] == 16385:
				to_address = multisig_inner_transaction['creation_fee_sink']
				creation_fee = multisig_inner_transaction['creation_fee']
				namespace_name = multisig_inner_transaction['namespace_name']

				fees.append({
					'sink_fee': _format_xem_relative(creation_fee)
				})
				value.append({
					'mosaic_namespace_name': namespace_name
				})
			elif multisig_inner_transaction['transaction_type'] == 16386:
				value.append({
					'supply_type': multisig_inner_transaction['supply_type'],
					'delta': multisig_inner_transaction['delta'],
					'namespace_name': multisig_inner_transaction['namespace_name']
				})

		elif transaction_type == 8193:  # Namespace registration
			fees.append({
				'sink_fee': _format_xem_relative(mosaic_namespace_sink_fee)
			})
			value.append({
				'namespace_name': mosaic_namespace_creation_name
			})
		elif transaction_type == 16385:  # Mosaic namespace creation
			fees.append({
				'sink_fee': _format_xem_relative(mosaic_namespace_sink_fee)
			})
			value.append({
				'mosaic_namespace_name': mosaic_namespace_creation_name
			})
		elif transaction_type == 16386:  # Mosaic supply change
			value.append({
				'supply_type': mosaic_supply_change_type,
				'delta': mosaic_supply_change_delta,
				'namespace_name': mosaic_supply_change_namespace_name
			})

		return TransactionListView(
			transaction_hash=_format_bytes(transaction_hash),
			transaction_type=transaction_type_mapping.get(transaction_type, None),
			from_address=from_address,
			to_address=to_address,
			value=value,
			fees=fees,
			height=height,
			timestamp=timestamp
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

	def get_transactions(self, limit, offset, sort):
		"""Gets transactions pagination in database."""

		with self.connection() as connection:
			cursor = connection.cursor()
			cursor.execute(f'''
				SELECT
					t.transaction_hash,
					t.transaction_type,
					t.sender AS from,
					CASE
						WHEN transaction_type = 257 THEN tt.recipient
						WHEN transaction_type = 8193 THEN tnr.rental_fee_sink
						WHEN transaction_type = 16385 THEN tmdc.creation_fee_sink
						ELSE NULL
					END AS to,
					CASE
						WHEN transaction_type = 257 Then tt.mosaics
						ELSE NULL
					END AS transfer_mosaic,
					CASE
						WHEN transaction_type = 257 Then tt.amount
						ELSE NULL
					END AS transfer_amount,
					CASE
						WHEN transaction_type = 8193 THEN tnr.namespace
						WHEN transaction_type = 16385 THEN tmdc.namespace_name
					END AS mosaic_namespace_creation_name,
					CASE
						WHEN transaction_type = 4100 Then tm.other_transaction
						ELSE NULL
					END AS multisig_inner_transaction,
					CASE
						WHEN transaction_type = 2049 Then takl.mode
						ELSE NULL
					END AS account_key_link_mode,
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
					t.fee,
					CASE
						WHEN transaction_type = 8193 THEN tnr.rental_fee
						WHEN transaction_type = 16385 THEN tmdc.creation_fee
						ELSE NULL
					END AS mosaic_namespace_sink_fee,
					t.height,
					t.timestamp
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
				ORDER BY t.height {sort}
				LIMIT %s OFFSET %s
			''', (limit, offset,))
			results = cursor.fetchall()

			return [self._create_transaction_list_view(result) for result in results]
