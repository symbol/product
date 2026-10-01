class SymbolDataInvalid(RuntimeError):
	"""Raised when a persisted Symbol value cannot be represented safely."""

	def __init__(self, field_path, reason):
		super().__init__(f'{field_path}: {reason}')
		self.field_path = field_path
		self.reason = reason
