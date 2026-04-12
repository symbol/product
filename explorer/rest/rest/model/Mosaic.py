class MosaicView:  # pylint: disable=too-many-instance-attributes,too-few-public-methods
	def __init__(
		self,
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
		levy_fee,
		levy_recipient,
		root_namespace_registered_height,
		root_namespace_registered_timestamp,
		root_namespace_expiration_height,
	):
		"""Create mosaic view."""

		# pylint: disable=too-many-arguments,too-many-positional-arguments,too-many-instance-attributes,too-many-locals

		self.namespace_name = namespace_name
		self.description = description
		self.creator = creator
		self.mosaic_registered_height = mosaic_registered_height
		self.mosaic_registered_timestamp = mosaic_registered_timestamp
		self.initial_supply = initial_supply
		self.total_supply = total_supply
		self.divisibility = divisibility
		self.supply_mutable = supply_mutable
		self.transferable = transferable
		self.levy_type = levy_type
		self.levy_namespace_name = levy_namespace_name
		self.levy_fee = levy_fee
		self.levy_recipient = levy_recipient
		self.root_namespace_registered_height = root_namespace_registered_height
		self.root_namespace_registered_timestamp = root_namespace_registered_timestamp
		self.root_namespace_expiration_height = root_namespace_expiration_height

	def __eq__(self, other):
		return isinstance(other, MosaicView) and all([
			self.namespace_name == other.namespace_name,
			self.description == other.description,
			self.creator == other.creator,
			self.mosaic_registered_height == other.mosaic_registered_height,
			self.mosaic_registered_timestamp == other.mosaic_registered_timestamp,
			self.initial_supply == other.initial_supply,
			self.total_supply == other.total_supply,
			self.divisibility == other.divisibility,
			self.supply_mutable == other.supply_mutable,
			self.transferable == other.transferable,
			self.levy_type == other.levy_type,
			self.levy_namespace_name == other.levy_namespace_name,
			self.levy_fee == other.levy_fee,
			self.levy_recipient == other.levy_recipient,
			self.root_namespace_registered_height == other.root_namespace_registered_height,
			self.root_namespace_registered_timestamp == other.root_namespace_registered_timestamp,
			self.root_namespace_expiration_height == other.root_namespace_expiration_height
		])

	def to_dict(self):
		"""Formats the mosaic info as a dictionary."""

		return {
			'namespaceName': self.namespace_name,
			'description': self.description,
			'creator': self.creator,
			'mosaicRegisteredHeight': self.mosaic_registered_height,
			'mosaicRegisteredTimestamp': self.mosaic_registered_timestamp,
			'initialSupply': self.initial_supply,
			'totalSupply': self.total_supply,
			'divisibility': self.divisibility,
			'supplyMutable': self.supply_mutable,
			'transferable': self.transferable,
			'levyType': self.levy_type,
			'levyNamespaceName': self.levy_namespace_name,
			'levyFee': self.levy_fee,
			'levyRecipient': self.levy_recipient,
			'rootNamespaceRegisteredHeight': self.root_namespace_registered_height,
			'rootNamespaceRegisteredTimestamp': self.root_namespace_registered_timestamp,
			'rootNamespaceExpirationHeight': self.root_namespace_expiration_height
		}


class MosaicRichListView:
	def __init__(self, address, remark, balance):
		"""Create mosaic rich list view."""

		self.address = address
		self.remark = remark
		self.balance = balance

	def __eq__(self, other):
		return isinstance(other, MosaicRichListView) and all([
			self.address == other.address,
			self.remark == other.remark,
			self.balance == other.balance
		])

	def to_dict(self):
		"""Formats the mosaic rich list info as a dictionary."""

		return {
			'address': self.address,
			'remark': self.remark,
			'balance': self.balance
		}
