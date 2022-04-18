class MultiAddressMatcher:
	"""Collection of address search patterns that are used to match against private keys."""

	class SearchDescriptor:
		def __init__(self, pattern):
			self.search_string = pattern
			self.best_match_size = 0
			self.best_key_pair = None

		@property
		def has_match(self):
			return self.best_key_pair and self.best_match_size == len(self.search_string)

	def __init__(self, network, max_offset, progress_monitor=None):
		"""Creates a matcher around a network."""

		self.network = network
		self.max_offset = max_offset
		self.progress_monitor = progress_monitor
		self.descriptors = []

	@property
	def is_complete(self):
		"""Returns true when all patterns have been matched."""

		return all(descriptor.has_match for descriptor in self.descriptors)

	def add_search_pattern(self, pattern):
		"""Adds a new search pattern."""

		self.descriptors.append(self.SearchDescriptor(pattern))

	def accept(self, candidate_key_pair):
		"""Attempts to match a candidate key pair against a preregistered search pattern."""

		candidate_address_string = str(self.network.public_key_to_address(candidate_key_pair.public_key))

		better_key_pair = None
		for descriptor in self.descriptors:
			search_string = descriptor.search_string

			while search_string and (len(search_string) > descriptor.best_match_size or not descriptor.best_key_pair):
				match_index = candidate_address_string.find(search_string)
				is_match = -1 != match_index and match_index <= self.max_offset
				if is_match:
					if search_string and self.progress_monitor:
						self.progress_monitor(
							f'searching for \'{descriptor.search_string}\' found {candidate_address_string}'
							f' ({len(search_string)} / {len(descriptor.search_string)})')

					descriptor.best_match_size = len(search_string)
					descriptor.best_key_pair = candidate_key_pair

					if descriptor.has_match:
						return (descriptor.best_key_pair, True)

					better_key_pair = descriptor.best_key_pair

				search_string = search_string[:-1]

		return (better_key_pair, False)
