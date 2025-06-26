from symbolchain.nem.Network import Address


class MockNetworkFacade:
	"""Mock network facade."""

	@staticmethod
	def make_address(raw_address):
		return Address(raw_address)
