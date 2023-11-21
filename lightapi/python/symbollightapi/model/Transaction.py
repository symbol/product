from collections import namedtuple

from symbolchain.nc import TransactionType

from ..model.Exceptions import UnknownTransactionType

Message = namedtuple('Message', ['payload', 'is_plain'])
Mosaic = namedtuple('Mosaic', ['namespace_name', 'quantity'])
Modification = namedtuple('Modification', ['modification_type', 'cosignatory_account'])
MosaicLevy = namedtuple('MosaicLevy', ['fee', 'recipient', 'type', 'namespace_name'])
MosaicProperties = namedtuple('MosaicProperties', ['divisibility', 'initial_supply', 'supply_mutable', 'transferable'])

MICROXEM_PER_XEM = 1000000

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
			self.transaction_hash == other.transaction_hash,
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
			TransactionType.TRANSFER.value
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


class AccountKeyLinkTransaction(Transaction):
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
		"""Create AccountKeyLinkTransaction model."""

		# pylint: disable=too-many-arguments

		super().__init__(
			transaction_hash,
			height,
			sender,
			fee,
			timestamp,
			deadline,
			signature,
			TransactionType.ACCOUNT_KEY_LINK.value
		)

		self.mode = mode
		self.remote_account = remote_account

	def __eq__(self, other):
		return isinstance(other, AccountKeyLinkTransaction) and all([
			super().__eq__(other),
			self.mode == other.mode,
			self.remote_account == other.remote_account
		])


class MultisigAccountModificationTransaction(Transaction):
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
		"""Create MultisigAccountModificationTransaction model."""

		# pylint: disable=too-many-arguments

		super().__init__(
			transaction_hash,
			height,
			sender,
			fee,
			timestamp,
			deadline,
			signature,
			TransactionType.MULTISIG_ACCOUNT_MODIFICATION.value
		)

		self.min_cosignatories = min_cosignatories
		self.modifications = modifications

	def __eq__(self, other):
		return isinstance(other, MultisigAccountModificationTransaction) and all([
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
			signature,
			TransactionType.MULTISIG.value
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
			signature,
			TransactionType.NAMESPACE_REGISTRATION.value
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
			signature,
			TransactionType.MOSAIC_DEFINITION.value
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
			TransactionType.MOSAIC_SUPPLY_CHANGE.value
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


class TransactionHandler:
	"""Transaction handle mapper."""
	def __init__(self):
		self.map = {
			TransactionType.TRANSFER.value: self._map_transfer_args,
			TransactionType.ACCOUNT_KEY_LINK.value: self._map_account_key_link_args,
			TransactionType.MULTISIG_ACCOUNT_MODIFICATION.value: self._map_multisig_account_modification_args,
			TransactionType.MULTISIG.value: self._map_multisig_args,
			TransactionType.NAMESPACE_REGISTRATION.value: self._map_namespace_registration_args,
			TransactionType.MOSAIC_DEFINITION.value: self._map_mosaic_definition_args,
			TransactionType.MOSAIC_SUPPLY_CHANGE.value: self._map_mosaic_supply_change_args,
		}

	@staticmethod
	def _map_transfer_args(tx_dict):
		message = tx_dict['message']

		if message:
			message = Message(
				message['payload'],
				message['type']
			)
		else:
			message = None

		mosaics = None
		if 'mosaics' in tx_dict:
			mosaics = [
				Mosaic(
					f'{mosaic["mosaicId"]["namespaceId"]}.{mosaic["mosaicId"]["name"]}',
					mosaic['quantity']
				)
				for mosaic in tx_dict['mosaics']
			]

		return {
			'amount': tx_dict['amount'] / MICROXEM_PER_XEM,
			'recipient': tx_dict['recipient'],
			'message': message,
			'mosaics': mosaics,
		}

	@staticmethod
	def _map_account_key_link_args(tx_dict):
		return {
			'mode': tx_dict['mode'],
			'remote_account': tx_dict['remoteAccount'],
		}

	@staticmethod
	def _map_multisig_account_modification_args(tx_dict):
		min_cosignatories = 0
		if 'minCosignatories' in tx_dict and 'relativeChange' in tx_dict['minCosignatories']:
			min_cosignatories = tx_dict['minCosignatories']['relativeChange']

		return {
			'min_cosignatories': min_cosignatories,
			'modifications': [
				Modification(
					modification['modificationType'],
					modification['cosignatoryAccount'])
				for modification in tx_dict['modifications']
			]
		}

	def _map_multisig_args(self, tx_dict, inner_hash):

		other_transaction = tx_dict['otherTrans']

		specific_args = self.map[other_transaction['type']](other_transaction)

		common_args = {
			'transaction_hash': None,
			'height': None,
			'sender': other_transaction['signer'],
			'fee': other_transaction['fee'] / MICROXEM_PER_XEM,
			'timestamp': other_transaction['timeStamp'],
			'deadline': other_transaction['deadline'],
			'signature': None,
		}

		return {
			'signatures': [
				CosignSignatureTransaction(
					signature['timeStamp'],
					signature['otherHash']['data'],
					signature['otherAccount'],
					signature['signer'],
					signature['fee'],
					signature['deadline'],
					signature['signature']
				)
				for signature in tx_dict['signatures']
			],
			'other_transaction': TransactionFactory.create_transaction(other_transaction['type'], common_args, specific_args),
			'inner_hash': inner_hash,
		}

	@staticmethod
	def _map_namespace_registration_args(tx_dict):
		return {
			'rental_fee_sink': tx_dict['rentalFeeSink'],
			'rental_fee': tx_dict['rentalFee'],
			'parent': tx_dict['parent'],
			'namespace': tx_dict['newPart'],
		}

	@staticmethod
	def _map_mosaic_definition_args(tx_dict):
		mosaic_definition = tx_dict['mosaicDefinition']
		mosaic_id = mosaic_definition['id']
		mosaic_levy = mosaic_definition['levy']
		mosaic_properties_dict = {
			item['name']: item['value']
			for item in mosaic_definition['properties']
		}

		mosaic_properties = MosaicProperties(
			int(mosaic_properties_dict['divisibility']),
			int(mosaic_properties_dict['initialSupply']),
			mosaic_properties_dict['supplyMutable'] != 'false',
			mosaic_properties_dict['transferable'] != 'false'
		)

		if mosaic_levy:
			mosaic_levy = MosaicLevy(
				mosaic_levy['fee'],
				mosaic_levy['recipient'],
				mosaic_levy['type'],
				f'{mosaic_levy["mosaicId"]["namespaceId"]}.{mosaic_levy["mosaicId"]["name"] }'
			)

		return {
			'creation_fee': tx_dict['creationFee'],
			'creation_fee_sink': tx_dict['creationFeeSink'],
			'creator': mosaic_definition['creator'],
			'description': mosaic_definition['description'],
			'namespace_name': f'{mosaic_id["namespaceId"]}.{mosaic_id["name"] }',
			'properties': mosaic_properties,
			'levy': mosaic_levy,
		}

	@staticmethod
	def _map_mosaic_supply_change_args(tx_dict):
		mosaic_id = tx_dict['mosaicId']
		return {
			'supply_type': tx_dict['supplyType'],
			'delta': tx_dict['delta'],
			'namespace_name': f'{mosaic_id["namespaceId"]}.{mosaic_id["name"] }',
		}


class TransactionFactory:
	"""Create transaction models."""

	@staticmethod
	def create_transaction(tx_type, common_args, specific_args):
		transaction_mapping = {
			TransactionType.TRANSFER.value: TransferTransaction,
			TransactionType.ACCOUNT_KEY_LINK.value: AccountKeyLinkTransaction,
			TransactionType.MULTISIG_ACCOUNT_MODIFICATION.value: MultisigAccountModificationTransaction,
			TransactionType.MULTISIG.value: MultisigTransaction,
			TransactionType.NAMESPACE_REGISTRATION.value: NamespaceRegistrationTransaction,
			TransactionType.MOSAIC_DEFINITION.value: MosaicDefinitionTransaction,
			TransactionType.MOSAIC_SUPPLY_CHANGE.value: MosaicSupplyChangeTransaction,
		}

		transaction_class = transaction_mapping.get(tx_type)

		if not transaction_class:
			raise UnknownTransactionType(f'Unknown transaction type {tx_type}')

		return transaction_class(**common_args, **specific_args)
