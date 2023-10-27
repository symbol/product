from rest.db.NemDatabase import NemDatabase
from rest.model.Account import AccountQuery
from rest.model.Transaction import TransactionQuery


class NemRestFacade:
	"""Nem Rest Facade."""

	def __init__(self, db_config, network):
		"""Creates a facade object."""

		self.nem_db = NemDatabase(db_config, network)
		self.network = network

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
