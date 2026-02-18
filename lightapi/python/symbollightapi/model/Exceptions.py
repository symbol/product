class NodeException(Exception):
	"""Exception raised when there is an error communicating with a node."""


class NodeTransientException(NodeException):
	"""Exception raised when a node operation experiences a transient failure."""


class HttpException(NodeException):
	"""Exception raised when there is an HTTP error communicating with a node."""

	def __init__(self, message, http_status_code):
		"""Creates an HTTP exception."""

		super().__init__(message)
		self.http_status_code = http_status_code


class CorruptDataException(NodeException):
	"""Exception raised when corrupt data is received from a node."""


class InsufficientBalanceException(NodeException):
	"""Exception raised when a node operation fails due to insufficient balance."""


class UnknownTransactionType(Exception):
	"""Exception raised when Unknown transaction type."""
