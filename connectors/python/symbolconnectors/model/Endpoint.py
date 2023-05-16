class Endpoint:
	"""Endpoint model."""

	def __init__(self, protocol, host, port):
		"""Creates an endpoint model."""

		self.protocol = protocol
		self.host = host
		self.port = port

	def __eq__(self, other):
		return isinstance(other, Endpoint) and self.protocol == other.protocol and self.host == other.host and self.port == other.port

	def __ne__(self, other):
		return not self == other

	def __str__(self):
		return f'{self.protocol}://{self.host}:{self.port}'

	def __repr__(self):
		return f'Endpoint(\'{self.protocol}\', \'{self.host}\', {self.port})'
