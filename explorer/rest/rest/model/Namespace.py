class NamespaceView:
	def __init__(self, root_namespace, owner, registered_height, registered_timestamp, expiration_height, sub_namespaces, mosaics):
		"""Create Namespace view."""

		# pylint: disable=too-many-arguments

		self.root_namespace = root_namespace
		self.owner = owner
		self.registered_height = registered_height
		self.registered_timestamp = registered_timestamp
		self.expiration_height = expiration_height
		self.sub_namespaces = sub_namespaces
		self.mosaics = mosaics

	def __eq__(self, other):
		return isinstance(other, NamespaceView) and all([
			self.root_namespace == other.root_namespace,
			self.owner == other.owner,
			self.registered_height == other.registered_height,
			self.registered_timestamp == other.registered_timestamp,
			self.expiration_height == other.expiration_height,
			self.sub_namespaces == other.sub_namespaces,
			self.mosaics == other.mosaics
		])

	def to_dict(self):
		"""Formats the namespace info as a dictionary."""

		return {
			'rootNamespace': self.root_namespace,
			'owner': str(self.owner),
			'registeredHeight': self.registered_height,
			'registeredTimestamp': str(self.registered_timestamp),
			'expirationHeight': self.expiration_height,
			'subNamespaces': self.sub_namespaces,
			'mosaics': self.mosaics
		}
