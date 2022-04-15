class MockNetworkTimeConverter:
	"""Mock network time converter."""

	@staticmethod
	def symbol_to_unix(timestamp):
		return timestamp * 3

	@staticmethod
	def nem_to_unix(timestamp):
		return timestamp * 2
