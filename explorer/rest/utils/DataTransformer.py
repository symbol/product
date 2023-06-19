class DataTransformer:
	"""Handles data transformer."""

	@staticmethod
	def convert_memoryview_to_hex(data):
		"""Convert memoryview objects to hex."""
		return [
			tuple(bytes(item).hex() if isinstance(item, memoryview) else item for item in row)
			for row in data
		]