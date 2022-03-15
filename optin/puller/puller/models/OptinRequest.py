from symbolchain.CryptoTypes import PublicKey


class OptinRequest:
	"""Represents a valid optin request."""

	def __init__(self, address, optin_transaction_height, optin_transaction_hash, payout_transaction_hash, message_dict):
		# pylint: disable=too-many-arguments

		self.address = address
		self.optin_transaction_height = optin_transaction_height
		self.optin_transaction_hash = optin_transaction_hash
		self.payout_transaction_hash = payout_transaction_hash
		self.destination_public_key = PublicKey(message_dict['destination'])
		self.multisig_public_key = PublicKey(message_dict['origin']) if 101 == message_dict['type'] else None
		self.is_error = False


class OptinRequestError:
	"""Represents an optin request error."""

	def __init__(self, address, optin_transaction_height, optin_transaction_hash, message):
		self.address = address
		self.optin_transaction_height = optin_transaction_height
		self.optin_transaction_hash = optin_transaction_hash
		self.message = message
		self.is_error = True
