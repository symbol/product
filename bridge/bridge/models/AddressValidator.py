def try_convert_network_address_to_string(network, raw_address):  # pylint: disable=invalid-name
	"""
	Checks if an address is valid and belongs to the specified network.
	If so, returns an appropriate string representation.
	If not, returns None.
	"""

	if isinstance(raw_address, str):
		if network.is_valid_address_string(raw_address):
			return raw_address
	elif isinstance(raw_address, bytes):
		if network.address_class.SIZE == len(raw_address):
			address = network.address_class(raw_address)
			if network.is_valid_address(address):
				return str(address)

	return None
