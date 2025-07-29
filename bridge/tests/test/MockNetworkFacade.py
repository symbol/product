from symbolchain.nem.Network import Address, Network


class MockNetworkFacade:
	"""Mock network facade."""

	def __init__(self):
		"""Creates a mock network facade."""

		self.network = Network.TESTNET

	@staticmethod
	def make_address(raw_address):
		return Address(raw_address)
