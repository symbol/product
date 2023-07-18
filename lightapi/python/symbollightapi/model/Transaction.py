from symbolchain.nc import TransactionType

from ..model.Exceptions import UnknownTransactionType


class Transaction:
	def __init__(
		self,
		transaction_hash,
		height,
		sender,
		fee,
		timestamp,
		deadline,
		signature
	):
		"""Create Transaction model."""

		# pylint: disable=too-many-arguments

		self.transaction_hash = transaction_hash
		self.height = height
		self.sender = sender
		self.fee = fee
		self.timestamp = timestamp
		self.deadline = deadline
		self.signature = signature

	def __eq__(self, other):
		return isinstance(other, Transaction) and all([
			self.transaction_hash == other.transaction_hash,
			self.height == other.height,
			self.sender == other.sender,
			self.fee == other.fee,
			self.timestamp == other.timestamp,
			self.deadline == other.deadline,
			self.signature == other.signature
		])


class TransferTransaction(Transaction):
	def __init__(
		self,
		transaction_hash,
		height,
		sender,
		fee,
		timestamp,
		deadline,
		signature,
		amount,
		recipient,
		message,
		mosaics
	):
		"""Create TransferTransaction model."""

		# pylint: disable=too-many-arguments

		super().__init__(
			transaction_hash,
			height,
			sender,
			fee,
			timestamp,
			deadline,
			signature
		)

		self.transaction_type = TransactionType.TRANSFER.value
		self.amount = amount
		self.recipient = recipient
		self.message = message
		self.mosaics = mosaics

	def __eq__(self, other):
		return isinstance(other, TransferTransaction) and all([
			super().__eq__(other),
			self.amount == other.amount,
			self.recipient == other.recipient,
			self.message == other.message,
			self.mosaics == other.mosaics
		])


class ImportanceTransferTransaction(Transaction):
	def __init__(
		self,
		transaction_hash,
		height,
		sender,
		fee,
		timestamp,
		deadline,
		signature,
		mode,
		remote_account
	):
		"""Create ImportanceTransferTransaction model."""

		# pylint: disable=too-many-arguments

		super().__init__(
			transaction_hash,
			height,
			sender,
			fee,
			timestamp,
			deadline,
			signature
		)

		self.transaction_type = TransactionType.ACCOUNT_KEY_LINK.value
		self.mode = mode
		self.remote_account = remote_account

	def __eq__(self, other):
		return isinstance(other, ImportanceTransferTransaction) and all([
			super().__eq__(other),
			self.mode == other.mode,
			self.remote_account == other.remote_account
		])


class ConvertAccountToMultisigTransaction(Transaction):
	def __init__(
		self,
		transaction_hash,
		height,
		sender,
		fee,
		timestamp,
		deadline,
		signature,
		min_cosignatories,
		modifications
	):
		"""Create ConvertAccountToMultisigTransaction model."""

		# pylint: disable=too-many-arguments

		super().__init__(
			transaction_hash,
			height,
			sender,
			fee,
			timestamp,
			deadline,
			signature
		)

		self.transaction_type = TransactionType.MULTISIG_ACCOUNT_MODIFICATION.value
		self.min_cosignatories = min_cosignatories
		self.modifications = modifications

	def __eq__(self, other):
		return isinstance(other, ConvertAccountToMultisigTransaction) and all([
			super().__eq__(other),
			self.min_cosignatories == other.min_cosignatories,
			self.modifications == other.modifications,
		])


class MultisigTransaction(Transaction):
	def __init__(
		self,
		transaction_hash,
		height,
		sender,
		fee,
		timestamp,
		deadline,
		signature,
		signatures,
		other_transaction,
		inner_hash
	):
		"""Create MultisigTransaction model."""

		# pylint: disable=too-many-arguments

		super().__init__(
			transaction_hash,
			height,
			sender,
			fee,
			timestamp,
			deadline,
			signature
		)

		self.transaction_type = TransactionType.MULTISIG_TRANSACTION.value
		self.signatures = signatures
		self.other_transaction = other_transaction
		self.inner_hash = inner_hash

	def __eq__(self, other):
		return isinstance(other, MultisigTransaction) and all([
			super().__eq__(other),
			self.signatures == other.signatures,
			self.other_transaction == other.other_transaction,
			self.inner_hash == other.inner_hash
		])


class CosignSignatureTransaction():
	def __init__(
		self,
		timestamp,
		other_hash,
		other_account,
		sender,
		fee,
		deadline,
		signature
	):
		"""Create CosignSignatureTransaction model."""

		# pylint: disable=too-many-arguments

		self.transaction_type = TransactionType.MULTISIG_COSIGNATURE.value
		self.timestamp = timestamp
		self.other_hash = other_hash
		self.other_account = other_account
		self.sender = sender
		self.fee = fee
		self.deadline = deadline
		self.signature = signature

	def __eq__(self, other):
		return isinstance(other, CosignSignatureTransaction) and all([
			self.timestamp == other.timestamp,
			self.other_hash == other.other_hash,
			self.other_account == other.other_account,
			self.sender == other.sender,
			self.fee == other.fee,
			self.deadline == other.deadline,
			self.signature == other.signature
		])


class NamespaceRegistrationTransaction(Transaction):
	def __init__(
		self,
		transaction_hash,
		height,
		sender,
		fee,
		timestamp,
		deadline,
		signature,
		rental_fee_sink,
		rental_fee,
		parent,
		namespace
	):
		"""Create NamespaceRegistration model."""

		# pylint: disable=too-many-arguments

		super().__init__(
			transaction_hash,
			height,
			sender,
			fee,
			timestamp,
			deadline,
			signature
		)

		self.transaction_type = TransactionType.NAMESPACE_REGISTRATION.value
		self.rental_fee_sink = rental_fee_sink
		self.rental_fee = rental_fee
		self.parent = parent
		self.namespace = namespace

	def __eq__(self, other):
		return isinstance(other, NamespaceRegistrationTransaction) and all([
			super().__eq__(other),
			self.rental_fee_sink == other.rental_fee_sink,
			self.rental_fee == other.rental_fee,
			self.parent == other.parent,
			self.namespace == other.namespace,
		])


class MosaicDefinitionTransaction(Transaction):
	def __init__(
		self,
		transaction_hash,
		height,
		sender,
		fee,
		timestamp,
		deadline,
		signature,
		creation_fee,
		creation_fee_sink,
		creator,
		description,
		properties,
		levy,
		namespace_name
	):
		"""Create MosaicDefinitionTransaction model."""

		# pylint: disable=too-many-arguments

		super().__init__(
			transaction_hash,
			height,
			sender,
			fee,
			timestamp,
			deadline,
			signature
		)

		self.transaction_type = TransactionType.MOSAIC_DEFINITION.value
		self.creation_fee = creation_fee
		self.creation_fee_sink = creation_fee_sink
		self.creator = creator
		self.description = description
		self.namespace_name = namespace_name
		self.properties = properties
		self.levy = levy

	def __eq__(self, other):
		return isinstance(other, MosaicDefinitionTransaction) and all([
			super().__eq__(other),
			self.creation_fee == other.creation_fee,
			self.creation_fee_sink == other.creation_fee_sink,
			self.creator == other.creator,
			self.description == other.description,
			self.namespace_name == other.namespace_name,
			self.properties == other.properties,
			self.levy == other.levy,
		])


class MosaicSupplyChangeTransaction(Transaction):
	def __init__(
		self,
		transaction_hash,
		height,
		sender,
		fee,
		timestamp,
		deadline,
		signature,
		supply_type,
		delta,
		namespace_name
	):
		"""Create MosaicSupplyChangeTransaction model."""

		# pylint: disable=too-many-arguments

		super().__init__(
			transaction_hash,
			height,
			sender,
			fee,
			timestamp,
			deadline,
			signature
		)

		self.transaction_type = TransactionType.MOSAIC_SUPPLY_CHANGE.value
		self.supply_type = supply_type
		self.delta = delta
		self.namespace_name = namespace_name

	def __eq__(self, other):
		return isinstance(other, MosaicSupplyChangeTransaction) and all([
			super().__eq__(other),
			self.supply_type == other.supply_type,
			self.delta == other.delta,
			self.namespace_name == other.namespace_name,
		])


class TransactionFactory:
	"""Create transaction models."""

	@staticmethod
	def create_transaction(tx_type, common_args, specific_args):
		transaction_mapping = {
			TransactionType.TRANSFER.value: TransferTransaction,
			TransactionType.ACCOUNT_KEY_LINK.value: ImportanceTransferTransaction,
			TransactionType.MULTISIG_ACCOUNT_MODIFICATION.value: ConvertAccountToMultisigTransaction,
			TransactionType.MULTISIG_TRANSACTION.value: MultisigTransaction,
			TransactionType.NAMESPACE_REGISTRATION.value: NamespaceRegistrationTransaction,
			TransactionType.MOSAIC_DEFINITION.value: MosaicDefinitionTransaction,
			TransactionType.MOSAIC_SUPPLY_CHANGE.value: MosaicSupplyChangeTransaction,
		}

		transaction_class = transaction_mapping.get(tx_type)

		if not transaction_class:
			raise UnknownTransactionType(f'Unknown transaction type {tx_type}')

		return transaction_class(**common_args, **specific_args)
