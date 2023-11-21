from symbolchain.nc import TransactionType


class Transaction:
	def __init__(self, transaction_hash, height, sender, signer_address, recipient_address, mosaics, fee, timestamp, deadline, signature, transaction_type):
		"""Create Block model."""

		# pylint: disable=too-many-arguments

		self.transaction_hash = transaction_hash
		self.height = height
		self.sender = sender
		self.signer_address = signer_address
		self.recipient_address = recipient_address
		self.mosaics = mosaics
		self.fee = fee
		self.timestamp = timestamp
		self.deadline = deadline
		self.signature = signature
		self.transaction_type = transaction_type

	def __eq__(self, other):
		return isinstance(other, Transaction) and all([
			self.transaction_hash == other.transaction_hash,
			self.height == other.height,
			self.sender == other.sender,
			self.signer_address == other.signer_address,
			self.recipient_address == other.recipient_address,
			self.mosaics == other.mosaics,
			self.fee == other.fee,
			self.timestamp == other.timestamp,
			self.deadline == other.deadline,
			self.signature == other.signature,
			self.transaction_type == other.transaction_type
		])


class TransferTransaction:
	def __init__(self, amount, recipient, mosaics, message, is_apostille):
		"""Create TransferTransaction model."""

		# pylint: disable=too-many-arguments

		self.amount = amount
		self.recipient = recipient
		self.mosaics = mosaics
		self.message = message
		self.is_apostille = is_apostille

	def __eq__(self, other):
		return isinstance(other, TransferTransaction) and all([
			self.amount == other.amount,
			self.recipient == other.recipient,
			self.mosaics == other.mosaics,
			self.message == other.message,
			self.is_apostille == other.is_apostille
		])


class AccountKeyLinkTransaction:
	def __init__(self, mode, remote_account):
		""""Create AccountKeyLinkTransaction model."""

		# pylint: disable=too-many-arguments

		self.mode = mode
		self.remote_account = remote_account

	def __eq__(self, other):
		return isinstance(other, AccountKeyLinkTransaction) and all([
			self.mode == other.mode,
			self.remote_account == other.remote_account
		])


class MultisigAccountModificationTransaction:
	def __init__(self, min_cosignatories, modifications):
		"""Create MultisigAccountModificationTransaction model."""

		# pylint: disable=too-many-arguments

		self.min_cosignatories = min_cosignatories
		self.modifications = modifications

	def __eq__(self, other):
		return isinstance(other, MultisigAccountModificationTransaction) and all([
			self.min_cosignatories == other.min_cosignatories,
			self.modifications == other.modifications
		])


class MultisigTransaction:
	def __init__(self, initiator, signatures, other_transaction, inner_hash):
		"""Create MultisigTransaction model."""

		# pylint: disable=too-many-arguments

		self.initiator = initiator
		self.signatures = signatures
		self.other_transaction = other_transaction
		self.inner_hash = inner_hash

	def __eq__(self, other):
		return isinstance(other, MultisigTransaction) and all([
			self.initiator == other.initiator,
			self.signatures == other.signatures,
			self.other_transaction == other.other_transaction,
			self.inner_hash == other.inner_hash
		])


class NamespaceRegistrationTransaction:
	def __init__(self, rental_fee_sink, rental_fee, parent, namespace):
		"""Create NamespaceRegistrationTransaction model."""

		# pylint: disable=too-many-arguments

		self.rental_fee_sink = rental_fee_sink
		self.rental_fee = rental_fee
		self.parent = parent
		self.namespace = namespace

	def __eq__(self, other):
		return isinstance(other, NamespaceRegistrationTransaction) and all([
			self.rental_fee_sink == other.rental_fee_sink,
			self.rental_fee == other.rental_fee,
			self.parent == other.parent,
			self.namespace == other.namespace
		])


class MosaicDefinitionTransaction:
	def __init__(self, creation_fee_sink, creation_fee, creator, description, namespace_name, properties, levy):
		"""Create MosaicDefinitionTransaction model."""

		# pylint: disable=too-many-arguments

		self.creation_fee_sink = creation_fee_sink
		self.creation_fee = creation_fee
		self.creator = creator
		self.description = description
		self.namespace_name = namespace_name
		self.properties = properties
		self.levy = levy

	def __eq__(self, other):
		return isinstance(other, MosaicDefinitionTransaction) and all([
			self.creation_fee_sink == other.creation_fee_sink,
			self.creation_fee == other.creation_fee,
			self.creator == other.creator,
			self.description == other.description,
			self.namespace_name == other.namespace_name,
			self.properties == other.properties,
			self.levy == other.levy
		])


class MosaicSupplyChangeTransaction:
	def __init__(self, supply_type, delta, namespace_name):
		"""Create MosaicSupplyChangeTransaction model."""

		# pylint: disable=too-many-arguments

		self.supply_type = supply_type
		self.delta = delta
		self.namespace_name = namespace_name

	def __eq__(self, other):
		return isinstance(other, MosaicSupplyChangeTransaction) and all([
			self.supply_type == other.supply_type,
			self.delta == other.delta,
			self.namespace_name == other.namespace_name
		])


class TransactionFactory:
	transaction_type_mapping = {
		TransactionType.TRANSFER.value: TransferTransaction,
		TransactionType.ACCOUNT_KEY_LINK.value: AccountKeyLinkTransaction,
		TransactionType.MULTISIG_ACCOUNT_MODIFICATION.value: MultisigAccountModificationTransaction,
		TransactionType.MULTISIG.value: MultisigTransaction,
		TransactionType.NAMESPACE_REGISTRATION.value: NamespaceRegistrationTransaction,
		TransactionType.MOSAIC_DEFINITION.value: MosaicDefinitionTransaction,
		TransactionType.MOSAIC_SUPPLY_CHANGE.value: MosaicSupplyChangeTransaction,
	}

	@classmethod
	def create_transaction(cls, transaction_type, *args):
		transaction_class = cls.transaction_type_mapping.get(transaction_type)

		if not transaction_class:
			raise ValueError(f"Unsupported transaction type: {transaction_type}")

		return transaction_class(*args)
