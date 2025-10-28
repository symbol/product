from symbolchain.CryptoTypes import Hash256


def is_valid_address_string(network_facade, address_string):
	"""Determines if the specified string is a valid address string."""

	(is_valid, _) = network_facade.is_valid_address(address_string)
	return is_valid


def _contains_only_alphabet(alphabet, test_string):
	return all(ch in alphabet for ch in test_string)


def is_valid_hash_string(hash_string):
	"""Determines if the specified string is a valid hex string."""

	return isinstance(hash_string, str) and 2 * Hash256.SIZE == len(hash_string) and _contains_only_alphabet('0123456789ABCDEF', hash_string)


def is_valid_decimal_string(decimal_string):
	"""Determines if the specified string is a valid decimal string."""

	if isinstance(decimal_string, int):
		return True

	return isinstance(decimal_string, str) and _contains_only_alphabet('0123456789', decimal_string)
