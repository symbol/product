class ScreenContainer:
	"""Container of screens."""

	def __init__(self, navbar):
		"""Creates a screen container."""

		self.navbar = navbar  # added so that screens can access and modify it directly
		self.ordered = []
		self.current_id = 0
		self.group_name = []

		self.allowed_list = None
		self.chain = []

		# bit hacky, added here so that screens can show message box
		self.message_box = None

	def add(self, screen_group_name, descriptor):
		"""Adds a screen group."""

		self.group_name.append(screen_group_name)
		self.ordered.append(descriptor)

	def get(self, screen_id):
		"""Gets the screen with the specified id."""

		index = [screen.screen_id for screen in self.ordered].index(screen_id)
		return self.ordered[index].accessor

	@property
	def ordered_group_names(self):
		"""Gets ordered screen group names."""

		_ordered_group_names = []
		for i, ordered_screen in enumerate(self.ordered):
			if not self.allowed_list or ordered_screen.screen_id in self.allowed_list:
				group_name = self.group_name[i]
				if group_name not in _ordered_group_names:
					_ordered_group_names.append(group_name)

		return _ordered_group_names

	def set_list(self, allowed_list):
		"""Sets list of enabled screen ids."""

		self.allowed_list = allowed_list

	@property
	def current(self):
		"""Gets the current screen."""

		return self.ordered[self.current_id]

	@property
	def has_previous(self):
		"""True if there is a previous screen."""

		return bool(self.chain)

	def previous(self):
		"""Moves to the previous screen."""

		if not self.chain:
			return self.current

		self.current_id = self.chain.pop()
		return self.current

	def next(self):
		"""Moves to the next screen."""

		original_id = self.current_id

		next_id = self.current_id + 1
		while next_id != len(self.ordered):
			if (not self.allowed_list or self.ordered[next_id].screen_id in self.allowed_list) and self.ordered[next_id].should_show():
				break

			next_id = next_id + 1

		if next_id == len(self.ordered):
			return self.current

		self.chain.append(original_id)
		self.current_id = next_id

		return self.current
