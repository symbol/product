from symbolchain.CryptoTypes import PublicKey
from symbolchain.nc import TransactionType
from symbolchain.nem.Network import Address
from symbollightapi.connector.NemConnector import NemConnector

from rest.db.NemDatabase import NemDatabase
from rest.model.Account import AccountQuery
from rest.model.Transaction import TransactionListView, TransactionQuery


class NemRestFacade:
	"""Nem Rest Facade."""

	def __init__(self, db_config, network, node_url):
		"""Creates a facade object."""

		self.nem_db = NemDatabase(db_config, network)
		self.network = network
		self.nem_connector = NemConnector(node_url, network)

	def get_block(self, height):
		"""Gets block by height."""

		block = self.nem_db.get_block(height)

		return block.to_dict() if block else None

	def get_blocks(self, limit, offset, min_height, sort):
		"""Gets blocks pagination."""

		blocks = self.nem_db.get_blocks(limit, offset, min_height, sort)

		return [block.to_dict() for block in blocks]

	def get_namespace(self, name):
		"""Gets namespace by root namespace name."""

		namespace = self.nem_db.get_namespace(name)

		return namespace.to_dict() if namespace else None

	def get_namespaces(self, limit, offset, sort):
		"""Gets namespaces pagination."""

		namespaces = self.nem_db.get_namespaces(limit, offset, sort)

		return [namespace.to_dict() for namespace in namespaces]

	def get_mosaic(self, name):
		"""Gets mosaic by namespace name."""

		mosaic = self.nem_db.get_mosaic(name)

		return mosaic.to_dict() if mosaic else None

	def get_mosaics(self, limit, offset, sort):
		"""Gets mosaics pagination."""

		mosaics = self.nem_db.get_mosaics(limit, offset, sort)

		return [mosaic.to_dict() for mosaic in mosaics]

	def get_mosaic_rich_list(self, limit, offset, namespace_name):
		"""Gets mosaic rich list pagination."""

		mosaics = self.nem_db.get_mosaic_rich_list(limit, offset, namespace_name)

		return [mosaic.to_dict() for mosaic in mosaics]

	def get_transaction(self, hash):
		"""Gets transaction by hash."""

		transaction = self.nem_db.get_transaction(hash)

		return transaction.to_dict() if transaction else None

	def get_transactions(self, limit, offset, sort, query: TransactionQuery):
		"""Gets transactions pagination."""

		transactions = self.nem_db.get_transactions(limit, offset, sort, query)

		return [transaction.to_dict() for transaction in transactions]

	def get_account(self, query: AccountQuery):
		"""Gets account by address."""

		account = self.nem_db.get_account(query)

		return account.to_dict() if account else None

	def get_accounts(self, limit, offset, sort):
		"""Gets accounts pagination."""

		accounts = self.nem_db.get_accounts(limit, offset, sort)

		return [account.to_dict() for account in accounts]

	def get_transaction_statistics(self):
		"""Gets statistics."""

		statistics = self.nem_db.get_transaction_statistics()

		return statistics.to_dict() if statistics else None

	def get_account_statistics(self):
		"""Gets account statistics."""

		statistics = self.nem_db.get_account_statistics()

		return statistics.to_dict() if statistics else None

	def get_mosaic_transfers(self, limit, offset, namespace_name):
		"""Gets mosaic transfers pagination."""

		mosaics = self.nem_db.get_mosaic_transfers(limit, offset, namespace_name)

		return [mosaic.to_dict() for mosaic in mosaics]

	async def get_unconfirmed_transactions(self):
		"""Gets unconfirmed transactions."""

		def _format_xem_relative(amount):
			return amount / (10 ** 6)

		transaction_type_mapping = {
			257: TransactionType.TRANSFER.name,
			2049: TransactionType.ACCOUNT_KEY_LINK.name,
			4100: TransactionType.MULTISIG.name,
			4097: TransactionType.MULTISIG_ACCOUNT_MODIFICATION.name,
			16385: TransactionType.MOSAIC_DEFINITION.name,
			16386: TransactionType.MOSAIC_SUPPLY_CHANGE.name,
			8193: TransactionType.NAMESPACE_REGISTRATION.name
		}

		unconfirmed_transactions_data = await self.nem_connector.get_unconfirmed_transactions()
		unconfirmed_transactions = []

		for transaction in unconfirmed_transactions_data:
			from_address = self.network.public_key_to_address(PublicKey(transaction.sender))
			fee = _format_xem_relative(transaction.fee)
			to_address = Address(transaction.recipient) if hasattr(transaction, 'recipient') else None

			transaction_type = transaction.transaction_type

			value = []
			embedded_transactions = None

			if transaction_type == 257:  # Transfer
				if transaction.message is not None:
					value.append({
						'message': {
							'payload': transaction.message.payload,
							'is_plain': transaction.message.is_plain
						}
					})
				else:
					value.append({
						'message': None
					})

				if transaction.mosaics is None:
					value.append({
						'namespace': 'nem.xem',
						'amount': _format_xem_relative(transaction.amount)
					})
				else:
					multiply = transaction.amount if transaction.amount == 0 else transaction.amount / 1000000

					for mosaic in transaction.mosaics:
						amount = mosaic.quantity * multiply
						value.append({
							'namespace': mosaic.namespace_name,
							'amount': _format_xem_relative(amount) if mosaic.namespace_name == 'nem.xem' else amount
						})

			elif transaction_type == 2049:  # Account key link
				value.append({
					'mode': transaction.mode,
					'remoteAccount': transaction.remote_account
				})

			elif transaction_type == 4097:  # Multisig account modification
				value.append({
					'minCosignatories': transaction.min_cosignatories,
					'modifications': [{
						'cosignatoryAccount': str(self.network.public_key_to_address(PublicKey(modification.cosignatory_account))),
						'modificationType': modification.modification_type
					} for modification in transaction.modifications]
				})

			elif transaction_type == 4100:  # Multisig
				value = None
				embedded_transactions = []
				inner_transaction = {}

				other_transaction = transaction.other_transaction

				inner_transaction_type = other_transaction.transaction_type

				inner_transaction['initiator'] = str(self.network.public_key_to_address(PublicKey(transaction.sender)))
				inner_transaction['transactionType'] = transaction_type_mapping.get(inner_transaction_type, None)
				inner_transaction['signatures'] = [{
					'signer': str(self.network.public_key_to_address(PublicKey(signature.sender))),
					'signature': signature.signature.upper()
				} for signature in transaction.signatures]

				if inner_transaction_type == 257:
					from_address = self.network.public_key_to_address(PublicKey(other_transaction.sender))
					to_address = Address(other_transaction.recipient)

					if other_transaction.message is not None:
						inner_transaction['message'] = {
							'payload': other_transaction.message.payload,
							'is_plain': other_transaction.message.is_plain
						}
					else:
						inner_transaction['message'] = None

					mosaics = other_transaction.mosaics
					amount = other_transaction.amount

					if mosaics is None:
						inner_transaction['mosaics'] = {
							'namespace': 'nem.xem',
							'amount': _format_xem_relative(amount)
						}
					else:
						multiply = amount if amount == 0 else amount / 1000000

						for mosaic in mosaics:
							amount = mosaic.quantity * multiply
							inner_transaction['mosaics'] = {
								'namespace': mosaic.namespace_name,
								'amount': (_format_xem_relative(amount) if mosaic.namespace_name == 'nem.xem' else amount)
							}

				elif inner_transaction_type == 2049:
					inner_transaction['mode'] = other_transaction.mode
					inner_transaction['remoteAccount'] = other_transaction.remote_account

				elif inner_transaction_type == 4097:
					inner_transaction['minCosignatories'] = other_transaction.min_cosignatories
					inner_transaction['modifications'] = [{
						'cosignatoryAccount': str(self.network.public_key_to_address(PublicKey(modification.cosignatory_account))),
						'modificationType': modification.modification_type
					} for modification in other_transaction.modifications]

				elif inner_transaction_type == 8193:
					to_address = other_transaction.rental_fee_sink
					rental_fee = other_transaction.rental_fee
					namespace = other_transaction.namespace

					inner_transaction['namespaceName'] = namespace
					inner_transaction['sinkFee'] = _format_xem_relative(rental_fee)

				elif inner_transaction_type == 16385:
					to_address = other_transaction.creation_fee_sink
					creation_fee = other_transaction.creation_fee
					namespace_name = other_transaction.namespace_name

					inner_transaction['mosaicNamespaceName'] = namespace_name
					inner_transaction['sinkFee'] = _format_xem_relative(creation_fee)

				elif inner_transaction_type == 16386:
					inner_transaction['supplyType'] = other_transaction.supply_type
					inner_transaction['delta'] = other_transaction.delta
					inner_transaction['namespaceName'] = other_transaction.namespace_name

				embedded_transactions.append(inner_transaction)

			elif transaction_type == 8193:  # Namespace registration
				value.append({
					'namespaceName': transaction.namespace,
					'sinkFee': _format_xem_relative(transaction.rental_fee)
				})
			elif transaction_type == 16385:  # Mosaic namespace creation
				value.append({
					'mosaicNamespaceName': transaction.namespace_name,
					'sinkFee': _format_xem_relative(transaction.creation_fee)
				})
			elif transaction_type == 16386:  # Mosaic supply change
				value.append({
					'supplyType': transaction.supply_type,
					'delta': transaction.delta,
					'namespaceName': transaction.namespace_name
				})

			unconfirmed_transactions.append(
				TransactionListView(
					transaction_hash=transaction.transaction_hash,
					transaction_type=transaction_type_mapping.get(transaction_type, None),
					from_address=from_address,
					to_address=to_address,
					value=value,
					fee=fee,
					height=transaction.height,
					timestamp=transaction.timestamp,
					deadline=transaction.deadline,
					embedded_transactions=embedded_transactions,
					signature=transaction.signature.upper(),
				)
			)

		return [transaction.to_dict() for transaction in unconfirmed_transactions]
