class Transaction:
	def __init__(
		self,
		transaction_hash,
		height,
		sender,
		fee,
		timestamp,
		deadline,
		signature,
		transaction_type
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
		self.transaction_type = transaction_type

	def __eq__(self, other):
		return isinstance(other, Transaction) and all([
			self.transaction_type == other.transaction_type,
			self.height == other.height,
			self.sender == other.sender,
			self.fee == other.fee,
			self.timestamp == other.timestamp,
			self.deadline == other.deadline,
			self.signature == other.signature,
			self.transaction_type == other.transaction_type
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
		transaction_type,
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
			signature,
			transaction_type
		)

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
		transaction_type,
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
			signature,
			transaction_type
		)

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
		transaction_type,
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
			signature,
			transaction_type
		)

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
		transaction_type,
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
			signature,
			transaction_type
		)

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
		signature,
		transaction_type
	):
		"""Create CosignTransaction model."""

		# pylint: disable=too-many-arguments

		self.timestamp = timestamp
		self.other_hash = other_hash
		self.other_account = other_account
		self.sender = sender
		self.fee = fee
		self.deadline = deadline
		self.signature = signature
		self.transaction_type = transaction_type

	def __eq__(self, other):
		return isinstance(other, CosignSignatureTransaction) and all([
			self.timestamp == other.timestamp,
			self.other_hash == other.other_hash,
			self.other_account == other.other_account,
			self.sender == other.sender,
			self.fee == other.fee,
			self.deadline == other.deadline,
			self.signature == other.signature,
			self.transaction_type == other.transaction_type
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
		transaction_type,
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
			signature,
			transaction_type
		)

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
		transaction_type,
		creation_fee,
		creation_fee_sink,
		creator,
		description,
		properties,
		levy,
		namespace_name
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
			signature,
			transaction_type
		)

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
		transaction_type,
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
			signature,
			transaction_type
		)

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
