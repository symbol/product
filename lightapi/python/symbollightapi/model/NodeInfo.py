class NodeInfo:
	"""Node model."""

	# Role flag indicating an API node.
	API_ROLE_FLAG = 2

	def __init__(self, network_identifier, network_generation_hash_seed, main_public_key, node_public_key, endpoint, name, version, roles):
		"""Creates a node model."""

		# pylint: disable=too-many-arguments

		self.network_identifier = network_identifier
		self.network_generation_hash_seed = network_generation_hash_seed
		self.main_public_key = main_public_key
		self.node_public_key = node_public_key
		self.endpoint = endpoint
		self.name = name
		self.version = version
		self.roles = roles

	@property
	def has_api(self):
		"""Returns true if this node supports a REST API."""

		return bool(self.roles & self.API_ROLE_FLAG)

	def to_dict(self):
		"""Formats the node descriptor as a dictionary."""

		return {
			'mainPublicKey': str(self.main_public_key),
			'nodePublicKey': str(self.node_public_key) if self.node_public_key else None,
			'endpoint': str(self.endpoint),
			'name': self.name,
			'version': self.version,
			'roles': self.roles
		}

	def __eq__(self, other):
		return isinstance(other, NodeInfo) and all([
			self.network_identifier == other.network_identifier,
			self.network_generation_hash_seed == other.network_generation_hash_seed,
			self.main_public_key == other.main_public_key,
			self.node_public_key == other.node_public_key,
			self.endpoint == other.endpoint,
			self.name == other.name,
			self.version == other.version,
			self.roles == other.roles
		])

	def __ne__(self, other):
		return not self == other

	def __repr__(self):
		arguments = [
			str(self.network_identifier),
			f'Hash256(\'{self.network_generation_hash_seed}\')' if self.network_generation_hash_seed else 'None',
			f'PublicKey(\'{self.main_public_key}\')',
			f'PublicKey(\'{self.node_public_key}\')' if self.node_public_key else 'None',
			repr(self.endpoint),
			f'\'{self.name}\'',
			f'\'{self.version}\'',
			str(self.roles)
		]
		formatted_arguments = ',\n\t'.join(arguments)
		return f'NodeInfo(\n\t{formatted_arguments})'
