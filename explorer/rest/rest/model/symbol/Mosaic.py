from rest.model.symbol.format import format_amount


class SymbolMosaicView:  # pylint: disable=too-many-instance-attributes
	"""Current Symbol mosaic metadata; supply is expressed in absolute units."""

	def __init__(
		self,
		mosaic_id,
		owner_address,
		start_height,
		expiration_height,
		duration,
		supply,
		divisibility,
		supply_mutable,
		transferable,
		restrictable,
		revokable,
		alias_names,
	):
		# pylint: disable=too-many-arguments,too-many-positional-arguments
		self.mosaic_id = mosaic_id
		self.owner_address = owner_address
		self.start_height = start_height
		self.expiration_height = expiration_height
		self.duration = duration
		self.supply = supply
		self.divisibility = divisibility
		self.supply_mutable = supply_mutable
		self.transferable = transferable
		self.restrictable = restrictable
		self.revokable = revokable
		self.alias_names = alias_names

	def __eq__(self, other):
		return isinstance(other, SymbolMosaicView) and all([
			self.mosaic_id == other.mosaic_id,
			self.owner_address == other.owner_address,
			self.start_height == other.start_height,
			self.expiration_height == other.expiration_height,
			self.duration == other.duration,
			self.supply == other.supply,
			self.divisibility == other.divisibility,
			self.supply_mutable == other.supply_mutable,
			self.transferable == other.transferable,
			self.restrictable == other.restrictable,
			self.revokable == other.revokable,
			self.alias_names == other.alias_names
		])

	def to_dict(self):
		"""Formats current mosaic metadata as a public JSON object."""

		return {
			'id': self.mosaic_id,
			'creator': self.owner_address,
			'aliasNames': self.alias_names,
			'supply': self.supply,
			'divisibility': self.divisibility,
			'registrationHeight': self.start_height,
			'expirationHeight': self.expiration_height,
			'value': format_amount(self.supply, self.divisibility),
			'isUnlimitedDuration': self.duration == 0,
			'isSupplyMutable': self.supply_mutable,
			'isTransferable': self.transferable,
			'isRestrictable': self.restrictable,
			'isRevokable': self.revokable
		}
