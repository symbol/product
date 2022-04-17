class MockNetworkTimeConverter:
	"""Mock network time converter."""

	@staticmethod
	def symbol_to_unix(timestamp):
		return 303 if 0 == timestamp else timestamp * 3

	@staticmethod
	def nem_to_unix(timestamp):
		return 202 if 0 == timestamp else timestamp * 2
