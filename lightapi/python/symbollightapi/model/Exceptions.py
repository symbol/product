class NodeException(Exception):
	"""Exception raised when there is an error communicating with a node."""


class CorruptDataException(NodeException):
	"""Exception raised when corrupt data is received from a node."""


class UnknownTransactionType(Exception):
	"""Exception raised when Unknown transaction type."""
