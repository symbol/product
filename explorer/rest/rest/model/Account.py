class AccountView:  # pylint: disable=too-many-locals,too-many-instance-attributes
	def __init__(
		self,
		address,
		public_key,
		remote_address,
		importance,
		balance,
		vested_balance,
		mosaics,
		harvested_fees,
		harvested_blocks,
		status,
		remote_status,
		last_harvested_height,
		min_cosignatories,
		cosignatory_of,
		cosignatories
	):
		"""Create account view."""

		# pylint: disable=too-many-arguments,too-many-positional-arguments

		self.address = address
		self.public_key = public_key
		self.remote_address = remote_address
		self.importance = importance
		self.balance = balance
		self.vested_balance = vested_balance
		self.mosaics = mosaics
		self.harvested_fees = harvested_fees
		self.harvested_blocks = harvested_blocks
		self.status = status
		self.remote_status = remote_status
		self.last_harvested_height = last_harvested_height
		self.min_cosignatories = min_cosignatories
		self.cosignatory_of = cosignatory_of
		self.cosignatories = cosignatories

	def __eq__(self, other):
		return isinstance(other, AccountView) and all([
			self.address == other.address,
			self.public_key == other.public_key,
			self.remote_address == other.remote_address,
			self.importance == other.importance,
			self.balance == other.balance,
			self.vested_balance == other.vested_balance,
			self.mosaics == other.mosaics,
			self.harvested_fees == other.harvested_fees,
			self.harvested_blocks == other.harvested_blocks,
			self.status == other.status,
			self.remote_status == other.remote_status,
			self.last_harvested_height == other.last_harvested_height,
			self.min_cosignatories == other.min_cosignatories,
			self.cosignatory_of == other.cosignatory_of,
			self.cosignatories == other.cosignatories
		])

	def to_dict(self):
		"""Formats the account info as a dictionary."""

		return {
			'address': self.address,
			'publicKey': self.public_key,
			'remoteAddress': self.remote_address,
			'importance': self.importance,
			'balance': self.balance,
			'vestedBalance': self.vested_balance,
			'mosaics': self.mosaics,
			'harvestedFees': self.harvested_fees,
			'harvestedBlocks': self.harvested_blocks,
			'status': self.status,
			'remoteStatus': self.remote_status,
			'lastHarvestedHeight': self.last_harvested_height,
			'minCosignatories': self.min_cosignatories,
			'cosignatoryOf': self.cosignatory_of,
			'cosignatories': self.cosignatories
		}
