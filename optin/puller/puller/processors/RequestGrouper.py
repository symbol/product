class RequestGroup:
	"""Group of requests."""

	def __init__(self):
		"""Creates an empty request group."""

		self.requests = []
		self.is_multisig = None
		self.is_error = False


class RequestGrouper:
	"""Groups multisig requests together and removes duplicate requests."""

	def __init__(self, network):
		"""Creates a request grouper."""

		self.network = network
		self.all = {}

	def add(self, request):
		"""Adds a new request."""

		is_multisig = bool(request.multisig_public_key)
		source_address = self.network.public_key_to_address(request.multisig_public_key) if is_multisig else request.address

		if source_address not in self.all:
			self.all[source_address] = RequestGroup()

		request_group = self.all[source_address]
		if request_group.is_multisig is not None and is_multisig != request_group.is_multisig:
			request_group.is_error = True  # address was previously seen as multisig but now it's not (or vice versa)
			return

		request_group.is_multisig = is_multisig
		if not is_multisig:
			if not request_group.requests:
				request_group.requests.append(request)

			return

		if any(previous_request.address == request.address for previous_request in request_group.requests):
			return  # duplicate, ignore

		if request_group.requests and request_group.requests[0].destination_public_key != request.destination_public_key:
			request_group.is_error = True  # different cosigner has different destination specified
			return

		request_group.requests.append(request)


def group_requests(network, requests):
	"""Groups multisig requests together and removes duplicate requests."""

	grouped_requests = RequestGrouper(network)
	for request in requests:
		grouped_requests.add(request)

	return grouped_requests.all
