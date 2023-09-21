class MosaicView:  # pylint: disable=too-many-instance-attributes, too-many-locals
	def __init__(
		self,
		mosaic_name,
		namespace_name,
		description,
		creator,
		registered_height,
		initial_supply,
		total_supply,
		divisibility,
		supply_mutable,
		transferable,
		levy_type,
		levy_namespace,
		levy_fee,
		levy_recipient,
		root_namespace_registered_height,
		root_namespace_registered_timestamp,
		root_namespace_expiration_height,
	):
		"""Create mosaic view."""

		# pylint: disable=too-many-arguments

		self.mosaic_name = mosaic_name
		self.namespace_name = namespace_name
		self.description = description
		self.creator = creator
		self.registered_height = registered_height
		self.initial_supply = initial_supply
		self.total_supply = total_supply
		self.divisibility = divisibility
		self.supply_mutable = supply_mutable
		self.transferable = transferable
		self.levy_type = levy_type
		self.levy_namespace = levy_namespace
		self.levy_fee = levy_fee
		self.levy_recipient = levy_recipient
		self.root_namespace_registered_height = root_namespace_registered_height
		self.root_namespace_registered_timestamp = root_namespace_registered_timestamp
		self.root_namespace_expiration_height = root_namespace_expiration_height

	def __eq__(self, other):
		return isinstance(other, MosaicView) and all([
			self.mosaic_name == other.mosaic_name,
			self.namespace_name == other.namespace_name,
			self.description == other.description,
			self.creator == other.creator,
			self.registered_height == other.registered_height,
			self.initial_supply == other.initial_supply,
			self.total_supply == other.total_supply,
			self.divisibility == other.divisibility,
			self.supply_mutable == other.supply_mutable,
			self.transferable == other.transferable,
			self.levy_type == other.levy_type,
			self.levy_namespace == other.levy_namespace,
			self.levy_fee == other.levy_fee,
			self.levy_recipient == other.levy_recipient,
			self.root_namespace_registered_height == other.root_namespace_registered_height,
			self.root_namespace_registered_timestamp == other.root_namespace_registered_timestamp,
			self.root_namespace_expiration_height == other.root_namespace_expiration_height
		])

	def to_dict(self):
		"""Formats the mosaic info as a dictionary."""

		return {
			'mosaicName': self.mosaic_name,
			'namespaceName': self.namespace_name,
			'description': self.description,
			'creator': str(self.creator),
			'registeredHeight': self.registered_height,
			'initialSupply': self.initial_supply,
			'totalSupply': self.total_supply,
			'divisibility': self.divisibility,
			'supplyMutable': self.supply_mutable,
			'transferable': self.transferable,
			'levyType': self.levy_type,
			'levyNamespace': self.levy_namespace,
			'levyFee': self.levy_fee,
			'levyRecipient': str(self.levy_recipient) if self.levy_recipient else None,
			'rootNamespaceRegisteredHeight': self.root_namespace_registered_height,
			'rootNamespaceRegisteredTimestamp': self.root_namespace_registered_timestamp,
			'rootNamespaceExpirationHeight': self.root_namespace_expiration_height
		}
